/**
 * cmux surface layer.
 *
 * Everything the extension does to a terminal surface goes through this API:
 * create a surface, type a command, read its screen, close it, and poll for
 * exit. The first subagent gets a right-side split; later subagents become tabs
 * in that same pane so the main workspace does not become progressively narrower.
 */
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const execFileAsync = promisify(execFile);
const commandAvailability = new Map<string, boolean>();

function hasCommand(command: string): boolean {
  const cached = commandAvailability.get(command);
  if (cached !== undefined) return cached;

  let available = false;
  try {
    execFileSync("sh", ["-c", `command -v ${command}`], { stdio: "ignore" });
    available = true;
  } catch {}
  commandAvailability.set(command, available);
  return available;
}

export function isCmuxAvailable(): boolean {
  return !!process.env.CMUX_SOCKET_PATH && hasCommand("cmux");
}

export function isMuxAvailable(): boolean {
  return isCmuxAvailable();
}

export function muxSetupHint(): string {
  return "Open a terminal in cmux, then run `pi`.";
}

function requireCmux(): void {
  if (!isCmuxAvailable()) {
    throw new Error(`cmux is required for subagents. ${muxSetupHint()}`);
  }
}

export function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

type CmuxFocusSnapshot = {
  surfaceRef?: string;
  paneRef?: string;
};

type CmuxIdentifySnapshot = {
  focused: CmuxFocusSnapshot | null;
  caller: CmuxFocusSnapshot | null;
};

type CmuxCreatedSurface = {
  surface: string;
  paneRef?: string;
};

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function parseCmuxJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseCmuxSnapshotField(value: unknown, field: "focused" | "caller"): CmuxFocusSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as Record<string, unknown>)[field];
  if (!candidate || typeof candidate !== "object") return null;

  const record = candidate as { surface_ref?: unknown; pane_ref?: unknown };
  const surfaceRef = nonEmptyString(record.surface_ref) ? record.surface_ref : undefined;
  const paneRef = nonEmptyString(record.pane_ref) ? record.pane_ref : undefined;
  return surfaceRef || paneRef ? { surfaceRef, paneRef } : null;
}

export function parseCmuxFocusedSnapshot(value: unknown): CmuxFocusSnapshot | null {
  return parseCmuxSnapshotField(value, "focused");
}

export function parseCmuxFocusedSnapshotFromJson(value: string): CmuxFocusSnapshot | null {
  return parseCmuxFocusedSnapshot(parseCmuxJson(value));
}

export function parseCmuxPaneRefForSurface(value: unknown, surface: string): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { surface_ref?: unknown; pane_ref?: unknown; caller?: unknown };
  if (record.surface_ref === surface && nonEmptyString(record.pane_ref)) return record.pane_ref;

  if (!record.caller || typeof record.caller !== "object") return null;
  const caller = record.caller as { surface_ref?: unknown; pane_ref?: unknown };
  return caller.surface_ref === surface && nonEmptyString(caller.pane_ref) ? caller.pane_ref : null;
}

export function parseCmuxPaneRefForSurfaceFromJson(value: string, surface: string): string | null {
  return parseCmuxPaneRefForSurface(parseCmuxJson(value), surface);
}

function readCmux(args: string[]): string | null {
  const result = spawnSync("cmux", args, { encoding: "utf8" });
  if (result.error || result.status !== 0 || !result.stdout.trim()) return null;
  return result.stdout;
}

function captureCmuxIdentifySnapshot(): CmuxIdentifySnapshot {
  const parsed = parseCmuxJson(readCmux(["identify", "--json"]) ?? "");
  return {
    focused: parseCmuxSnapshotField(parsed, "focused"),
    caller: parseCmuxSnapshotField(parsed, "caller"),
  };
}

function readCmuxPaneRefForSurface(surface: string): string | null {
  const output = readCmux(["identify", "--surface", surface, "--json"]);
  return output ? parseCmuxPaneRefForSurfaceFromJson(output, surface) : null;
}

function cmuxSurfaceExists(surface: string): boolean {
  return readCmuxPaneRefForSurface(surface) !== null;
}

function restoreCmuxFocus(snapshot: CmuxFocusSnapshot | null): void {
  if (!snapshot) return;
  if (snapshot.paneRef) {
    spawnSync("cmux", ["focus-pane", "--pane", snapshot.paneRef], { encoding: "utf8" });
  }
  if (snapshot.surfaceRef) {
    spawnSync("cmux", ["focus-panel", "--panel", snapshot.surfaceRef], { encoding: "utf8" });
  }
}

