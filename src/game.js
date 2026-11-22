// @ts-check
// The rules of a game: turns, scoring, passing, and when it ends.
//
// The whole game is one plain object, the GameState. The page never changes it
// directly. Instead it calls an action (roll, wipe, pass), which takes the
// current state and returns the next one. Two consequences worth noticing:
//
//   - Actions never modify the state they're given; they build a new one.
//     So a test can keep the "before" state and compare.
//   - When an action isn't allowed, it returns the *same* object it was given.
//     `next === state` is how the tests and ui.js tell "nothing happened".
//
// Every action follows the same steps:
//   1. Is this the right moment? (stage guard: you can't pass before rolling)
//   2. Is it legal with these dice? (checkWipe / checkPass, the one legality check)
//   3. If not: with the move aid on, refuse; with it off, penalise.
//   4. Apply it, then endTurn.
//
// Used by: ui.js. Uses: solver.js (what the dice can make), board.js (layouts,
// neighbours).

import { makeableNumbers, canMake } from "./solver.js";
import { classicLayout, shuffledLayout, neighbours } from "./board.js";

/** @typedef {{ name: string, color: number, score: number }} Player */

/**
 * What just happened, for the "Last move" line.
 * @typedef {{ kind: "wipe", player: number, number: number, expression: string, points: number }
 *         | { kind: "pass", player: number }
 *         | { kind: "illegal", player: number, number: number | null }} GameEvent
 */

/**
 * @typedef {{
 *   players: Player[],
 *   layout: number[],             // the 64 numbers, row by row
 *   boardCode: string | null,     // null for the classic board
 *   owner: (number | null)[],     // per cell: the player who wiped it, or null
 *   current: number,              // whose turn it is (index into players)
 *   stage: "roll" | "choose" | "over",
 *   dice: number[] | null,        // null until this turn's roll
 *   passesInARow: number,         // turns in a row with no wipe
 *   passLimit: number,            // the game ends when passesInARow reaches this
 *   aid: boolean,                 // move aid on (block illegal moves) or off (penalise them)
 *   lastEvent: GameEvent | null,
 * }} GameState
 */

export const DEFAULT_PASS_LIMIT = 6;
export const MIN_PASS_LIMIT = 1;
export const MAX_PASS_LIMIT = 20;
export const MAX_PLAYERS = 8;

/**
 * Set up a new game.
 * @param {{ players: { name: string, color: number }[], boardCode: string | null, passLimit?: number, aid?: boolean }} options
 * @returns {GameState}
 */
export function newGame({ players, boardCode, passLimit = DEFAULT_PASS_LIMIT, aid = true }) {
  if (players.length < 1 || players.length > MAX_PLAYERS) {
    throw new Error(`A game needs 1 to ${MAX_PLAYERS} players, not ${players.length}`);
  }
  return {
    players: players.map((p, i) => ({ name: p.name.trim() || `Player ${i + 1}`, color: p.color, score: 0 })),
    layout: boardCode ? shuffledLayout(boardCode) : classicLayout(),
    boardCode,
    owner: Array(64).fill(null),
    current: 0,
    stage: "roll",
    dice: null,
    passesInARow: 0,
    passLimit: Math.min(MAX_PASS_LIMIT, Math.max(MIN_PASS_LIMIT, Math.round(passLimit))),
    aid,
    lastEvent: null,
  };
}

// ---- The one legality check ---------------------------------------------
//
// Both move-aid modes use these. The aid only changes what happens to an
// illegal move, never what counts as one.

/**
 * Cells that are still open and that this turn's dice can make.
 * @param {GameState} state
 * @returns {number[]}
 */
export function makeableCells(state) {
  if (state.stage !== "choose" || !state.dice) return [];
  const makeable = makeableNumbers(state.dice);
  return state.layout.flatMap((n, cell) => (state.owner[cell] === null && makeable.has(n) ? [cell] : []));
}

/**
 * Can the current player wipe this cell?
 * @param {GameState} state
 * @param {number} cell
 */
export function checkWipe(state, cell) {
  return state.stage === "choose" && state.dice !== null
    && state.owner[cell] === null && canMake(state.dice, state.layout[cell]);
}

/**
 * Can the current player pass? Only when there's no move at all.
 * @param {GameState} state
 */
