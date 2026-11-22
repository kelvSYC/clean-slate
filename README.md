# Clean Slate

Clean Slate is a browser game about numbers and three dice. You roll, combine the
dice with + − × ÷ to make a number on an 8×8 board, and wipe that number off the
slate. You score more for wiping next to numbers that are already gone.

It's a tribute to **Digital Wipeout** (John Mauro, ©2000), a Mac shareware
classic. Clean Slate plays by the same rules, adds one twist (a **shuffled
board**), and is written to be read: the source is the tutorial.

> **Status:** designed, not yet built. See
> [`docs/superpowers/specs/2026-11-21-clean-slate-design.md`](docs/superpowers/specs/2026-11-21-clean-slate-design.md).

## How to play

- **The board** holds 64 numbers: 1–42, 44, 45, 48, 50, 54, 55, 60, 64, 66, 72,
  75, 80, 90, 96, 100, 108, 120, 125, 144, 150, 180 and 216. That's every
  positive whole number three dice can make, and nothing else.
- **On your turn,** click Roll to throw three dice. Use **all three, each exactly once**, with
  any of + − × ÷ and brackets, to make a number that's still on the board.
  Division must come out whole. Click the number to wipe it out.
  - With 3, 2 and 6, you could wipe 4 (6 ÷ 3 + 2), 24 ((6 + 2) × 3), 36
    (3 × 2 × 6), 1 (6 − 2 − 3), and more.
- **Scoring:** 1 point for the wipe, plus 1 for each neighbouring number
  (including diagonals) that's already wiped. The most you can score in one turn
  is 9.
- **Can't make anything?** Pass. You may only pass when no move exists. If a set number of passes happen in a row
  (6 by default), the game ends. It also ends when the board is cleared.
- **Highest score wins.** Playing solo? Try to clear all 64.

### Options

- **Board:** *Classic* (in order, as in the original) or *Shuffled*. A shuffled
  board has a short code you can share, so friends can play the same layout.
- **Move aid:** highlights the numbers you can make and blocks the rest. Turn it
  off for the original rules. Then a wrong click, or passing when you had a move,
  is an illegal move: it costs a point, ends your turn, and counts as a pass.
- **Passes before the game ends:** 6 by default.
- **Players:** 1 to 8, taking turns at one screen.

## Running it

There's no build step and nothing to install. The game uses JavaScript modules,
which browsers won't load from a double-clicked file, so serve the folder:

```sh
python3 -m http.server
# then open http://localhost:8000/
```

Any static host (e.g. GitHub Pages) works the same way.

## How it works

Read the files in this order. Each has one job, and only the last one touches the
page:

| File | What it teaches |
|------|-----------------|
| `src/dice.js` | Rolling dice |
| `src/solver.js` | Finding every number three dice can make. It tries every case, which works because there are only 3 × 6 × 6 of them |
| `src/board.js` | The 64 numbers, neighbours on a grid, and a shuffle that can be recreated from a code |
| `src/game.js` | Turns, scoring and passes, as small functions that take the current state and return the next one |
| `src/ui.js` | Drawing that state into the page and turning clicks into moves |
| `style.css` | Layout, and colours kept as named settings so themes are a one-place change |

## Credits

Clean Slate is an independent tribute. It isn't affiliated with or endorsed by
John Mauro, and contains no code, art, sound or text from Digital Wipeout. See
[ATTRIBUTION.md](ATTRIBUTION.md).

## Licence

MIT. See [LICENSE](LICENSE).
