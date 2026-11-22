// @ts-check
import { test, assert, assertEqual, assertDeepEqual } from "./harness.js";
import { makeableNumbers, canMake } from "../src/solver.js";

/** Every ordered roll of three dice: 6 × 6 × 6 = 216 of them. */
function allRolls() {
  const rolls = [];
  for (let a = 1; a <= 6; a++)
    for (let b = 1; b <= 6; b++)
      for (let c = 1; c <= 6; c++) rolls.push([a, b, c]);
  return rolls;
}

/** Evaluate a display expression with ordinary maths rules. */
function evaluate(/** @type {string} */ expr) {
  const js = expr.replaceAll("×", "*").replaceAll("÷", "/").replaceAll("−", "-");
  return Function(`return (${js});`)();
}

/**
 * Evaluate strictly left to right, honouring brackets but ignoring the usual
 * "× before +" rule. If this agrees with `evaluate`, the expression reads
 * correctly the way a person reads it.
 */
function evaluateLeftToRight(/** @type {string} */ expr) {
  const tokens = expr.match(/\d+|[-+×÷−()]/g) ?? [];
  let pos = 0;
  const atom = () => {
    const token = tokens[pos++];
    if (token === "(") {
      const value = sequence();
      pos++; // skip ")"
      return value;
    }
    return Number(token);
  };
  const sequence = () => {
    let value = atom();
    while (pos < tokens.length && tokens[pos] !== ")") {
      const op = tokens[pos++];
      const right = atom();
      if (op === "+") value += right;
      else if (op === "−") value -= right;
      else if (op === "×") value *= right;
      else value /= right;
    }
    return value;
  };
  return sequence();
}

test("example roll from the original", () => {
  const made = makeableNumbers([3, 2, 6]);
  for (const n of [4, 7, 24, 36, 6, 18, 1, 12, 9, 11]) assert(made.has(n), `can't make ${n}`);
});

test("every expression evaluates to its number", () => {
  for (const roll of [[3, 2, 6], [1, 1, 1], [6, 6, 6], [5, 4, 1]]) {
    for (const [n, expr] of makeableNumbers(roll)) assertEqual(evaluate(expr), n, expr);
  }
});

test("division must come out whole", () => {
  for (const roll of allRolls()) {
    for (const n of makeableNumbers(roll).keys()) assert(Number.isInteger(n), `${n} from ${roll}`);
  }
  for (const expr of makeableNumbers([5, 2, 1]).values()) assert(!expr.includes("5 ÷ 2"), expr);
  assert(canMake([5, 2, 1], 3));
});

test("results are positive", () => {
  for (const roll of allRolls()) {
    for (const n of makeableNumbers(roll).keys()) assert(n > 0, `${n} from ${roll}`);
  }
});

test("uses all three dice", () => {
  assert(makeableNumbers([6, 1, 1]).has(6));
  for (const expr of makeableNumbers([3, 2, 6]).values()) {
    const digits = (expr.match(/\d/g) ?? []).sort().join("");
    assertEqual(digits, "236", expr);
  }
});

test("rare numbers come from exactly one roll", () => {
  for (const n of [64, 125, 216]) {
    const count = allRolls().filter((roll) => canMake(roll, n)).length;
    assertEqual(count, 1, `rolls making ${n}`);
  }
});

test("easiest expression wins", () => {
  assertDeepEqual(makeableNumbers([3, 2, 6]), new Map([
    [1, "6 − 3 − 2"], [4, "6 ÷ 3 + 2"], [5, "6 − 3 + 2"], [6, "6 ÷ 2 + 3"],
    [7, "6 + 3 − 2"], [9, "6 × 2 − 3"], [11, "6 + 3 + 2"], [12, "3 × 2 + 6"],
    [15, "6 × 2 + 3"], [16, "6 × 3 − 2"], [18, "(6 + 3) × 2"], [20, "6 × 3 + 2"],
    [24, "(6 + 2) × 3"], [30, "(3 + 2) × 6"], [36, "6 × 3 × 2"],
  ]));
});

test("prefers no negative steps on a tie", () => {
  // "4 − 6 + 4" and "4 + 4 − 6" cost the same, but the first goes through −2.
  assertEqual(makeableNumbers([4, 6, 4]).get(2), "4 + 4 − 6");
});

test("reads left to right", () => {
  for (const roll of allRolls()) {
    for (const [n, expr] of makeableNumbers(roll)) assertEqual(evaluateLeftToRight(expr), n, expr);
  }
});

test("per-step and final-only whole division agree", () => {
  // Re-solve with exact fractions [numerator, denominator], allowing any
  // division, and keep only the final answers that are positive integers.
  /** @param {number[]} x @param {number[]} y */
  const combine = ([a, b], [c, d]) => {
    const out = [[a * d + c * b, b * d], [a * d - c * b, b * d], [a * c, b * d]];
    if (c !== 0) out.push([a * d, b * c]);
    return out;
  };
  for (const roll of allRolls()) {
    const finals = new Set();
    for (const [i, j, k] of [[0, 1, 2], [1, 0, 2], [0, 2, 1], [2, 0, 1], [1, 2, 0], [2, 1, 0]]) {
      const third = [roll[k], 1];
      for (const pair of combine([roll[i], 1], [roll[j], 1])) {
        for (const [num, den] of [...combine(pair, third), ...combine(third, pair)]) {
          if (den !== 0 && num % den === 0 && num / den > 0) finals.add(num / den);
        }
      }
    }
    assertDeepEqual(new Set(makeableNumbers(roll).keys()), finals, `roll ${roll}`);
  }
});
