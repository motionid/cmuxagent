import assert from "node:assert/strict";
import test from "node:test";
import manifest from "../package.json" with { type: "json" };

test("declares the Pi subagent extension", () => {
  assert.deepEqual(manifest.pi.extensions, ["./pi-extension/subagents/index.ts"]);
  assert.equal(manifest.private, true);
  assert.equal(manifest.keywords.includes("pi-package"), true);
});