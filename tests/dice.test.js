// @ts-check
import { test, assert, assertEqual, assertDeepEqual } from "./harness.js";
import { rollDie, rollDice } from "../src/dice.js";

/** A fake `Math.random` that returns the given values in turn. */
function sequence(/** @type {number[]} */ ...values) {
  let i = 0;
  return () => values[i++];
}

test("rollDie maps the random range onto 1..6", () => {
  assertEqual(rollDie(() => 0), 1);
  assertEqual(rollDie(() => 0.9999), 6);
  assertEqual(rollDie(() => 0.5), 4);
});

test("rollDice returns three dice", () => {
  assertDeepEqual(rollDice(sequence(0, 0.5, 0.9999)), [1, 4, 6]);
});

test("rollDice stays in range", () => {
  for (let i = 0; i < 1000; i++) {
    for (const die of rollDice()) {
      assert(Number.isInteger(die) && die >= 1 && die <= 6, `bad die ${die}`);
    }
  }
});
