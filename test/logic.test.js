import { test } from "node:test";
import assert from "node:assert/strict";
import { band, distance, isValidPoint, randomCode } from "../src/logic.js";

test("distance is measured in galaxy widths", () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 1, y: 0 }), 1);
  // Full height of a 4:3 galaxy is 0.75 widths.
  assert.equal(distance({ x: 0, y: 0 }, { x: 0, y: 1 }), 0.75);
});

test("bands", () => {
  assert.equal(band({ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.5 }), "close");
  assert.equal(band({ x: 0.1, y: 0.5 }, { x: 0.6, y: 0.5 }), "medium");
  assert.equal(band({ x: 0, y: 0 }, { x: 1, y: 1 }), "far");
  // Opposite short edges of the galaxy are only 0.75 widths apart: still far.
  assert.equal(band({ x: 0.5, y: 0 }, { x: 0.5, y: 1 }), "far");
});

test("point validation", () => {
  assert.ok(isValidPoint({ x: 0, y: 1 }));
  assert.ok(!isValidPoint({ x: -0.1, y: 0.5 }));
  assert.ok(!isValidPoint({ x: "0.5", y: 0.5 }));
  assert.ok(!isValidPoint({ x: NaN, y: 0.5 }));
  assert.ok(!isValidPoint(null));
});

test("room codes", () => {
  assert.match(randomCode(), /^[A-Z0-9]{6}$/);
});