export function checkPass(state) {
  return state.stage === "choose" && makeableCells(state).length === 0;
}

// ---- Scoring -------------------------------------------------------------

/**
 * Points for wiping a cell: 1, plus 1 for every neighbour already wiped.
 * The most possible is 9, in the middle of a fully wiped area.
 * @param {(number | null)[]} owner
 * @param {number} cell
 */
export function pointsFor(owner, cell) {
  return 1 + neighbours(cell).filter((n) => owner[n] !== null).length;
}

// ---- Actions -------------------------------------------------------------

/**
 * Throw the dice. The dice are passed in (ui.js uses rollDice()) so tests can
 * choose them.
 * @param {GameState} state
 * @param {number[]} dice
 * @returns {GameState}
 */
export function roll(state, dice) {
  if (state.stage !== "roll") return state; // e.g. a double click on Roll
  return { ...state, stage: "choose", dice: [...dice] };
}

/**
 * Try to wipe out a cell.
 * @param {GameState} state
 * @param {number} cell
 * @returns {GameState}
 */
export function wipe(state, cell) {
  // 1. Not a move at all: wrong stage, or a cell that's already gone.
  if (state.stage !== "choose" || !state.dice || state.owner[cell] !== null) return state;

  // 2–3. Illegal with these dice: refuse (aid on) or penalise (aid off).
  if (!checkWipe(state, cell)) {
    if (state.aid) return state;
    return penalise(state, state.layout[cell]);
  }

  // 4. Score it, mark it, and move on.
  const number = state.layout[cell];
  const points = pointsFor(state.owner, cell);
  const owner = [...state.owner];
  owner[cell] = state.current;
  return endTurn({
    ...state,
    owner,
    players: addScore(state.players, state.current, points),
    passesInARow: 0,
    lastEvent: {
      kind: "wipe", player: state.current, number,
      expression: /** @type {string} */ (makeableNumbers(state.dice).get(number)), points,
    },
  });
}

/**
 * Pass the turn. Only legal when no move exists.
 * @param {GameState} state
 * @returns {GameState}
 */
export function pass(state) {
  if (state.stage !== "choose") return state;
  if (!checkPass(state)) {
    // Refusing would tell an aid-off player "you have a move", so with the
    // aid off a wrong pass is penalised like any other illegal move.
    if (state.aid) return state;
    return penalise(state, null);
  }
  return endTurn({
    ...state,
    passesInARow: state.passesInARow + 1,
    lastEvent: { kind: "pass", player: state.current },
  });
}

/**
 * An illegal move (aid off only): lose a point, and it counts as a pass.
 * @param {GameState} state
 * @param {number | null} number the number clicked, or null for a wrong pass
 */
function penalise(state, number) {
  return endTurn({
    ...state,
    players: addScore(state.players, state.current, -1),
    passesInARow: state.passesInARow + 1,
    lastEvent: { kind: "illegal", player: state.current, number },
  });
}

/**
 * How a turn ends: clear the dice and hand over to the next player, unless
 * the game is over (too many passes in a row, or the board is clear).
 * @param {GameState} state
 * @returns {GameState}
 */
function endTurn(state) {
  const boardClear = state.owner.every((o) => o !== null);
  const outOfPasses = state.passesInARow >= state.passLimit;
  return {
    ...state,
    dice: null,
    stage: boardClear || outOfPasses ? "over" : "roll",
    current: (state.current + 1) % state.players.length,
  };
}

/** A copy of the players with one player's score changed. */
function addScore(/** @type {Player[]} */ players, /** @type {number} */ index, /** @type {number} */ points) {
  return players.map((p, i) => (i === index ? { ...p, score: p.score + points } : p));
}

// ---- Results -------------------------------------------------------------

/**
 * Final standings: players by score (highest first), everyone tied for the
 * top score as winners, and how many cells were cleared.
 * @param {GameState} state
 */
export function results(state) {
  const ranking = state.players
    .map((p, player) => ({ player, score: p.score }))
    .sort((a, b) => b.score - a.score || a.player - b.player);
  const top = ranking[0].score;
  return {
    ranking,
    winners: ranking.filter((r) => r.score === top).map((r) => r.player),
    cleared: state.owner.filter((o) => o !== null).length,
  };
}
