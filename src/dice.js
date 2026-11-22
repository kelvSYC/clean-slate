// @ts-check
// Rolling dice.
//
// This is the first file to read. It's tiny, but it shows a pattern used
// throughout Clean Slate: anything random takes the random-number source as
// an optional argument. The game passes nothing and gets `Math.random`; the
// tests pass a fake that returns chosen values, so a "random" roll becomes
// predictable and testable.

/**
 * Roll one six-sided die.
 * `random()` returns a number in [0, 1); scaling by 6 and rounding down
 * gives 0..5, and adding 1 gives a die face 1..6, each equally likely.
 * @param {() => number} [random]
 * @returns {number}
 */
export function rollDie(random = Math.random) {
  return Math.floor(random() * 6) + 1;
}

/**
 * Roll the three dice for a turn.
 * @param {() => number} [random]
 * @returns {[number, number, number]}
 */
export function rollDice(random = Math.random) {
  return [rollDie(random), rollDie(random), rollDie(random)];
}