export function cmuxFocusMatches(
  snapshot: CmuxFocusSnapshot | null,
  ref: CmuxFocusSnapshot | null,
): boolean {
  if (!snapshot || !ref) return false;
  if (snapshot.surfaceRef && ref.surfaceRef) return snapshot.surfaceRef === ref.surfaceRef;
  return !!snapshot.paneRef && snapshot.paneRef === ref.paneRef;
}

export function shouldRestoreCmuxFocus(
  current: CmuxFocusSnapshot | null,
  child: CmuxCreatedSurface,
): boolean {
  return cmuxFocusMatches(current, { surfaceRef: child.surface, paneRef: child.paneRef });
}

function restoreFocusAfterCreation(
  original: CmuxFocusSnapshot | null,
  child: CmuxCreatedSurface | null,
): void {
  if (!original || !child) return;

  // Restore only when cmux itself focused the newly created surface. Any other
  // focus is treated as a concurrent user choice and left untouched.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  const current = captureCmuxIdentifySnapshot().focused;
  if (shouldRestoreCmuxFocus(current, child)) restoreCmuxFocus(original);
}

function parseCreatedSurface(output: string, command: string): CmuxCreatedSurface {
  const surface = output.match(/surface:\d+/)?.[0];
  if (!surface) throw new Error(`Unexpected cmux ${command} output: ${output || "(empty)"}`);
  return { surface, paneRef: output.match(/pane:\d+/)?.[0] };
}

function renameSurface(surface: string, name: string): void {
  execFileSync("cmux", ["rename-tab", "--surface", surface, "--", name], { encoding: "utf8" });
}

function createSplit(
  name: string,
  direction: "left" | "right" | "up" | "down",
  fromSurface?: string,
): CmuxCreatedSurface {
  requireCmux();
  const identity = captureCmuxIdentifySnapshot();
  let child: CmuxCreatedSurface | null = null;

  try {
    const args = ["new-split", direction, "--focus", "false"];
    if (fromSurface) args.push("--surface", fromSurface);
    child = parseCreatedSurface(execFileSync("cmux", args, { encoding: "utf8" }).trim(), "new-split");
    child.paneRef ??= readCmuxPaneRefForSurface(child.surface) ?? undefined;
    renameSurface(child.surface, name);
    return child;
  } finally {
    restoreFocusAfterCreation(identity.focused, child);
  }
}

function createSurfaceInPane(name: string, pane: string): string {
  requireCmux();
  const identity = captureCmuxIdentifySnapshot();
  let child: CmuxCreatedSurface | null = null;

  try {
    const args = ["new-surface", "--type", "terminal", "--pane", pane, "--focus", "false"];
    child = parseCreatedSurface(execFileSync("cmux", args, { encoding: "utf8" }).trim(), "new-surface");
    child.paneRef ??= pane;
    renameSurface(child.surface, name);
    return child.surface;
  } finally {
    restoreFocusAfterCreation(identity.focused, child);
  }
}

export function cmuxTreeHasPane(tree: string, pane: string): boolean {
  const escaped = pane.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "m").test(tree);
}

export function shouldRetryMissingCmuxPane(tree: string | null, pane: string): boolean {
  return tree !== null && !cmuxTreeHasPane(tree, pane);
}

/** Pane containing subagent tabs; validated before every reuse. */
let cmuxSubagentPane: string | null = null;

export function createSurface(name: string): string {
  requireCmux();
  if (cmuxSubagentPane) {
    const tree = readCmux(["tree"]);
    if (tree && cmuxTreeHasPane(tree, cmuxSubagentPane)) {
      try {
        return createSurfaceInPane(name, cmuxSubagentPane);
      } catch (error) {
        // The last tab can be closed after the tree check but before new-surface.
        // Retry as a fresh split only when that pane actually disappeared.
        const currentTree = readCmux(["tree"]);
        if (!shouldRetryMissingCmuxPane(currentTree, cmuxSubagentPane)) throw error;
      }
    }
    cmuxSubagentPane = null;
  }

  const child = createSplit(name, "right", process.env.CMUX_SURFACE_ID);
  cmuxSubagentPane = child.paneRef ?? null;
  return child.surface;
}

export function createSurfaceSplit(
  name: string,
  direction: "left" | "right" | "up" | "down",
  fromSurface?: string,
): string {
  return createSplit(name, direction, fromSurface).surface;
}

export function sendCommand(surface: string, command: string): void {
  requireCmux();
  execFileSync("cmux", ["send", "--surface", surface, "--", command + "\n"], {
    encoding: "utf8",
  });
}

