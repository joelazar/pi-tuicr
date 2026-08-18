/**
 * pi-tuicr - review pi's changes in tuicr, then feed the comments back.
 *
 * `/tuicr` (or ctrl+shift+r) asks what to review, suspends pi's TUI and opens
 * tuicr on that diff. When tuicr exits, any comments written during that
 * session are formatted and prefilled into the editor, so you can read them
 * over and press enter when you want pi to act on them.
 */

import { execFileSync, spawnSync } from "node:child_process";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const COMMAND = "tuicr";
const SHORTCUT = "ctrl+shift+r";

interface Session {
  path: string;
  comment_count: number;
}

interface Comment {
  id: string;
  location?: string;
  path?: string;
  comment_type?: string;
  content: string;
}

/**
 * Run a command and capture its stdout. Returns null when the command cannot
 * run or exits non-zero - the probe semantics both callers want (a missing
 * tuicr, a ref that does not exist). Output that does run is trusted.
 */
function capture(cmd: string, args: string[], cwd: string): string | null {
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function git(args: string[], cwd: string): string | null {
  return capture("git", args, cwd);
}

/** Run a tuicr subcommand that prints a JSON array. */
function tuicrJson<T>(args: string[], cwd: string): T[] {
  const out = capture(COMMAND, args, cwd);
  if (out === null) return [];
  const parsed: unknown = JSON.parse(out);
  if (!Array.isArray(parsed)) {
    throw new Error(`${COMMAND} ${args.join(" ")} did not print a JSON array`);
  }
  return parsed as T[];
}

function allComments(cwd: string): Comment[] {
  return tuicrJson<Session>(["review", "list", "--all"], cwd)
    .filter((s) => s.comment_count > 0)
    .flatMap((s) =>
      tuicrJson<Comment>(["review", "comments", "--session", s.path], cwd),
    );
}

/** Best guess at the branch this work forked from. */
function baseBranch(cwd: string): string | null {
  const head = git(
    ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
    cwd,
  );
  const candidates = [
    ...(head ? [head] : []),
    "origin/main",
    "origin/master",
    "main",
    "master",
  ];
  const current = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  for (const ref of candidates) {
    if (ref === current) continue;
    if (git(["rev-parse", "--verify", "--quiet", ref], cwd)) return ref;
  }
  return null;
}

/** Ask what to review; returns tuicr args, or null if the user backed out. */
async function pickTarget(ctx: ExtensionContext): Promise<string[] | null> {
  const base = baseBranch(ctx.cwd);
  const ask = async (
    c: ExtensionContext,
    prompt: string,
    hint: string,
    build: (answer: string) => string[],
  ): Promise<string[] | null> => {
    const answer = (await c.ui.input(prompt, hint))?.trim();
    return answer ? build(answer) : null;
  };

  const choices: Array<{
    label: string;
    resolve: (c: ExtensionContext) => Promise<string[] | null>;
  }> = [
    { label: "Uncommitted changes", resolve: async () => ["-w"] },
    ...(base
      ? [
          {
            label: `Branch vs ${base} (+ uncommitted)`,
            resolve: async () => ["-r", `${base}..HEAD`, "-w"],
          },
          {
            label: `Branch vs ${base}`,
            resolve: async () => ["-r", `${base}..HEAD`],
          },
        ]
      : []),
    { label: "Last commit", resolve: async () => ["-r", "HEAD~1..HEAD"] },
    { label: "Pick commits", resolve: async () => [] },
    { label: "Every tracked file", resolve: async () => ["-A"] },
    {
      label: "Custom revset...",
      resolve: (c) => ask(c, "Revset:", "e.g. HEAD~3..HEAD", (r) => ["-r", r]),
    },
    {
      label: "Pull request...",
      resolve: (c) =>
        ask(c, "PR:", "number, owner/repo#N, or URL", (t) => ["pr", t]),
    },
  ];

  const label = await ctx.ui.select(
    "What should I open in tuicr?",
    choices.map((c) => c.label),
  );
  const choice = choices.find((c) => c.label === label);
  return choice ? await choice.resolve(ctx) : null;
}

function format(comments: Comment[]): string {
  const lines = comments.map((c, i) => {
    const anchor = c.location ?? c.path;
    const type =
      c.comment_type && c.comment_type !== "none"
        ? ` [${c.comment_type.toUpperCase()}]`
        : "";
    const body = c.content.trim().replace(/\n+/g, " ");
    return anchor
      ? `${i + 1}. \`${anchor}\`${type} - ${body}`
      : `${i + 1}.${type} - ${body}`;
  });

  return [
    "I reviewed your changes. Please address these comments:",
    "",
    ...lines,
  ].join("\n");
}

/** Suspend the TUI, run tuicr inheriting stdio, then restore the TUI. */
function runTuicr(
  ctx: ExtensionContext,
  args: string[],
): Promise<number | null> {
  return ctx.ui.custom<number | null>((tui, _theme, _keybindings, done) => {
    tui.stop();
    process.stdout.write("\x1b[2J\x1b[H");

    const result = spawnSync(COMMAND, args, {
      stdio: "inherit",
      env: process.env,
      cwd: ctx.cwd,
    });

    tui.start();
    tui.requestRender(true);
    done(result.error ? null : result.status);
    return { render: () => [], invalidate: () => {} };
  });
}

async function review(ctx: ExtensionContext): Promise<void> {
  if (ctx.mode !== "tui") {
    ctx.ui.notify("tuicr needs an interactive terminal", "error");
    return;
  }

  const args = await pickTarget(ctx);
  if (!args) return;

  // Snapshot existing comment ids, so only this session's feedback comes back.
  const seen = new Set(allComments(ctx.cwd).map((c) => c.id));

  const status = await runTuicr(ctx, args);
  if (status === null) {
    ctx.ui.notify("Could not start tuicr - is it on your PATH?", "error");
    return;
  }
  if (status !== 0) {
    ctx.ui.notify(`tuicr exited with status ${status}`, "error");
    return;
  }

  const fresh = allComments(ctx.cwd).filter((c) => !seen.has(c.id));
  if (fresh.length === 0) {
    ctx.ui.notify("No new review comments", "info");
    return;
  }

  ctx.ui.setEditorText(format(fresh));
  ctx.ui.notify(
    `${fresh.length} review comment${fresh.length === 1 ? "" : "s"} ready - press enter to send`,
    "info",
  );
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand(COMMAND, {
    description: "Review a diff in tuicr, then load comments",
    handler: async (_args, ctx) => {
      await review(ctx);
    },
  });

  pi.registerShortcut(SHORTCUT, {
    description: "Review a diff in tuicr",
    handler: async (ctx) => {
      await review(ctx);
    },
  });
}
