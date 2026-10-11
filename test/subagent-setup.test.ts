import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import * as subagentsModule from "../pi-extension/subagents/index.ts";

const tempDirectories: string[] = [];

function makeTempDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "cmuxagent-setup-"));
  tempDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function saveModelSetup(input: Record<string, unknown>) {
  return (subagentsModule as any).__test__.saveModelSetup(input);
}

const selections = {
  scout: "provider/scout",
  researcher: null,
  worker: "provider/worker",
};

test("global setup writes the injected home cmuxagent config", () => {
  const root = makeTempDirectory();
  const homeDirectory = join(root, "home");
  const result = saveModelSetup({
    scope: "global",
    selections,
    homeDirectory,
    cwd: join(root, "project"),
    trustedProject: false,
  });
  const configPath = join(homeDirectory, ".pi", "cmuxagent", "config.json");

  assert.deepEqual(result, { ok: true, path: configPath });
  assert.deepEqual(JSON.parse(readFileSync(configPath, "utf8")), {
    models: { scout: "provider/scout", worker: "provider/worker" },
  });
});

test("trusted project setup writes only the project cmuxagent config", () => {
  const root = makeTempDirectory();
  const cwd = join(root, "project");
  const homeDirectory = join(root, "home");
  const result = saveModelSetup({
    scope: "project",
    selections,
    homeDirectory,
    cwd,
    trustedProject: true,
  });
  const projectPath = join(cwd, ".pi", "cmuxagent", "config.json");

  assert.deepEqual(result, { ok: true, path: projectPath });
  assert.equal(existsSync(projectPath), true);
  assert.equal(existsSync(join(homeDirectory, ".pi", "cmuxagent", "config.json")), false);
});

test("untrusted project setup refuses without writing", () => {
  const root = makeTempDirectory();
  const cwd = join(root, "project");

  assert.deepEqual(saveModelSetup({
    scope: "project",
    selections,
    homeDirectory: join(root, "home"),
    cwd,
    trustedProject: false,
  }), { ok: false, reason: "untrusted-project" });
  assert.equal(existsSync(join(cwd, ".pi", "cmuxagent", "config.json")), false);
});

test("inheritance removes one override and preserves unrelated valid overrides", () => {
  const root = makeTempDirectory();
  const homeDirectory = join(root, "home");
  const configPath = join(homeDirectory, ".pi", "cmuxagent", "config.json");
  mkdirSync(join(homeDirectory, ".pi", "cmuxagent"), { recursive: true });
  writeFileSync(configPath, JSON.stringify({
    models: {
      scout: "provider/old-scout",
      researcher: "provider/researcher",
      worker: "provider/old-worker",
    },
  }));

  saveModelSetup({
    scope: "global",
    selections: {
      scout: "provider/new-scout",
      researcher: "provider/researcher",
      worker: null,
    },
    homeDirectory,
    cwd: join(root, "project"),
    trustedProject: false,
  });

  assert.deepEqual(JSON.parse(readFileSync(configPath, "utf8")), {
    models: {
      scout: "provider/new-scout",
      researcher: "provider/researcher",
    },
  });
});

test("cancelled setup leaves an existing config unchanged", () => {
  const root = makeTempDirectory();
  const homeDirectory = join(root, "home");
  const configPath = join(homeDirectory, ".pi", "cmuxagent", "config.json");
  mkdirSync(join(homeDirectory, ".pi", "cmuxagent"), { recursive: true });
  const original = `${JSON.stringify({ models: { scout: "provider/original" } }, null, 2)}\n`;
  writeFileSync(configPath, original);

  assert.deepEqual(saveModelSetup({
    scope: "global",
    selections: { scout: "provider/replacement", researcher: null },
    homeDirectory,
    cwd: join(root, "project"),
    trustedProject: false,
  }), { ok: false, reason: "cancelled" });
  assert.equal(readFileSync(configPath, "utf8"), original);
});
