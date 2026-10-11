import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import {
  loadModelOverrides,
  resolveModel,
  updateModelOverride,
  writeModelOverrides,
} from "../pi-extension/subagents/model-config.ts";

const tempDirectories: string[] = [];

function makeTempDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "cmuxagent-model-config-"));
  tempDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("missing and malformed model config load as empty overrides", () => {
  const directory = makeTempDirectory();
  const missing = join(directory, "missing.json");
  const malformed = join(directory, "malformed.json");
  writeFileSync(malformed, "{not-json", "utf8");

  assert.deepEqual(loadModelOverrides(missing), { models: {} });
  assert.deepEqual(loadModelOverrides(malformed), { models: {} });
});

test("model config retains only supported roles with string values", () => {
  const directory = makeTempDirectory();
  const configPath = join(directory, "config.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      models: {
        scout: "provider/scout",
        researcher: 42,
        worker: "provider/worker",
        administrator: "provider/admin",
      },
    }),
    "utf8",
  );

  assert.deepEqual(loadModelOverrides(configPath), {
    models: { scout: "provider/scout", worker: "provider/worker" },
  });
});

test("model config writer creates directories and writes formatted round-trippable JSON", () => {
  const directory = makeTempDirectory();
  const configPath = join(directory, "nested", "config.json");
  const overrides = { models: { scout: "provider/scout", worker: "provider/worker" } } as const;

  writeModelOverrides(configPath, overrides);

  assert.deepEqual(loadModelOverrides(configPath), overrides);
  assert.equal(readFileSync(configPath, "utf8"), `${JSON.stringify(overrides, null, 2)}\n`);
});

test("updating an inherited role removes its override without mutating the input", () => {
  const original = {
    models: { scout: "provider/scout", worker: "provider/worker" },
  } as const;

  const updated = updateModelOverride(original, "scout", undefined);

  assert.deepEqual(updated, { models: { worker: "provider/worker" } });
  assert.deepEqual(original, {
    models: { scout: "provider/scout", worker: "provider/worker" },
  });
});

test("model resolution follows explicit, project, global, profile, then parent precedence", () => {
  const candidates = {
    explicit: "provider/explicit",
    project: "provider/project",
    global: "provider/global",
    profile: "provider/profile",
    parent: "provider/parent",
    available: [
      "provider/explicit",
      "provider/project",
      "provider/global",
      "provider/profile",
      "provider/parent",
    ],
    trustedProject: true,
  };

  assert.deepEqual(resolveModel(candidates), {
    model: "provider/explicit",
    unavailable: [],
  });
  assert.deepEqual(resolveModel({ ...candidates, explicit: undefined }), {
    model: "provider/project",
    unavailable: [],
  });
  assert.deepEqual(resolveModel({ ...candidates, explicit: undefined, project: undefined }), {
    model: "provider/global",
    unavailable: [],
  });
  assert.deepEqual(
    resolveModel({ ...candidates, explicit: undefined, project: undefined, global: undefined }),
    { model: "provider/profile", unavailable: [] },
  );
  assert.deepEqual(
    resolveModel({
      ...candidates,
      explicit: undefined,
      project: undefined,
      global: undefined,
      profile: undefined,
    }),
    { model: "provider/parent", unavailable: [] },
  );
});

test("unavailable models are deduplicated and skipped in precedence order", () => {
  assert.deepEqual(
    resolveModel({
      explicit: "provider/missing-a",
      project: "provider/missing-a",
      global: "provider/missing-b",
      profile: "provider/available",
      parent: "provider/parent",
      available: ["provider/available", "provider/parent"],
      trustedProject: true,
    }),
    {
      model: "provider/available",
      unavailable: ["provider/missing-a", "provider/missing-b"],
    },
  );
});

test("untrusted project models are ignored without being reported unavailable", () => {
  assert.deepEqual(
    resolveModel({
      project: "provider/untrusted",
      global: "provider/global",
      parent: "provider/parent",
      available: ["provider/global", "provider/parent"],
      trustedProject: false,
    }),
    { model: "provider/global", unavailable: [] },
  );
});
