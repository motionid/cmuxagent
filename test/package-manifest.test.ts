import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import manifest from "../package.json" with { type: "json" };

test("declares the consolidated cmuxagent Pi package", () => {
  assert.equal(manifest.name, "cmuxagent");
  assert.equal(manifest.version, "3.7.2");
  assert.equal(manifest.private, true);
  assert.equal(manifest.repository.url, "git+https://github.com/motionid/cmuxagent.git");
  assert.deepEqual(manifest.pi.extensions, ["./pi-extension/subagents/index.ts"]);
  assert.equal(manifest.keywords.includes("pi-package"), true);
  assert.equal(manifest.scripts.test, "node --test test/test.ts test/*.test.ts");
  assert.equal(manifest.scripts.typecheck, "tsc --noEmit");
});

test("documents the consolidated checkout and portable model setup", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

  for (const requiredText of [
    "# cmuxagent",
    "/subagent-setup",
    "~/.pi/cmuxagent/config.json",
    ".pi/cmuxagent/config.json",
    "amosblomqvist/pi-interactive-subagents",
    "/Users/sean/Documents/cmuxagent",
  ]) {
    assert.match(readme, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(readme, /\/Users\/sean\/pi-interactive-subagents/);
});
