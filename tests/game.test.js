// @ts-check
import { test, assert, assertEqual, assertDeepEqual } from "./harness.js";
import { makeableNumbers } from "../src/solver.js";
import { classicLayout, shuffledLayout } from "../src/board.js";
import { newGame, roll, wipe, pass, checkPass, makeableCells, pointsFor, results } from "../src/game.js";

/** @typedef {import("../src/game.js").GameState} GameState */

const THREE = [{ name: "Ada", color: 0 }, { name: "Brook", color: 1 }, { name: "Cy", color: 2 }];

/** A classic-board game for three, with any options overridden. */
function start(/** @type {any} */ options = {}) {
  return newGame({ players: THREE, boardCode: null, ...options });
}

/** Apply actions in turn: play(state, s => roll(s, [3, 2, 6]), s => pass(s)). */
function play(/** @type {GameState} */ state, /** @type {((s: GameState) => GameState)[]} */ ...actions) {
  return actions.reduce((s, action) => action(s), state);
}

/** The cell index holding number n on the classic board. */
const cellOf = (/** @type {number} */ n) => classicLayout().indexOf(n);

/** A copy of the state with these cells already wiped by `player`. */
function withWiped(/** @type {GameState} */ state, /** @type {number[]} */ cells, player = 0) {
  const owner = [...state.owner];
  for (const cell of cells) owner[cell] = player;
  return { ...state, owner };
}

// ---- Setup ----------------------------------------------------------------

test("new game defaults", () => {
  const s = start();
  assertEqual(s.passLimit, 6);
  assertEqual(s.aid, true);
  assertEqual(s.stage, "roll");
  assertEqual(s.current, 0);
  assertEqual(s.passesInARow, 0);
  assertDeepEqual(s.layout, classicLayout());
  assertDeepEqual(s.players.map((p) => p.score), [0, 0, 0]);
});

test("pass limit is kept between 1 and 20", () => {
  assertEqual(start({ passLimit: 0 }).passLimit, 1);
  assertEqual(start({ passLimit: 99 }).passLimit, 20);
});

test("empty names get a default", () => {
  const s = newGame({ players: [{ name: "Ada", color: 0 }, { name: "  ", color: 1 }], boardCode: null });
  assertEqual(s.players[1].name, "Player 2");
});

test("player count must be 1 to 8", () => {
  for (const count of [0, 9]) {
    const players = Array.from({ length: count }, (_, i) => ({ name: `P${i}`, color: i % 8 }));
    let threw = false;
    try { newGame({ players, boardCode: null }); } catch { threw = true; }
    assert(threw, `${count} players accepted`);
  }
});

test("a board code gives the shuffled layout", () => {
  const s = start({ boardCode: "K7Q2MX" });
  assertDeepEqual(s.layout, shuffledLayout("K7Q2MX"));
  assertEqual(s.boardCode, "K7Q2MX");
});

// ---- Turn stages --------------------------------------------------------

test("nothing happens before the roll", () => {
  const s = start();
  assert(wipe(s, cellOf(11)) === s, "wiped before rolling");
  assert(pass(s) === s, "passed before rolling");
});

test("you can't roll twice (double click)", () => {
  const rolled = roll(start(), [3, 2, 6]);
  assertEqual(rolled.stage, "choose");
  assertDeepEqual(rolled.dice, [3, 2, 6]);
  assert(roll(rolled, [3, 2, 6]) === rolled, "rolled twice");
  assert(roll(rolled, [1, 1, 1]) === rolled, "re-rolled with new dice");
});

test("nothing happens after the game is over", () => {
  const over = play(start({ passLimit: 1, aid: false }), (s) => roll(s, [3, 2, 6]), (s) => pass(s));
  assertEqual(over.stage, "over");
  assert(roll(over, [1, 1, 1]) === over);
  assert(wipe(over, 0) === over);
  assert(pass(over) === over);
});

// ---- Wiping and scoring ---------------------------------------------------

test("wiping a number", () => {
  const s = roll(start(), [3, 2, 6]);
  const after = wipe({ ...s, passesInARow: 3 }, cellOf(24));
  assertEqual(after.owner[cellOf(24)], 0);
  assertEqual(after.players[0].score, 1);
  assertEqual(after.passesInARow, 0);
  assertEqual(after.current, 1);
  assertEqual(after.stage, "roll");
  assertEqual(after.dice, null);
  assertDeepEqual(after.lastEvent, {
    kind: "wipe", player: 0, number: 24, expression: makeableNumbers([3, 2, 6]).get(24), points: 1,
  });
});

test("wiping doesn't change the state it was given", () => {
  const s = roll(start(), [3, 2, 6]);
  const before = JSON.stringify(s);
  wipe(s, cellOf(24));
  assertEqual(JSON.stringify(s), before);
});

test("scoring counts wiped neighbours", () => {
  const empty = Array(64).fill(null);
  const owned = (/** @type {number[]} */ cells) => empty.map((_, i) => (cells.includes(i) ? 1 : null));
  assertEqual(pointsFor(empty, 0), 1);
  assertEqual(pointsFor(owned([1, 8, 9]), 0), 4);
  assertEqual(pointsFor(owned([2, 4, 10, 11, 12]), 3), 6);
  assertEqual(pointsFor(owned([18, 19, 20, 26, 28, 34, 35, 36]), 27), 9);
});

