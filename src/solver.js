// @ts-check
// Which numbers can three dice make?
//
// The rule: use all three dice, each exactly once, with + − × ÷ and any
// brackets. Division must come out whole, and the answer must be positive.
//
// HOW: try everything. Any such expression has the same shape: two dice are
// combined first (the "pair"), then the pair is combined with the third die.
// So we try every order of the three dice (6 orders), every way to combine
// the first two (4 operators), and every way to bring in the third
// (4 operators, with the pair on the left or the right). That's a few hundred
// cases, which a computer checks instantly, and no case can be missed.
//
// Along the way we remember *how* each number was made, so the game can show
// it ("(6 + 2) × 3 = 24"). Many expressions make the same number, so we keep
// the easiest one, using the effort table below.
//
// Used by: board.js's tests (the board is exactly what three dice can make)
// and game.js (which moves are legal, and what to show after a wipe).

/**
 * How hard each operator feels. Addition is easiest, then multiplication,
 * then subtraction, then division. Brackets cost extra too.
 * Change these numbers and the game will show different expressions.
 */
export const OPERATOR_EFFORT = { "+": 1, "×": 2, "−": 3, "÷": 4 };
export const BRACKET_EFFORT = 2;

/** @typedef {"+" | "×" | "−" | "÷"} Operator */

/**
 * One way of making a number.
 * @typedef {{ value: number, text: string, ops: [Operator, Operator], brackets: boolean }} Candidate
 */

/**
 * Apply an operator, or return null when it isn't allowed
 * (a division that doesn't come out whole).
 * @param {number} a
 * @param {Operator} op
 * @param {number} b
 * @returns {number | null}
 */
function apply(a, op, b) {
  switch (op) {
    case "+": return a + b;
    case "×": return a * b;
    case "−": return a - b;
    case "÷": return b !== 0 && a % b === 0 ? a / b : null;
  }
}

/** @type {Operator[]} */
const OPERATORS = ["+", "×", "−", "÷"];

/** The 6 orders of three things, as index lists. */
const ORDERS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

/**
 * Every way to make a positive whole number from three dice.
 * @param {number[]} dice
 * @returns {Candidate[]}
 */
function allCandidates(dice) {
  /** @type {Candidate[]} */
  const found = [];
  for (const [i, j, k] of ORDERS) {
    const [x, y, z] = [dice[i], dice[j], dice[k]];
    for (const inner of OPERATORS) {
      const pair = apply(x, inner, y);
      if (pair === null) continue;
      const pairText = `${x} ${inner} ${y}`;
      for (const outer of OPERATORS) {
        // The pair always goes first, so the expression reads left to right:
        // "3 × 2 + 6", never "6 + 3 × 2". Only − and ÷ care about order, so
        // only they also get the pair on the right, inside brackets:
        // "6 − (3 − 2)".
        const sides = outer === "−" || outer === "÷" ? ["left", "right"] : ["left"];
        for (const side of sides) {
          const value = side === "left" ? apply(pair, outer, z) : apply(z, outer, pair);
          if (value === null || value <= 0) continue;
          // Brackets are needed when an addition or subtraction must happen
          // before a multiplication or division, or when the pair is on the right.
          const brackets = side === "right" || ((inner === "+" || inner === "−") && (outer === "×" || outer === "÷"));
          const shownPair = brackets ? `(${pairText})` : pairText;
          const text = side === "left" ? `${shownPair} ${outer} ${z}` : `${z} ${outer} ${shownPair}`;
          found.push({ value, text, ops: [inner, outer], brackets });
        }
      }
    }
  }
  return found;
}

/**
 * How hard an expression is to follow. Lower is easier.
 * @param {Candidate} candidate
 */
export function effort(candidate) {
  const [inner, outer] = candidate.ops;
  return OPERATOR_EFFORT[inner] + OPERATOR_EFFORT[outer] + (candidate.brackets ? BRACKET_EFFORT : 0);
}

/**
 * Pick the easier of two ways to make the same number:
 *   1. lower effort;
 *   2. then no brackets;
 *   3. then larger digits first ("6 + 3 + 2" over "2 + 3 + 6"), which also
 *      makes the choice deterministic.
 * @param {Candidate} a
 * @param {Candidate} b
 * @returns {Candidate}
 */
export function pickExpression(a, b) {
  if (effort(a) !== effort(b)) return effort(a) < effort(b) ? a : b;
  if (a.brackets !== b.brackets) return a.brackets ? b : a;
  const digits = (/** @type {Candidate} */ c) => c.text.replace(/\D/g, "");
  return digits(a) >= digits(b) ? a : b;
}

/**
 * Every number the dice can make, with the easiest expression for each,
 * in ascending order.
 * @param {number[]} dice
 * @returns {Map<number, string>}
 */
export function makeableNumbers(dice) {
  /** @type {Map<number, Candidate>} */
  const best = new Map();
  for (const candidate of allCandidates(dice)) {
    const current = best.get(candidate.value);
    best.set(candidate.value, current ? pickExpression(current, candidate) : candidate);
  }
  const numbers = [...best.keys()].sort((p, q) => p - q);
  return new Map(numbers.map((n) => [n, /** @type {Candidate} */ (best.get(n)).text]));
}

/**
 * Can these dice make `n`?
 * @param {number[]} dice
 * @param {number} n
 */
export function canMake(dice, n) {
  return makeableNumbers(dice).has(n);
}
