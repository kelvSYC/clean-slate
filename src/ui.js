// @ts-check
// The page: drawing the game and turning clicks into moves.
//
// This is the last file to read, and the only one that touches the page.
// Its job is small on purpose:
//
//   - It keeps the current GameState in one variable, `state`.
//   - When the player clicks, it calls an action from game.js (roll, wipe,
//     pass) and stores the state that comes back.
//   - `render()` then redraws everything from that state.
//
// The rules never live here. Whether a move is legal, what it scores, and
// when the game ends are all decided in game.js. This file only decides how
// that looks: which buttons are enabled, which cells are highlighted, and
// what the status line says.

import { rollDice } from "./dice.js";
import { SIZE, randomBoardCode, normalizeBoardCode, formatBoardCode } from "./board.js";
import {
  newGame, roll, wipe, pass, checkPass, makeableCells, results,
  DEFAULT_PASS_LIMIT, MIN_PASS_LIMIT, MAX_PASS_LIMIT, MAX_PLAYERS,
} from "./game.js";

/** @typedef {import("./game.js").GameState} GameState */

/** Names for the eight colour slots (the colours themselves are in style.css). */
const COLOR_NAMES = ["Red", "Blue", "Green", "Orange", "Purple", "Teal", "Pink", "Brown"];

/** The CSS colour for a colour slot 0–7. */
const playerColor = (/** @type {number} */ slot) => `var(--player-${slot + 1})`;

/** Find an element by id, with a clear error if the page and script disagree. */
function $(/** @type {string} */ id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id} in index.html`);
  return /** @type {any} */ (element);
}

// ---- Game view -----------------------------------------------------------

/** @type {GameState | null} */
let state = null;

/** The 64 cell buttons. Created once per game so keyboard focus survives redraws. */
/** @type {HTMLButtonElement[]} */
let cells = [];

/**
 * Run an action and redraw, unless it was refused (game.js returns the very
 * same object when nothing happened).
 * @param {(s: GameState) => GameState} action
 */
function act(action) {
  if (!state) return;
  const next = action(state);
  if (next === state) return;
  state = next;
  render();
}

function startGame(/** @type {GameState} */ fresh) {
  state = fresh;
  const board = $("board");
  board.replaceChildren();
  board.style.gridTemplateColumns = `repeat(${SIZE}, 52px)`;
  cells = state.layout.map((_, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.addEventListener("click", () => act((s) => wipe(s, index)));
    board.append(button);
    return button;
  });
  $("setup").hidden = true;
  $("game").hidden = false;
  render();
  $("roll").focus();
}

/** Redraw the whole game view from `state`. */
function render() {
  if (!state) return;
  const s = state;
  const player = s.players[s.current];
  const highlight = s.aid ? new Set(makeableCells(s)) : new Set();

  // The board.
  s.layout.forEach((number, i) => {
    const button = cells[i];
    const owner = s.owner[i];
    button.textContent = String(number);
    button.classList.remove("wiped", "makeable", "dim");
    button.style.removeProperty("--owner");
    if (owner !== null) {
      button.classList.add("wiped");
      button.style.setProperty("--owner", playerColor(s.players[owner].color));
      button.disabled = true;
      button.ariaLabel = `${number}, wiped by ${s.players[owner].name}`;
    } else if (s.stage !== "choose") {
      button.disabled = true;
      button.ariaLabel = `${number}, available`;
    } else if (s.aid) {
      // Aid on: only numbers you can make are clickable.
      const can = highlight.has(i);
      button.classList.add(can ? "makeable" : "dim");
      button.disabled = !can;
      button.ariaLabel = can ? `${number}, can make` : `${number}, available`;
    } else {
      // Aid off: any open number can be clicked, and no hints are given.
      button.disabled = false;
      button.ariaLabel = `${number}, available`;
    }
  });

  // Scores. Names are set with textContent, so a name can never become markup.
  $("scores").replaceChildren(...s.players.map((p, i) => {
    const item = document.createElement("li");
    if (i === s.current && s.stage !== "over") item.className = "current";
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = playerColor(p.color);
    const name = document.createElement("span");
    name.textContent = p.name + (i === s.current && s.stage !== "over" ? " ◂" : "");
    const score = document.createElement("span");
    score.className = "score";
    score.textContent = String(p.score);
    item.append(swatch, name, score);
    return item;
  }));

  // Passes left, as dots: worked out from passesInARow, never stored.
  const left = Math.max(0, s.passLimit - s.passesInARow);
  $("pass-dots").textContent = "●".repeat(left) + "○".repeat(s.passLimit - left);
  $("pass-dots").ariaLabel = `${left} of ${s.passLimit}`;

  // Dice.
  $("dice").replaceChildren(...[0, 1, 2].map((i) => {
    const die = document.createElement("span");
    die.className = s.dice ? "die" : "die empty";
    die.textContent = s.dice ? String(s.dice[i]) : "?";
    return die;
  }));
  $("dice").ariaLabel = s.dice ? `Dice: ${s.dice.join(", ")}` : "Dice not rolled yet";

  // Roll and Pass. With the aid off, Pass stays enabled while choosing,
  // so it never gives away whether a move exists.
  const canRoll = s.stage === "roll";
  const canPass = s.stage === "choose" && (s.aid ? checkPass(s) : true);
  $("roll").disabled = !canRoll;
  $("pass").disabled = !canPass;
  $("roll").classList.toggle("primary", canRoll);
  $("pass").classList.toggle("primary", s.stage === "choose" && s.aid && canPass);

  // Status and last move.
  $("status").textContent = statusText(s, player.name, highlight.size);
  $("last").textContent = lastMoveText(s);
  $("code").textContent = s.boardCode ? `Board code: ${formatBoardCode(s.boardCode)}` : "Classic board";
}

/**
 * @param {GameState} s
 * @param {string} name
 * @param {number} highlighted
 */
function statusText(s, name, highlighted) {
  if (s.stage === "over") {
    const r = results(s);
    if (s.players.length === 1) return `Game over: ${s.players[0].score} points, cleared ${r.cleared} of 64.`;
    const names = r.winners.map((w) => s.players[w].name);
    const top = r.ranking[0].score;
    return names.length === 1 ? `Game over: ${names[0]} wins with ${top}.` : `Game over: tie between ${names.join(" and ")} on ${top}.`;
  }
  if (s.stage === "roll") return `${name}'s turn: roll the dice.`;
  if (s.aid && highlighted === 0) return "No moves — pass.";
  return `${name}: pick a number.`;
}

