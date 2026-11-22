// @ts-check
import { test, assert, assertEqual, assertDeepEqual } from "./harness.js";
import { makeableNumbers } from "../src/solver.js";
import {
  BOARD_NUMBERS, SIZE, classicLayout, shuffledLayout, randomBoardCode,
  normalizeBoardCode, formatBoardCode, neighbours,
} from "../src/board.js";

const sorted = (/** @type {number[]} */ list) => [...list].sort((a, b) => a - b);

test("board is exactly what three dice can make", () => {
  const union = new Set();
  for (let a = 1; a <= 6; a++)
    for (let b = 1; b <= 6; b++)
      for (let c = 1; c <= 6; c++)
        for (const n of makeableNumbers([a, b, c]).keys()) union.add(n);
  assertEqual(BOARD_NUMBERS.length, 64);
  assertEqual(SIZE * SIZE, 64);
  assertDeepEqual(union, new Set(BOARD_NUMBERS));
});

test("classic layout", () => {
  const layout = classicLayout();
  assertEqual(layout[0], 1);
  assertEqual(layout[7], 8);
  assertEqual(layout[41], 42);
  assertEqual(layout[42], 44);
  assertEqual(layout[63], 216);
});

test("shuffle is reproducible", () => {
  const a = shuffledLayout("K7Q2MX");
  assertDeepEqual(a, shuffledLayout("K7Q2MX"));
  assert(JSON.stringify(a) !== JSON.stringify(shuffledLayout("K7Q2MY")), "different codes, same layout");
  assert(JSON.stringify(a) !== JSON.stringify(classicLayout()), "shuffle left the board in order");
  assertDeepEqual(sorted(a), [...BOARD_NUMBERS]);
});

test("codes normalise", () => {
  assertEqual(normalizeBoardCode("abc-def"), "ABCDEF");
  assertEqual(normalizeBoardCode(" ab cd ef "), "ABCDEF");
  assertEqual(normalizeBoardCode("oIl0Lo"), "011010");
});

test("bad codes are rejected", () => {
  for (const bad of ["XYZ", "", "ABCDEFG", "ABCDE!", "UUUUUU"]) {
    assertEqual(normalizeBoardCode(bad), null, JSON.stringify(bad));
  }
});

test("random codes are valid", () => {
  for (let i = 0; i < 100; i++) {
    const code = randomBoardCode();
    assertEqual(normalizeBoardCode(code), code);
  }
});

test("codes display in two halves", () => {
  assertEqual(formatBoardCode("ABCDEF"), "ABC-DEF");
});

test("neighbours", () => {
  assertDeepEqual(sorted(neighbours(0)), [1, 8, 9]);
  assertEqual(neighbours(7).length, 3);
  assertEqual(neighbours(3).length, 5);
  assertEqual(neighbours(27).length, 8);
  assertDeepEqual(sorted(neighbours(63)), [54, 55, 62]);
});