test("a wipe next to earlier wipes scores more", () => {
  const s = withWiped(roll(start(), [3, 2, 6]), [cellOf(23), cellOf(32)]);
  // 24 sits between 23 (left) and 32 (below) on the classic board.
  assertEqual(wipe(s, cellOf(24)).players[0].score, 3);
});

// ---- Move aid on ----------------------------------------------------------

test("aid on: numbers you can't make are blocked", () => {
  const s = roll(start(), [3, 2, 6]);
  assert(wipe(s, cellOf(100)) === s, "unmakeable number accepted");
});

test("aid on: no passing while a move exists", () => {
  const s = roll(start(), [3, 2, 6]);
  assertEqual(checkPass(s), false);
  assert(pass(s) === s, "passed with moves available");
});

test("aid on: passing when there's no move", () => {
  // 6, 6, 6 makes only these numbers; wipe them all first.
  const sixes = [2, 5, 6, 7, 18, 30, 42, 72, 216];
  assertDeepEqual([...makeableNumbers([6, 6, 6]).keys()], sixes);
  const s = roll(withWiped(start(), sixes.map(cellOf), 2), [6, 6, 6]);
  assertDeepEqual(makeableCells(s), []);
  assertEqual(checkPass(s), true);
  const after = pass(s);
  assertEqual(after.passesInARow, 1);
  assertEqual(after.players[0].score, 0);
  assertEqual(after.current, 1);
  assertDeepEqual(after.lastEvent, { kind: "pass", player: 0 });
});

test("makeable cells are the open cells the dice can make", () => {
  const s = withWiped(roll(start(), [3, 2, 6]), [cellOf(24)]);
  const expected = [...makeableNumbers([3, 2, 6]).keys()].filter((n) => n !== 24).map(cellOf);
  assertDeepEqual(makeableCells(s), expected);
  assertDeepEqual(makeableCells(start()), [], "before rolling");
});

// ---- Move aid off ---------------------------------------------------------

test("aid off: a wrong number is an illegal move", () => {
  const s = roll(start({ aid: false }), [3, 2, 6]);
  const after = wipe(s, cellOf(100));
  assertEqual(after.players[0].score, -1);
  assertEqual(after.owner[cellOf(100)], null);
  assertEqual(after.passesInARow, 1);
  assertEqual(after.current, 1);
  assertDeepEqual(after.lastEvent, { kind: "illegal", player: 0, number: 100 });
});

test("aid off: passing with a move available is an illegal move", () => {
  const s = roll(start({ aid: false }), [3, 2, 6]);
  const after = pass(s);
  assertEqual(after.players[0].score, -1);
  assertEqual(after.passesInARow, 1);
  assertEqual(after.current, 1);
  assertDeepEqual(after.lastEvent, { kind: "illegal", player: 0, number: null });
});

test("aid off: clicking a wiped cell is ignored, not penalised", () => {
  const s = withWiped(roll(start({ aid: false }), [3, 2, 6]), [cellOf(24)], 1);
  assert(wipe(s, cellOf(24)) === s);
});

// ---- Ending ---------------------------------------------------------------

test("the game ends after the pass limit", () => {
  const s = start({ passLimit: 2, aid: false });
  const after = play(s, (s) => roll(s, [3, 2, 6]), (s) => pass(s), (s) => roll(s, [3, 2, 6]), (s) => wipe(s, cellOf(100)));
  assertEqual(after.passesInARow, 2);
  assertEqual(after.stage, "over");
});

test("a wipe resets the passes in a row", () => {
  const s = start({ passLimit: 2, aid: false });
  const after = play(s,
    (s) => roll(s, [3, 2, 6]), (s) => pass(s),
    (s) => roll(s, [3, 2, 6]), (s) => wipe(s, cellOf(11)),
    (s) => roll(s, [3, 2, 6]), (s) => pass(s));
  assertEqual(after.passesInARow, 1);
  assertEqual(after.stage, "roll");
});

test("clearing the board ends the game at once", () => {
  const allButFirst = Array.from({ length: 63 }, (_, i) => i + 1);
  const s = roll(withWiped(start(), allButFirst, 1), [1, 1, 1]);
  const after = wipe(s, 0); // the number 1: 1 × 1 × 1
  assertEqual(after.stage, "over");
  assertEqual(after.passesInARow, 0);
});

// ---- Solo and results ----------------------------------------------------

test("solo: you keep the turn, and the pass limit still ends the game", () => {
  const s = newGame({ players: [{ name: "Ada", color: 0 }], boardCode: null, passLimit: 2 });
  const mid = play(s, (s) => roll(s, [3, 2, 6]), (s) => wipe(s, cellOf(11)));
  assertEqual(mid.current, 0);
  const sixes = [2, 5, 6, 7, 18, 30, 42, 72, 216].map(cellOf);
  const stuck = withWiped(mid, sixes, 0);
  const over = play(stuck, (s) => roll(s, [6, 6, 6]), (s) => pass(s), (s) => roll(s, [6, 6, 6]), (s) => pass(s));
  assertEqual(over.stage, "over");
  assertEqual(results(over).cleared, 10);
});

test("results rank players and share ties", () => {
  const s = start();
  const scored = { ...s, players: s.players.map((p, i) => ({ ...p, score: [5, 7, 7][i] })) };
  const r = results(scored);
  assertDeepEqual(r.winners, [1, 2]);
  assertDeepEqual(r.ranking.map((x) => x.player), [1, 2, 0]);
  assertEqual(r.cleared, 0);
});
