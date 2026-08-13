Output assets/demo.gif

Require pi
Require tuicr

Set Shell bash
Set Theme "Catppuccin Mocha"
Set FontSize 18
Set LineHeight 1.2
Set Width 1280
Set Height 800
Set Padding 20
Set Margin 20
Set MarginFill "#1e1e2e"
Set BorderRadius 10
Set WindowBar Colorful
Set CursorBlink false
Set TypingSpeed 45ms
Set PlaybackSpeed 1
Set Framerate 24
Set WaitTimeout 30s

Hide
Type "bash assets/setup.sh && cd /tmp/pi-tuicr-demo" Enter
Sleep 3s
Type "export XDG_CONFIG_HOME=/tmp/pi-tuicr-demo-config && clear" Enter
Sleep 1s
Show

Type "pi -a"
Sleep 700ms
Enter
Sleep 3s

Type "/tuicr"
Sleep 800ms
Enter
Sleep 4s

Type ":9" Enter
Sleep 1500ms
Type "c"
Sleep 1500ms
Type "this cache never expires - a revoked token stays valid forever"
Sleep 1s
Ctrl+S
Sleep 2s

Type ":4" Enter
Sleep 1500ms
Type "c"
Sleep 1500ms
Type "no bearer prefix check, a malformed header slices silently"
Sleep 800ms
Tab
Sleep 1s
Ctrl+S
Sleep 2500ms

Type ":w" Enter
Sleep 800ms
Type ":q" Enter
Sleep 5s
