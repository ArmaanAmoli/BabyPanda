# Keyboard and mouse shortcuts

Every binding in the BabyPanda terminal UI. Which component reacts to a key is
decided by **focus**: `Tab` moves focus between the chat area and the prompt
box, and a component only listens while it holds focus (or, for the menus,
while it is open).

## Global

Active everywhere, regardless of focus.

| Key      | Action                                                            |
| -------- | ----------------------------------------------------------------- |
| `Tab`    | Switch focus between the chat area and the prompt box             |
| `Esc`    | Close the slash menu if it is open; otherwise drop focus entirely |
| `Ctrl+C` | Exit BabyPanda                                                    |

## Prompt box

Active while the prompt box has focus.

### Editing

| Key           | Action                                                                |
| ------------- | --------------------------------------------------------------------- |
| `Enter`       | Submit the prompt                                                     |
| `Ctrl+J`      | Insert a newline                                                      |
| `Shift+Enter` | Insert a newline — only on terminals with the Kitty keyboard protocol |
| `Alt+Enter`   | Insert a newline — only if the terminal does not intercept it         |
| `←` / `→`     | Move the cursor one character                                         |
| `↑` / `↓`     | Move the cursor one visual line, keeping the display column           |
| `Backspace`   | Delete the character before the cursor                                |
| `Delete`      | Delete the character after the cursor                                 |
| `Ctrl+W`      | Delete the word before the cursor                                     |
| `Ctrl+U`      | Delete from the cursor to the start of the line                       |
| `Ctrl+K`      | Delete from the cursor to the end of the line                         |
| `Ctrl+Z`      | Undo                                                                  |
| `Ctrl+Y`      | Redo                                                                  |
| `Ctrl+L`      | Clear the whole prompt box                                            |

`Ctrl+J` is the newline key to rely on. Terminals without the Kitty keyboard
protocol send `Shift+Enter` as a bare carriage return, which is
indistinguishable from `Enter`, and many terminals swallow `Alt+Enter` as a
window shortcut before it ever reaches the application.

### Scrolling

| Key                   | Action                                                       |
| --------------------- | ------------------------------------------------------------ |
| Mouse wheel           | Scroll three rows per notch (only while the box has focus)   |
| `PageUp` / `PageDown` | Scroll one viewport, minus one row of overlap                |
| `Home`                | Jump to the very start of the content and scroll to the top  |
| `End`                 | Jump to the very end of the content and scroll to the bottom |

The box wraps long lines instead of scrolling horizontally, so there is no
horizontal scrolling to do. A one-column scrollbar appears on the right edge
only when the content is taller than the box.

### Pasting

Pastes arrive through bracketed paste mode, so a multi-line paste is inserted
as one action and its newlines are normalised.

- A paste that would occupy **more than two visual rows** collapses into a
  single chip, for example `[Pasted text #1 · 159 lines · 2.4 KB]`.
- A shorter paste is inserted as ordinary text.
- **Pasting identical content again, with no other input in between, expands
  the most recent chip** back into the real text it came from. This is the only
  way to read a chip's contents.
- A third paste of the same content creates a new chip, leaving one expanded
  copy and one collapsed chip.

A collapsed chip is atomic: the cursor cannot come to rest inside one, and one
`Backspace` or `Delete` removes it whole. An expanded chip is ordinary text and
edits character by character.

## Chat area

Active while the chat area has focus.

| Key         | Action                                          |
| ----------- | ----------------------------------------------- |
| `↑` / `↓`   | Move focus between message groups               |
| `y`         | Copy the focused message group to the clipboard |
| `Space`     | Expand or collapse the focused tool-call group  |
| Mouse wheel | Scroll the conversation                         |

Wheel scrolling chains outwards: once the innermost region under the cursor is
exhausted, the remainder passes to the next one out, so a diff viewer scrolled
to its end hands the rest of the wheel to the chat.

## Menus

### Slash menu

Opens as soon as the prompt starts with `/`.

| Key                     | Action                                         |
| ----------------------- | ---------------------------------------------- |
| `↑` / `↓`, or `j` / `k` | Move the selection                             |
| `Enter`                 | Complete the selected entry without submitting |
| `1` – `9`               | Select an entry by its number                  |
| `Esc`                   | Close the menu, keeping the typed text         |

Typing continues to filter the menu while it is open.

### Permission prompt

Shown when the agent asks to run a tool.

| Key                     | Action                         |
| ----------------------- | ------------------------------ |
| `↑` / `↓`, or `j` / `k` | Move the selection             |
| `Enter`                 | Confirm the selection          |
| `1` – `3`               | Select an option by its number |

## Mouse

| Target                         | Action                                 |
| ------------------------------ | -------------------------------------- |
| Tool-call bullet or header row | Toggle the group, a diff, or a command |
| Tool-call bullet               | Hovering highlights it                 |
| Prompt box, chat area          | Wheel scroll, as described above       |

## Slash commands

Typed into the prompt box and submitted with `Enter`.

| Command                | Effect                                    |
| ---------------------- | ----------------------------------------- |
| `/provider`            | Switch provider                           |
| `/model`               | Switch model                              |
| `/efforts`             | Set reasoning effort                      |
| `/sandbox`             | Toggle the shell sandbox                  |
| `/<skill-name> <args>` | Activate a skill, with optional arguments |

## Known quirks

- While a permission prompt is pending, the permission menu and the prompt box
  are both listening, so arrow keys and `Enter` reach both. This predates the
  prompt box rewrite and is left unchanged.
- While the slash menu is open, `j`, `k` and the number keys reach both the
  menu and the prompt box, for the same reason.
