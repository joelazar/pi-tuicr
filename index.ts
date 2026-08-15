/**
 * pi-tuicr - review pi's changes in tuicr, then feed the comments back.
 *
 * `/tuicr` (or ctrl+shift+r) suspends pi's TUI and opens tuicr on the working
 * tree. When tuicr exits, any comments written during that session are
 * formatted and prefilled into the editor, so you can read them over and press
 * enter when you want pi to act on them.
 */

import { execFileSync, spawnSync } from "node:child_process";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const COMMAND = "tuicr";
const SHORTCUT = "ctrl+shift+r";

interface Session {
  slug: string;
  kind: string;
  updated_at: string;
  active: boolean;
}

interface Comment {
  id: string;
  location?: string;
  path?: string;
  comment_type?: string;
  content: string;
}

/** Run a tuicr subcommand that prints JSON. Returns [] on any failure. */
function tuicrJson<T>(args: string[], cwd: string): T[] {
  try {
    const out = execFileSync(COMMAND, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsed: unknown = JSON.parse(out);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function localSessions(cwd: string): Session[] {
  return tuicrJson<Session>(["review", "list", "--repo", cwd], cwd)
    .filter((s) => s.kind === "local")
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

function commentsFor(slug: string, cwd: string): Comment[] {
  return tuicrJson<Comment>(
    ["review", "comments", "--repo", cwd, "--session", slug],
    cwd,
  );
}

function allComments(cwd: string): Comment[] {
  return localSessions(cwd).flatMap((s) => commentsFor(s.slug, cwd));
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

/** Suspend the TUI, run `tuicr -w` inheriting stdio, then restore the TUI. */
function runTuicr(ctx: ExtensionContext): Promise<number | null> {
  return ctx.ui.custom<number | null>((tui, _theme, _keybindings, done) => {
    tui.stop();
    process.stdout.write("\x1b[2J\x1b[H");

    const result = spawnSync(COMMAND, ["-w"], {
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

  // Snapshot existing comment ids, so only this session's feedback comes back.
  const seen = new Set(allComments(ctx.cwd).map((c) => c.id));

  const status = await runTuicr(ctx);
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
    description: "Review working tree in tuicr, then load comments",
    handler: async (_args, ctx) => {
      await review(ctx);
    },
  });

  pi.registerShortcut(SHORTCUT, {
    description: "Review working tree in tuicr",
    handler: async (ctx) => {
      await review(ctx);
    },
  });
}