export function sendLongCommand(
  surface: string,
  command: string,
  options?: { scriptPath?: string; scriptPreamble?: string },
): string {
  const scriptPath =
    options?.scriptPath ??
    join(
      tmpdir(),
      "pi-subagent-scripts",
      `cmd-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.sh`,
    );
  mkdirSync(dirname(scriptPath), { recursive: true });

  const scriptParts = ["#!/bin/bash"];
  if (options?.scriptPreamble) scriptParts.push(options.scriptPreamble.trimEnd());
  scriptParts.push(command);
  writeFileSync(scriptPath, scriptParts.join("\n") + "\n", { mode: 0o755 });
  sendCommand(surface, `bash ${shellEscape(scriptPath)}`);
  return scriptPath;
}

export function readScreen(surface: string, lines = 50): string {
  requireCmux();
  return execFileSync(
    "cmux",
    ["read-screen", "--surface", surface, "--scrollback", "--lines", String(Math.max(1, lines))],
    { encoding: "utf8" },
  );
}

export async function readScreenAsync(surface: string, lines = 50): Promise<string> {
  requireCmux();
  const { stdout } = await execFileAsync(
    "cmux",
    ["read-screen", "--surface", surface, "--scrollback", "--lines", String(Math.max(1, lines))],
    { encoding: "utf8" },
  );
  return stdout;
}

export function closeSurface(surface: string): void {
  requireCmux();
  if (!cmuxSurfaceExists(surface)) return;
  try {
    execFileSync("cmux", ["close-surface", "--surface", surface], { encoding: "utf8" });
  } catch (error) {
    // A concurrent user close is already the requested end state. Preserve real
    // cmux failures when the target still exists.
    if (cmuxSurfaceExists(surface)) throw error;
  }
}

export interface PollResult {
  reason: "done" | "sentinel" | "error";
  exitCode: number;
  errorMessage?: string;
}

function interpretExitSidecar(data: any): PollResult {
  if (data?.type === "error") {
    const errorMessage =
      typeof data.errorMessage === "string" && data.errorMessage.trim() !== ""
        ? data.errorMessage
        : "Subagent exited with stopReason=error (no errorMessage in sidecar).";
    return { reason: "error", exitCode: 1, errorMessage };
  }
  return { reason: "done", exitCode: 0 };
}

export const __pollForExitTest__ = { interpretExitSidecar };

export async function pollForExit(
  surface: string,
  signal: AbortSignal,
  options: {
    interval: number;
    sessionFile?: string;
    sentinelFile?: string;
    onTick?: (elapsed: number) => void;
  },
): Promise<PollResult> {
  const start = Date.now();
  let consecutiveMissingSurfaceChecks = 0;

  for (;;) {
    if (signal.aborted) throw new Error("Aborted while waiting for subagent to finish");

    if (options.sessionFile) {
      try {
        const exitFile = `${options.sessionFile}.exit`;
        if (existsSync(exitFile)) {
          const data = JSON.parse(readFileSync(exitFile, "utf8"));
          rmSync(exitFile, { force: true });
          return interpretExitSidecar(data);
        }
      } catch {}
    }

    if (options.sentinelFile) {
      try {
        if (existsSync(options.sentinelFile)) return { reason: "sentinel", exitCode: 0 };
      } catch {}
    }

    try {
      const screen = await readScreenAsync(surface, 5);
      consecutiveMissingSurfaceChecks = 0;
      const match = screen.match(/__SUBAGENT_DONE_(\d+)__/);
      if (match) return { reason: "sentinel", exitCode: parseInt(match[1], 10) };
    } catch {
      if (options.sessionFile) {
        try {
          const exitFile = `${options.sessionFile}.exit`;
          if (existsSync(exitFile)) {
            const data = JSON.parse(readFileSync(exitFile, "utf8"));
            rmSync(exitFile, { force: true });
            return interpretExitSidecar(data);
          }
        } catch {}
      }

      consecutiveMissingSurfaceChecks = cmuxSurfaceExists(surface)
        ? 0
        : consecutiveMissingSurfaceChecks + 1;
      if (consecutiveMissingSurfaceChecks >= 3) {
        return {
          reason: "error",
          exitCode: 1,
          errorMessage: `cmux surface ${surface} was closed or became unavailable before completion.`,
        };
      }
    }

    options.onTick?.(Math.floor((Date.now() - start) / 1000));
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new Error("Aborted"));
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, options.interval);
      function onAbort() {
        clearTimeout(timer);
        reject(new Error("Aborted"));
      }
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}