function lastMoveText(/** @type {GameState} */ s) {
  const e = s.lastEvent;
  if (!e) return "";
  const who = s.players[e.player].name;
  switch (e.kind) {
    case "wipe": return `${who} wiped ${e.number} with ${e.expression} (+${e.points}).`;
    case "pass": return `${who} passed.`;
    case "illegal":
      return e.number === null
        ? `${who} passed with a move available (−1).`
        : `${who} picked ${e.number}, which those dice can't make (−1).`;
  }
}

$("roll").addEventListener("click", () => act((s) => roll(s, rollDice())));
$("pass").addEventListener("click", () => act(pass));
$("new-game").addEventListener("click", () => {
  if (state && state.stage !== "over" && !confirm("Abandon this game and start a new one?")) return;
  state = null;
  $("game").hidden = true;
  $("setup").hidden = false;
});

// ---- New-game form -------------------------------------------------------

/** Names and colours typed so far, kept when the player count changes. */
const drafts = Array.from({ length: MAX_PLAYERS }, (_, i) => ({ name: "", color: i }));

function renderPlayerRows() {
  const count = Number($("player-count").value);
  $("player-rows").replaceChildren(...drafts.slice(0, count).map((draft, i) => {
    const row = document.createElement("li");

    const name = document.createElement("input");
    name.type = "text";
    name.placeholder = `Player ${i + 1}`;
    name.ariaLabel = `Player ${i + 1} name`;
    name.maxLength = 20;
    name.value = draft.name;
    name.addEventListener("input", () => { draft.name = name.value; });

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = playerColor(draft.color);

    const color = document.createElement("select");
    color.ariaLabel = `Player ${i + 1} colour`;
    COLOR_NAMES.forEach((label, slot) => color.append(new Option(label, String(slot), false, slot === draft.color)));
    color.addEventListener("change", () => {
      draft.color = Number(color.value);
      swatch.style.background = playerColor(draft.color);
    });

    row.append(name, swatch, color);
    return row;
  }));
}

/** Read the form, or return an error message for the player to fix. */
function readForm() {
  const players = drafts.slice(0, Number($("player-count").value));
  if (new Set(players.map((p) => p.color)).size !== players.length) {
    return { error: "Each player needs a different colour." };
  }
  /** @type {string | null} */
  let boardCode = null;
  if (/** @type {HTMLInputElement} */ (document.querySelector("input[name=board]:checked")).value === "shuffled") {
    const typed = $("board-code").value.trim();
    boardCode = typed ? normalizeBoardCode(typed) : randomBoardCode();
    if (!boardCode) return { error: "That board code isn't valid. Codes are 6 letters or digits, like K7Q-2MX." };
  }
  const passLimit = Number($("pass-limit").value);
  if (!Number.isInteger(passLimit) || passLimit < MIN_PASS_LIMIT || passLimit > MAX_PASS_LIMIT) {
    return { error: `Passes in a row must be a whole number from ${MIN_PASS_LIMIT} to ${MAX_PASS_LIMIT}.` };
  }
  return { options: { players: players.map((p) => ({ ...p })), boardCode, passLimit, aid: $("aid").checked } };
}

$("player-count").addEventListener("change", renderPlayerRows);
$("board-code").addEventListener("input", () => {
  // Typing a code implies a shuffled board.
  if ($("board-code").value.trim()) /** @type {HTMLInputElement} */ (document.querySelector("input[value=shuffled]")).checked = true;
});
$("setup-form").addEventListener("submit", (/** @type {Event} */ event) => {
  event.preventDefault();
  const form = readForm();
  $("setup-error").textContent = form.error ?? "";
  if (form.options) startGame(newGame(form.options));
});

$("pass-limit").value = String(DEFAULT_PASS_LIMIT);
renderPlayerRows();
