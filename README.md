# pi-tuicr

Review the diff pi just produced in [tuicr](https://github.com/agavra/tuicr), then hand your comments straight back to pi.

![demo](https://raw.githubusercontent.com/joelazar/pi-tuicr/main/assets/demo.gif)

The usual loop is annoying: pi writes code, you read the diff somewhere else, then you retype your objections into the chat. This extension closes that loop. `/tuicr` asks what you want to review, suspends pi's TUI and opens tuicr on that diff. Every comment you leave during that session gets collected, numbered, and prefilled into pi's editor when tuicr exits. You read it over, and press enter when you're happy.

Comments that were already in tuicr before you opened it are ignored, so an old review doesn't come back a second time.

## Install

```bash
pi install npm:@joelazar/pi-tuicr
```

tuicr has to be on your `PATH`. The extension shells out to `tuicr` for the review UI and to `tuicr review list` / `tuicr review comments` for the JSON.

## Usage

| Trigger        | What it does                     |
| -------------- | -------------------------------- |
| `/tuicr`       | Pick a diff, then load notes     |
| `ctrl+shift+r` | Same, without typing             |

The picker offers:

| Choice                        | tuicr invocation          |
| ----------------------------- | ------------------------- |
| Uncommitted changes           | `tuicr -w`                |
| Branch vs base (+ uncommitted)| `tuicr -r base..HEAD -w`  |
| Branch vs base                | `tuicr -r base..HEAD`     |
| Last commit                   | `tuicr -r HEAD~1..HEAD`   |
| Pick commits                  | `tuicr` (commit selector) |
| Every tracked file            | `tuicr -A`                |
| Custom revset...              | `tuicr -r <your revset>`  |
| Pull request...               | `tuicr pr <target>`       |

The base branch is detected from `origin/HEAD`, falling back to `origin/main`, `origin/master`, `main`, `master`; if none exist those entries are hidden.

What lands in the editor looks like this:

```
I reviewed your changes in tuicr. Please address these comments:

1. `src/auth.ts:42` [BUG] - this throws when the token is missing
2. `src/auth.ts:88` - rename this to something less generic
```

If you left no comments, you get a notification and an untouched editor.

## Notes

- Only comments created during the session you just opened are sent back; anything already in tuicr is ignored.
- If tuicr is missing or exits non-zero, the extension says so and stops rather than sending a half-built prompt.
- Interactive TUI mode only.

## License

MIT
