// @ts-check
// Entry point for the test suite: import every test file, then report.
// Files are listed by hand (no globbing) so this works in every engine.
import { report } from "./harness.js";
import "./dice.test.js";
import "./solver.test.js";
import "./board.test.js";

report();
