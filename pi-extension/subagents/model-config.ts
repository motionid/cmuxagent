import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const BUNDLED_AGENT_ROLES = ["scout", "researcher", "worker"] as const;

export type BundledAgentRole = (typeof BUNDLED_AGENT_ROLES)[number];

export interface ModelOverrides {
  models: Partial<Record<BundledAgentRole, string>>;
}

export interface ResolutionParams {
  explicit?: string;
  project?: string;
  global?: string;
  profile?: string;
  parent?: string;
  available: readonly string[];
  trustedProject: boolean;
}

export interface ModelResolution {
  model?: string;
  unavailable: string[];
}

function isBundledAgentRole(value: string): value is BundledAgentRole {
  return (BUNDLED_AGENT_ROLES as readonly string[]).includes(value);
}

export function loadModelOverrides(configPath: string): ModelOverrides {
  try {
    const parsed: unknown = JSON.parse(readFileSync(configPath, "utf8"));
    if (!parsed || typeof parsed !== "object") return { models: {} };

    const rawModels = (parsed as { models?: unknown }).models;
    if (!rawModels || typeof rawModels !== "object" || Array.isArray(rawModels)) {
      return { models: {} };
    }

    const models: ModelOverrides["models"] = {};
    for (const [role, model] of Object.entries(rawModels)) {
      if (isBundledAgentRole(role) && typeof model === "string") models[role] = model;
    }
    return { models };
  } catch {
    return { models: {} };
  }
}

export function writeModelOverrides(configPath: string, overrides: ModelOverrides): void {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");
}

export function updateModelOverride(
  overrides: ModelOverrides,
  role: BundledAgentRole,
  model: string | undefined,
): ModelOverrides {
  const models = { ...overrides.models };
  if (model === undefined) delete models[role];
  else models[role] = model;
  return { models };
}

export function resolveModel(params: ResolutionParams): ModelResolution {
  const available = new Set(params.available);
  const candidates = [
    params.explicit,
    ...(params.trustedProject ? [params.project] : []),
    params.global,
    params.profile,
    params.parent,
  ];
  const unavailable: string[] = [];
  const seenUnavailable = new Set<string>();

  for (const model of candidates) {
    if (!model) continue;
    if (available.has(model)) return { model, unavailable };
    if (!seenUnavailable.has(model)) {
      seenUnavailable.add(model);
      unavailable.push(model);
    }
  }

  return { unavailable };
}
