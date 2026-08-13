# pi-tuicr

Review the diff pi just produced in [tuicr](https://github.com/agavra/tuicr), then hand your comments straight back to pi.

The usual loop is annoying: pi writes code, you read the diff somewhere else, then you retype your objections into the chat. This extension closes that loop. `/tuicr` suspends pi's TUI and opens tuicr on the working tree. Every comment you leave during that session gets collected, numbered, and prefilled into pi's editor when tuicr exits. You read it over, and press enter when you're happy.

Comments that were already in tuicr before you opened it are ignored, so an old review doesn't come back a second time.

## Install

```bash
pi install npm:pi-tuicr
```

tuicr has to be on your `PATH`. The extension shells out to `tuicr -w` for the review UI and to `tuicr review list` / `tuicr review comments` for the JSON.

## Usage

| Trigger        | What it does                             |
| -------------- | ---------------------------------------- |
| `/tuicr`       | Review the working tree, then load notes |
| `ctrl+shift+r` | Same, without typing                     |

What lands in the editor looks like this:

```
I reviewed your changes in tuicr. Please address these comments:

1. `src/auth.ts:42` [BUG] - this throws when the token is missing
2. `src/auth.ts:88` - rename this to something less generic
```

If you left no comments, you get a notification and an untouched editor.

## Notes

- Only local review sessions for the current repo are read. Remote or PR sessions are left alone.
- If tuicr is missing or exits non-zero, the extension says so and stops rather than sending a half-built prompt.
- Interactive TUI mode only.

## License

MIT
