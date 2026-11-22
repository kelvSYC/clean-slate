// @ts-check
// A deliberately tiny test runner.
//
// Clean Slate has no dependencies, so instead of a test framework we use these
// few functions. Test files call `test(name, fn)` to register a test, and
// tests/run.js calls `report()` once every test file has been imported.
//
// The same files run under two JavaScript engines:
//   - JavaScriptCore (`jsc`), which ships with macOS. It has no `console`,
//     only a global `print`, and `quit(n)` reports success in module mode.
//   - Node, which has `console` but no `print`.
// So we print with whichever exists, and signal failure the one way both
// engines agree on: an uncaught exception, which exits with a non-zero code.

/** @type {(...parts: unknown[]) => void} */
const say = /** @type {any} */ (globalThis).print ?? console.log;

/** @type {{ name: string, fn: () => void }[]} */
const tests = [];

/**
 * Register a test. Tests run when `report()` is called, not immediately.
 * @param {string} name
 * @param {() => void} fn
 */
export function test(name, fn) {
  tests.push({ name, fn });
}

/**
 * @param {boolean} condition
 * @param {string} [message]
 */
export function assert(condition, message = "assertion failed") {
  if (!condition) throw new Error(message);
}

/**
 * Strict equality (`===`).
 * @param {unknown} actual
 * @param {unknown} expected
 * @param {string} [message]
 */
export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message ? message + ": " : ""}expected ${show(expected)}, got ${show(actual)}`);
  }
}

/**
 * Structural equality for arrays, plain objects, Sets and Maps.
 * Sets are compared as sorted arrays, so their order never matters.
 * @param {unknown} actual
 * @param {unknown} expected
 * @param {string} [message]
 */
export function assertDeepEqual(actual, expected, message) {
  const a = show(actual);
  const e = show(expected);
  if (a !== e) throw new Error(`${message ? message + ": " : ""}expected ${e}, got ${a}`);
}

/** Turn a value into a stable string for comparison and error messages. */
function show(/** @type {unknown} */ value) {
  return JSON.stringify(value, (_key, v) => {
    if (v instanceof Set) return [...v].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
    if (v instanceof Map) return Object.fromEntries(v);
    return v;
  });
}

/** Run every registered test, print a summary, and throw if any failed. */
export function report() {
  let passed = 0;
  /** @type {string[]} */
  const failures = [];
  for (const { name, fn } of tests) {
    try {
      fn();
      passed++;
    } catch (error) {
      failures.push(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const line of failures) say(line);
  say(`${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) throw new Error(`${failures.length} test(s) failed`);
}
