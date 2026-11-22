// @ts-check
// The board: which numbers are on it, where they sit, and which cells touch.
//
// The 64 numbers aren't arbitrary. They're exactly the positive whole numbers
// three dice can make (tests/board.test.js checks this against solver.js), so
// every cell is reachable and no roll makes a number that isn't on the board.
//
// A layout is just an array of 64 numbers, read row by row: index 0 is the
// top-left cell, index 7 the top-right, index 63 the bottom-right.
//
// THE TWIST: shuffled boards. A shuffle has to be repeatable, so friends can
// share a board by its code. JavaScript's Math.random can't be given a
// starting value ("seed"), so it would give a different board every time.
// Instead we use a tiny random-number generator of our own (mulberry32),
// seeded from the board code, and shuffle with Fisher–Yates. Same code, same
// seed, same sequence of "random" numbers, same board.
//
// Used by: game.js (layouts and neighbours) and ui.js (board codes).

/** Cells per row and per column. */
export const SIZE = 8;

/** The 64 numbers, in ascending order. */
export const BOARD_NUMBERS = Object.freeze([
  ...Array.from({ length: 42 }, (_, i) => i + 1), // 1–42
  44, 45, 48, 50, 54, 55, 60, 64, 66, 72, 75, 80, 90, 96,
  100, 108, 120, 125, 144, 150, 180, 216,
]);

/** The original game's layout: ascending, row by row. */
export function classicLayout() {
  return [...BOARD_NUMBERS];
}

// ---- Board codes ----------------------------------------------------------
//
// A code is 6 characters from Crockford's base32 alphabet. It leaves out
// I, L, O and U, so codes are easy to read aloud and hard to mistype. Each
// character carries 5 bits, so a code is a 30-bit number: about a billion
// different boards.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 6;

/**
 * Tidy up a code the way a person might type it: any case, with spaces or a
 * dash, with I/L for 1 and O for 0. Returns null if it isn't a valid code.
 * @param {string} input
 * @returns {string | null}
 */
export function normalizeBoardCode(input) {
  const code = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((ch) => ALPHABET.includes(ch)) ? code : null;
}

/** Show a code in two halves, "ABC-DEF", which is easier to read out. */
export function formatBoardCode(/** @type {string} */ code) {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/**
 * Make a new random code for a fresh shuffled board.
 * @param {() => number} [random]
 */
export function randomBoardCode(random = Math.random) {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return code;
}

/** Turn a (normalised) code into its number: 5 bits per character. */
function codeToSeed(/** @type {string} */ code) {
  let seed = 0;
  for (const ch of code) seed = seed * 32 + ALPHABET.indexOf(ch);
  return seed;
}

/**
 * mulberry32: a tiny, well-known seeded random-number generator. Each call
 * returns the next number in [0, 1), like Math.random, but the whole sequence
 * is decided by the seed. The bit-mixing constants come from its author; the
 * point here isn't how it mixes, just that it's repeatable.
 * @param {number} seed
 * @returns {() => number}
 */
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The same 64 numbers, shuffled by a board code.
 * @param {string} code a normalised code (see normalizeBoardCode)
 * @returns {number[]}
 */
export function shuffledLayout(code) {
  const random = mulberry32(codeToSeed(code));
  const layout = classicLayout();
  // Fisher–Yates: walk backwards, swapping each cell with a random earlier
  // one (or itself). Every ordering is equally likely.
  for (let i = layout.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [layout[i], layout[j]] = [layout[j], layout[i]];
  }
  return layout;
}

/**
 * The cells touching a cell, including diagonals: 3 in a corner, 5 on an
 * edge, 8 in the middle. Scoring counts how many of these are already wiped.
 * @param {number} index 0–63
 * @returns {number[]}
 */
export function neighbours(index) {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const result = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = row + dr;
      const c = col + dc;
      if ((dr !== 0 || dc !== 0) && r >= 0 && r < SIZE && c >= 0 && c < SIZE) result.push(r * SIZE + c);
    }
  }
  return result;
}
