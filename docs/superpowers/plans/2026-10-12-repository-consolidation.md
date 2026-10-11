# cmuxagent Repository Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the active `pi-interactive-subagents` checkout and selected legacy `cmuxagent` work into one verified repository at `/Users/sean/Documents/cmuxagent`.

**Architecture:** Preserve the active checkout’s Git history by physically relocating it, retain the old destination through bundles, a WIP archive, a filesystem backup, and a legacy branch, then port selected functionality into the relocated tree with tests. Cut Pi over only after package, model-resolution, and cmux tests pass.

**Tech Stack:** Git, Bash, TypeScript, Node.js `node:test`, Pi extension API, cmux CLI.

**Spec:** `docs/superpowers/specs/2026-10-12-repository-consolidation-design.md`

## Global Constraints

- Canonical directory: `/Users/sean/Documents/cmuxagent`.
- Canonical package name: `cmuxagent`, initially version `3.7.2`, private.
- `origin`: `git@github.com:motionid/cmuxagent.git`.
- `upstream`: `https://github.com/amosblomqvist/pi-interactive-subagents.git`.
- Current `pi-interactive-subagents` history becomes `main`.
- Old `cmuxagent` main remains reachable as `legacy/cmuxagent-main` and in a verified Git bundle.
- Preserve the portable model feature, relevant tests/docs, and selected unfinished setup work.
- Do not retain `node_modules/`, `.DS_Store`, `archive/`, or `.superpowers/sdd/` in the product tree.
- Do not push, force-push, rewrite a remote branch, publish a package, or implement the split-layout change in this plan.
- Pi settings move from `../../pi-interactive-subagents` to `../../Documents/cmuxagent` only after the consolidated checkout passes its pre-cutover checks.

## File Structure

### Recovery artifacts outside the repository

- `/Users/sean/Documents/cmuxagent-consolidation-backup-<timestamp>/active-pi-interactive-subagents.bundle` — all refs from the active source repository.
- `/Users/sean/Documents/cmuxagent-consolidation-backup-<timestamp>/legacy-cmuxagent.bundle` — all refs from the old destination repository.
- `/Users/sean/Documents/cmuxagent-consolidation-backup-<timestamp>/legacy-wip.patch` — binary-safe tracked WIP patch.
- `/Users/sean/Documents/cmuxagent-consolidation-backup-<timestamp>/legacy-selected-untracked.tar` — selected untracked plans/tests/config.
- `/Users/sean/Documents/cmuxagent-consolidation-backup-<timestamp>/legacy-working-tree/` — filesystem-preserved old destination.
- `/Users/sean/Documents/cmuxagent-consolidation-backup-<timestamp>/manifest.txt` — source paths, heads, branches, remotes, statuses, and checksums.

### Consolidated repository

- `package.json` — `cmuxagent` identity, Pi manifest, scripts, dependencies, repository URL.
- `package-lock.json` — lockfile generated from the combined manifest.
- `tsconfig.json` — no-emit strict TypeScript checking for extension and tests.
- `pi-extension/subagents/model-config.ts` — pure config loading/writing and model precedence.
- `pi-extension/subagents/index.ts` — spawn-time model selection and `/subagent-setup` integration.
- `agents/{scout,researcher,worker}.md` — bundled profiles that inherit the parent model.
- `test/package-manifest.test.ts` — package identity and Pi entry-point contract.
- `test/model-config.test.ts` — config validation, trust, precedence, and unavailable-model fallback.
- `test/subagent-setup.test.ts` — setup/write behavior and parent-model inheritance.
- `test/test.ts` — extension registration and spawn integration tests.
- `README.md` — consolidated installation, operation, model configuration, and attribution.
- `docs/superpowers/specs/2026-10-12-repository-consolidation-design.md` — approved consolidation design.
- `docs/superpowers/plans/2026-10-12-repository-consolidation.md` — this plan.
- `docs/superpowers/specs/2026-09-06-portable-agent-models-design.md` — retained feature design.

## Review Focus

1. A failure between renaming the old destination and moving the active source must leave both trees recoverable; Task 1 verifies bundles and Task 2 verifies the filesystem backup before proceeding.
2. Legacy tracked and selected untracked WIP must not disappear; Task 1 records checksums and Task 2 compares the preserved files before integration.
3. Unrelated Git histories must not silently overwrite the remote; Task 2 verifies remotes and the exact `legacy/cmuxagent-main` commit, and no task pushes.
4. An unavailable configured model must warn and fall through to the next available candidate; Task 4 adds a focused integration test.
5. An untrusted project config must never override global/profile/parent selection or be writable through setup; Tasks 3 and 4 add focused tests.

---

### Task 1: Capture baselines and create recovery artifacts

**Files:**
- Create outside repo: `/Users/sean/Documents/cmuxagent-consolidation-backup-<timestamp>/manifest.txt`
- Create outside repo: both Git bundles, `legacy-wip.patch`, and `legacy-selected-untracked.tar`
- Modify: none

**Interfaces:**
- Consumes: the untouched repositories at `/Users/sean/pi-interactive-subagents` and `/Users/sean/Documents/cmuxagent`.
- Produces: a backup directory path recorded in `/tmp/cmuxagent-consolidation-backup-path`, verified bundles, WIP artifacts, and baseline commit IDs for Task 2.

- [ ] **Step 1: Fail closed unless the expected repositories and states are present**

Run:

```bash
set -euo pipefail
active=/Users/sean/pi-interactive-subagents
legacy=/Users/sean/Documents/cmuxagent
test "$(git -C "$active" rev-parse --show-toplevel)" = "$active"
test "$(git -C "$legacy" rev-parse --show-toplevel)" = "$legacy"
test -z "$(git -C "$active" status --porcelain)"
test "$(git -C "$active" rev-parse --short HEAD)" = 97aa178
test "$(git -C "$legacy" rev-parse --short HEAD)" = 70818a4
```

Expected: all checks succeed. If either HEAD has changed, stop and revise the recorded baseline rather than bypassing the check.

- [ ] **Step 2: Run and record the active repository’s pre-migration tests**

Run:

```bash
cd /Users/sean/pi-interactive-subagents
npm test
```

Expected: exit 0. Record the command and summary in the backup manifest created in Step 3.

- [ ] **Step 3: Create a unique backup directory and state manifest**

Run:

```bash
backup="/Users/sean/Documents/cmuxagent-consolidation-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup"
printf '%s\n' "$backup" > /tmp/cmuxagent-consolidation-backup-path
{
  echo "active=/Users/sean/pi-interactive-subagents"
  echo "active_head=$(git -C /Users/sean/pi-interactive-subagents rev-parse HEAD)"
  echo "legacy=/Users/sean/Documents/cmuxagent"
  echo "legacy_head=$(git -C /Users/sean/Documents/cmuxagent rev-parse HEAD)"
  echo '--- active status ---'
  git -C /Users/sean/pi-interactive-subagents status --short --branch
  echo '--- active remotes ---'
  git -C /Users/sean/pi-interactive-subagents remote -v
  echo '--- legacy status ---'
  git -C /Users/sean/Documents/cmuxagent status --short --branch
  echo '--- legacy remotes ---'
  git -C /Users/sean/Documents/cmuxagent remote -v
} > "$backup/manifest.txt"
```

Expected: the path file and manifest exist and contain both full HEAD IDs.

- [ ] **Step 4: Create and verify Git bundles for both histories**

Run:

```bash
backup=$(cat /tmp/cmuxagent-consolidation-backup-path)
git -C /Users/sean/pi-interactive-subagents bundle create "$backup/active-pi-interactive-subagents.bundle" --all
git -C /Users/sean/Documents/cmuxagent bundle create "$backup/legacy-cmuxagent.bundle" --all
git bundle verify "$backup/active-pi-interactive-subagents.bundle"
git bundle verify "$backup/legacy-cmuxagent.bundle"
```

Expected: both verifications report that the bundles are okay and contain complete histories.

- [ ] **Step 5: Capture tracked WIP and selected untracked files**

Run:

```bash
backup=$(cat /tmp/cmuxagent-consolidation-backup-path)
git -C /Users/sean/Documents/cmuxagent diff --binary > "$backup/legacy-wip.patch"
tar -C /Users/sean/Documents/cmuxagent -cf "$backup/legacy-selected-untracked.tar" \
  docs/superpowers/plans \
  test/subagent-setup.test.ts \
  tsconfig.json
shasum -a 256 \
  /Users/sean/Documents/cmuxagent/test/subagent-setup.test.ts \
  /Users/sean/Documents/cmuxagent/tsconfig.json \
  "$backup/legacy-wip.patch" \
  "$backup/legacy-selected-untracked.tar" >> "$backup/manifest.txt"
tar -tf "$backup/legacy-selected-untracked.tar"
```

Expected: the tar listing contains only the selected plans, setup test, and `tsconfig.json`; no `node_modules`, `.DS_Store`, `archive`, or `.superpowers/sdd` entries appear.

- [ ] **Step 6: Do not commit**

This task creates recovery material outside Git. Proceed only after every artifact exists and verifies.

### Task 2: Relocate the active repository and preserve legacy history

**Files:**
- Move: `/Users/sean/Documents/cmuxagent` to the recorded backup as `legacy-working-tree/`
- Move: `/Users/sean/pi-interactive-subagents` to `/Users/sean/Documents/cmuxagent`
- Create Git ref: `refs/heads/legacy/cmuxagent-main`
- Modify Git remotes: `origin`, `upstream`

**Interfaces:**
- Consumes: the verified backup directory and baseline commit IDs from Task 1.
- Produces: the canonical repository path, `legacy/cmuxagent-main`, `origin`, and `upstream` used by later tasks.

- [ ] **Step 1: Move the old destination into the backup without deleting it**

Run:

```bash
set -euo pipefail
backup=$(cat /tmp/cmuxagent-consolidation-backup-path)
test -d /Users/sean/Documents/cmuxagent/.git
test ! -e "$backup/legacy-working-tree"
mv /Users/sean/Documents/cmuxagent "$backup/legacy-working-tree"
test -d "$backup/legacy-working-tree/.git"
test "$(git -C "$backup/legacy-working-tree" rev-parse --short HEAD)" = 70818a4
```

Expected: the old destination exists intact only under the backup directory.

- [ ] **Step 2: Relocate the active checkout into the canonical path**

Run:

```bash
mv /Users/sean/pi-interactive-subagents /Users/sean/Documents/cmuxagent
test "$(git -C /Users/sean/Documents/cmuxagent rev-parse --show-toplevel)" = /Users/sean/Documents/cmuxagent
test "$(git -C /Users/sean/Documents/cmuxagent rev-parse --short HEAD)" = 97aa178
test ! -e /Users/sean/pi-interactive-subagents
test -z "$(git -C /Users/sean/Documents/cmuxagent status --porcelain)"
```

Expected: the active history is unchanged and there is no second checkout at the old path.

- [ ] **Step 3: Configure primary and upstream remotes without pushing**

Run:

```bash
cd /Users/sean/Documents/cmuxagent
git remote rename origin upstream
git remote add origin git@github.com:motionid/cmuxagent.git
test "$(git remote get-url origin)" = git@github.com:motionid/cmuxagent.git
test "$(git remote get-url upstream)" = https://github.com/amosblomqvist/pi-interactive-subagents.git
git remote -v
```

Expected: `origin` points to motionid and `upstream` points to amosblomqvist. Do not fetch or push `origin/main` into local `main`.

- [ ] **Step 4: Import and verify the legacy main branch from its bundle**

Run:

```bash
backup=$(cat /tmp/cmuxagent-consolidation-backup-path)
legacy_head=$(awk -F= '/^legacy_head=/{print $2}' "$backup/manifest.txt")
git fetch "$backup/legacy-cmuxagent.bundle" refs/heads/main:refs/heads/legacy/cmuxagent-main
test "$(git rev-parse legacy/cmuxagent-main)" = "$legacy_head"
git log -1 --oneline legacy/cmuxagent-main
```

Expected: `legacy/cmuxagent-main` points exactly to the old destination’s recorded HEAD.

- [ ] **Step 5: Restore the approved design and this plan into the relocated tree**

Run:

```bash
backup=$(cat /tmp/cmuxagent-consolidation-backup-path)
mkdir -p docs/superpowers/specs docs/superpowers/plans
cp "$backup/legacy-working-tree/docs/superpowers/specs/2026-10-12-repository-consolidation-design.md" docs/superpowers/specs/
cp "$backup/legacy-working-tree/docs/superpowers/plans/2026-10-12-repository-consolidation.md" docs/superpowers/plans/
```

Expected: both documents exist under the relocated repository and `git diff --check` reports no whitespace errors.

- [ ] **Step 6: Do not commit yet**

The restored documents remain uncommitted until package identity and migration metadata are added in Task 3.

### Task 3: Establish the cmuxagent package identity and development contract

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tsconfig.json`
- Create: `test/package-manifest.test.ts`
- Create: `docs/superpowers/specs/2026-10-12-repository-consolidation-design.md`
- Create: `docs/superpowers/plans/2026-10-12-repository-consolidation.md`

**Interfaces:**
- Consumes: relocated working source and selected setup files from the legacy backup.
- Produces: package name `cmuxagent`, version `3.7.2`, private manifest, combined dependencies, `npm run typecheck`, and committed migration docs.

- [ ] **Step 1: Add the failing package-manifest test**

Create `test/package-manifest.test.ts` with assertions that:

```ts
assert.equal(manifest.name, "cmuxagent");
assert.equal(manifest.version, "3.7.2");
assert.equal(manifest.private, true);
assert.equal(manifest.repository.url, "git+https://github.com/motionid/cmuxagent.git");
assert.deepEqual(manifest.pi.extensions, ["./pi-extension/subagents/index.ts"]);
assert.equal(manifest.keywords.includes("pi-package"), true);
assert.equal(manifest.scripts.test, "node --test test/test.ts test/*.test.ts");
assert.equal(manifest.scripts.typecheck, "tsc --noEmit");
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node --test test/package-manifest.test.ts
```

Expected: FAIL because the relocated manifest still identifies `pi-interactive-subagents` and is not private.

- [ ] **Step 3: Merge package metadata and TypeScript tooling**

Update `package.json` to preserve the working implementation’s Pi manifest, test scripts, peer dependencies, and Pi development dependencies while setting:

- `name`: `cmuxagent`
- `version`: `3.7.2`
- `private`: `true`
- `author`: `Sean`, with upstream attribution retained in README/LICENSE
- repository URL: `git+https://github.com/motionid/cmuxagent.git`
- script `test`: `node --test test/test.ts test/*.test.ts`, so both the original suite and focused `*.test.ts` files run
- script `typecheck`: `tsc --noEmit`
- development dependencies: retain the working Pi/TypeBox packages and add `@types/node` and `typescript`

Copy the selected legacy `tsconfig.json`, but set `noEmit: true`, remove `declaration`, `sourceMap`, and `outDir`, and keep strict ES2022/ESNext checking over `pi-extension/**/*.ts` and `test/**/*.ts`.

- [ ] **Step 4: Regenerate the lockfile and verify the manifest test**

Run:

```bash
npm install
node --test test/package-manifest.test.ts
```

Expected: install succeeds and the focused test passes.

- [ ] **Step 5: Run baseline tests and typecheck, recording any pre-existing type failures separately**

Run:

```bash
npm test
npm run typecheck
```

Expected: unit tests pass. Typecheck must pass before this task is committed; fix only package/typing incompatibilities introduced by this task, not unrelated behavior.

- [ ] **Step 6: Commit package identity and migration documentation**

```bash
git add package.json package-lock.json tsconfig.json test/package-manifest.test.ts \
  docs/superpowers/specs/2026-10-12-repository-consolidation-design.md \
  docs/superpowers/plans/2026-10-12-repository-consolidation.md
git commit -m "chore: consolidate repository as cmuxagent"
```

### Task 4: Port and harden portable model configuration

**Files:**
- Create: `pi-extension/subagents/model-config.ts`
- Create: `test/model-config.test.ts`
- Modify: `agents/scout.md`
- Modify: `agents/researcher.md`
- Modify: `agents/worker.md`

**Interfaces:**
- Produces:
  - `type BundledAgentRole = "scout" | "researcher" | "worker"`
  - `interface ModelOverrides { models: Partial<Record<BundledAgentRole, string>> }`
  - `loadModelOverrides(path: string): ModelOverrides`
  - `writeModelOverrides(path: string, overrides: ModelOverrides): void`
  - `updateModelOverride(overrides: ModelOverrides, role: BundledAgentRole, model: string | undefined): ModelOverrides`
  - `resolveModel(params: ResolutionParams): { model?: string; unavailable: string[] }`
- Consumes: explicit, trusted-project, global, profile, and parent model references plus the active set of canonical `provider/model` references.

- [ ] **Step 1: Add failing config parsing and writing tests**

Create `test/model-config.test.ts` using a temporary directory. Assert that:

- missing or malformed JSON returns `{ models: {} }`;
- only `scout`, `researcher`, and `worker` string values survive parsing;
- unknown roles and non-string values are ignored;
- `writeModelOverrides` creates parent directories and round-trips valid values;
- `updateModelOverride(overrides, role, undefined)` removes that role’s key rather than storing a sentinel model, without mutating the input.

- [ ] **Step 2: Add failing precedence, trust, and availability tests**

Test `resolveModel` in this exact order:

1. explicit;
2. project only when `trustedProject: true`;
3. global;
4. profile;
5. parent.

Assert that unavailable values are accumulated in `unavailable`, skipped, and followed by the next available candidate. Assert that an untrusted project candidate is ignored rather than reported as unavailable.

- [ ] **Step 3: Run focused tests and verify the module-missing failure**

Run:

```bash
node --test test/model-config.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `model-config.ts`.

- [ ] **Step 4: Implement the pure ESM model-config module**

Use `node:fs` imports, not CommonJS `require`. Store config as formatted JSON with a trailing newline. Deduplicate unavailable references while preserving precedence order. Do not read project trust, Pi settings, credentials, or model registries inside this module.

- [ ] **Step 5: Remove fixed model frontmatter from bundled profiles**

Delete only the `model:` field from `agents/scout.md`, `agents/researcher.md`, and `agents/worker.md`. Do not alter their tools, thinking levels, prompts, or delegation constraints.

- [ ] **Step 6: Run focused and full tests**

Run:

```bash
node --test test/model-config.test.ts
npm test
npm run typecheck
```

Expected: all commands pass.

- [ ] **Step 7: Commit the pure model configuration layer**

```bash
git add pi-extension/subagents/model-config.ts test/model-config.test.ts agents/
git commit -m "feat: add portable subagent model configuration"
```

### Task 5: Integrate model selection and `/subagent-setup`

**Files:**
- Modify: `pi-extension/subagents/index.ts`
- Create: `test/subagent-setup.test.ts`
- Modify: `test/test.ts`

**Interfaces:**
- Consumes: Task 4’s model-config exports and Pi context fields `ctx.model`, `ctx.modelRegistry.getAvailable()`, `ctx.scopedModels`, `ctx.isProjectTrusted()`, `ctx.cwd`, and `ctx.ui`.
- Produces:
  - `canonicalModelRef(model: { provider: string; id: string }): string`
  - `availableModelRefs(ctx): string[]`
  - spawn-time portable model resolution;
  - interactive `/subagent-setup` configuration.

- [ ] **Step 1: Add failing parent-inheritance and precedence integration tests**

In `test/test.ts`, expose the model-selection helper through `__test__` and assert:

- a bundled profile with no fixed model resolves to `ctx.model` when no overrides exist;
- an explicit tool parameter wins;
- trusted project overrides global, profile, and parent;
- untrusted project config is ignored;
- unavailable project/global candidates warn and fall through;
- `ctx.scopedModels` constrains availability when non-empty, otherwise `ctx.modelRegistry.getAvailable()` supplies it.

Use canonical references in the form `${provider}/${id}`.

- [ ] **Step 2: Add failing setup-command storage tests**

Create `test/subagent-setup.test.ts` around an exported pure setup-update helper. Assert that:

- global scope writes `~/.pi/cmuxagent/config.json` through an injected home directory;
- project scope writes `<cwd>/.pi/cmuxagent/config.json` only when trusted;
- untrusted project scope returns a refusal and writes nothing;
- selecting `Inherit parent model` deletes that role’s override;
- cancelling a selector leaves the existing file unchanged;
- unrelated valid role overrides remain intact.

- [ ] **Step 3: Run focused tests and verify failures**

Run:

```bash
node --test test/test.ts test/subagent-setup.test.ts test/model-config.test.ts
```

Expected: FAIL because the integration helpers and command do not exist.

- [ ] **Step 4: Integrate spawn-time model resolution**

Expand `launchSubagent`’s context type to include the Pi model, model registry, scoped models, trust check, and UI notification needed for resolution. Load:

- global config from `join(homedir(), ".pi", "cmuxagent", "config.json")`;
- project config from `join(ctx.cwd, ".pi", "cmuxagent", "config.json")` only when `ctx.isProjectTrusted()` is true.

Build available canonical references from scoped models when present, otherwise from `ctx.modelRegistry.getAvailable()`. Use Task 4 precedence, notify once when configured candidates are unavailable, and pass the selected value to the existing `--model` command construction. Do not change credentials, provider configuration, or Pi’s active parent model.

- [ ] **Step 5: Register `/subagent-setup` using Pi dialogs**

The command must:

1. require dialog-capable UI;
2. select `global` or `project` scope;
3. reject project scope when `ctx.isProjectTrusted()` is false;
4. present `Inherit parent model` plus sorted active canonical model references for each bundled role;
5. abort without writing if any selection is cancelled;
6. write only cmuxagent’s config file using Task 4;
7. notify the final path and selected roles.

Do not parse a free-form model catalogue or use hard-coded model names.

- [ ] **Step 6: Run focused tests, full tests, and extension load check**

Run:

```bash
node --test test/test.ts test/subagent-setup.test.ts test/model-config.test.ts
npm test
npm run typecheck
pi -e ./pi-extension/subagents/index.ts --help
```

Expected: all tests and typecheck pass; Pi exits successfully without an extension-load error.

- [ ] **Step 7: Commit the extension integration**

```bash
git add pi-extension/subagents/index.ts test/test.ts test/subagent-setup.test.ts
git commit -m "feat: configure portable subagent models"
```

### Task 6: Consolidate documentation and attribution

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/specs/2026-09-06-portable-agent-models-design.md`
- Optionally retain if still accurate: `docs/superpowers/plans/2026-09-06-portable-agent-models.md`
- Modify only if needed: `LICENSE`

**Interfaces:**
- Consumes: final package name, installation path, tool behavior, setup command, config paths, and model precedence from Tasks 3–5.
- Produces: one accurate user-facing guide with upstream attribution.

- [ ] **Step 1: Copy the retained portable-model design from the legacy backup**

Run:

```bash
backup=$(cat /tmp/cmuxagent-consolidation-backup-path)
cp "$backup/legacy-working-tree/docs/superpowers/specs/2026-09-06-portable-agent-models-design.md" \
  docs/superpowers/specs/
```

Expected: the design exists in the consolidated repository.

- [ ] **Step 2: Rewrite README from the active implementation’s behavior**

Keep the active README’s cmux requirements, local installation, package-conflict warning, async lifecycle, tools, configuration, testing, and troubleshooting. Change identity and paths to `cmuxagent` and `/Users/sean/Documents/cmuxagent`. Add:

- motionid Git installation instructions without claiming a release/tag that was not verified;
- upstream attribution to `amosblomqvist/pi-interactive-subagents` and retained license credit;
- parent-model inheritance;
- `/subagent-setup` interaction;
- global path `~/.pi/cmuxagent/config.json`;
- trusted project path `.pi/cmuxagent/config.json`;
- exact precedence order;
- unavailable-model fallback warning;
- statement that setup never changes Pi settings, credentials, or provider catalogues.

Do not yet change the documented tab/split behavior; that is the follow-up feature.

- [ ] **Step 3: Add documentation assertions to the manifest test**

In `test/package-manifest.test.ts`, read `README.md` and assert it contains:

- `# cmuxagent`;
- `/subagent-setup`;
- both config paths;
- `amosblomqvist/pi-interactive-subagents`;
- `/Users/sean/Documents/cmuxagent`;

and does not contain `/Users/sean/pi-interactive-subagents`.

- [ ] **Step 4: Run documentation and full verification**

Run:

```bash
node --test test/package-manifest.test.ts
npm test
npm run typecheck
git diff --check
```

Expected: all commands pass.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md LICENSE docs/superpowers/specs/2026-09-06-portable-agent-models-design.md \
  docs/superpowers/plans/2026-09-06-portable-agent-models.md test/package-manifest.test.ts
git commit -m "docs: document consolidated cmuxagent package"
```

Omit the old implementation plan from `git add` if review finds it materially inconsistent with the hardened implementation; retain the design either way.

### Task 7: Verify cmux behavior and cut Pi over to the consolidated checkout

**Files:**
- Modify outside repo: `/Users/sean/.pi/agent/settings.json`
- Create outside repo: timestamped settings backup
- Modify repo: none unless verification reveals a tested defect

**Interfaces:**
- Consumes: the fully tested consolidated package.
- Produces: Pi loading `../../Documents/cmuxagent`, successful cmux integration evidence, and one active checkout.

- [ ] **Step 1: Run the complete package verification from the canonical directory**

Run:

```bash
cd /Users/sean/Documents/cmuxagent
npm test
npm run typecheck
npm run test:integration
```

Expected: all commands pass. Integration tests must run from the active cmux environment; if required cmux variables are absent, stop rather than reporting a skipped suite as successful.

- [ ] **Step 2: Verify repository identity, history preservation, and recovery artifacts**

Run:

```bash
backup=$(cat /tmp/cmuxagent-consolidation-backup-path)
test "$(git rev-parse --show-toplevel)" = /Users/sean/Documents/cmuxagent
test "$(git remote get-url origin)" = git@github.com:motionid/cmuxagent.git
test "$(git remote get-url upstream)" = https://github.com/amosblomqvist/pi-interactive-subagents.git
test "$(git rev-parse legacy/cmuxagent-main)" = "$(awk -F= '/^legacy_head=/{print $2}' "$backup/manifest.txt")"
git bundle verify "$backup/active-pi-interactive-subagents.bundle"
git bundle verify "$backup/legacy-cmuxagent.bundle"
test -d "$backup/legacy-working-tree/.git"
test ! -e /Users/sean/pi-interactive-subagents
```

Expected: all checks pass.

- [ ] **Step 3: Back up and atomically update Pi settings**

Create `~/.pi/agent/settings.json.pre-cmuxagent-consolidation-<timestamp>.bak`, then replace the exact package entry `../../pi-interactive-subagents` with `../../Documents/cmuxagent` using a JSON parser and atomic temporary-file rename. Fail if the old entry occurs zero or more than one time. Preserve every unrelated setting.

- [ ] **Step 4: Verify the settings diff is limited to the package path**

Run a structural JSON comparison between the backup and updated file after normalizing only that one package string.

Expected: no other keys or values differ, and the updated packages array contains exactly one `../../Documents/cmuxagent` entry and no `../../pi-interactive-subagents` entry.

- [ ] **Step 5: Reload Pi and verify extension registration from the new path**

Run the appropriate non-destructive Pi package listing/config diagnostics, then `/reload` in the active Pi session. Confirm:

- the resolved package path is `/Users/sean/Documents/cmuxagent`;
- `subagent`, `subagent_message`, and `subagents_list` register once;
- no duplicate-tool or extension-load error appears;
- `/subagent-setup` is registered.

- [ ] **Step 6: Run one live smoke subagent**

Spawn a read-only `scout` with a trivial task. Confirm a cmux surface appears, the child starts with an available/inherited model, completion returns to the parent, and cleanup succeeds. This verifies the consolidation only; tab-versus-split layout remains unchanged until the follow-up plan.

- [ ] **Step 7: Record final evidence and confirm a clean working tree**

Append final test commands, result summaries, final HEAD, settings backup path, and canonical path to the external backup manifest. Run:

```bash
git status --short --branch
git log --oneline --decorate -5
```

Expected: clean working tree on `main`; local commits exist; no push has occurred.

## Rollback Procedure

If any cutover check fails:

1. Restore `~/.pi/agent/settings.json` from its timestamped pre-cutover backup.
2. Move `/Users/sean/Documents/cmuxagent` back to `/Users/sean/pi-interactive-subagents` only if it is the relocated active-history checkout.
3. Move `<backup>/legacy-working-tree` back to `/Users/sean/Documents/cmuxagent`.
4. Verify both HEAD IDs against `<backup>/manifest.txt`.
5. Keep all bundles, patches, archives, and failed consolidated commits for diagnosis; delete nothing.
6. Reload Pi and verify it again resolves `/Users/sean/pi-interactive-subagents`.

## Follow-up Boundary

After this plan is complete and committed, create and execute a separate plan for the approved layout behavior: every new subagent calls `cmux new-split` anchored to the original parent `CMUX_SURFACE_ID`, alternating `right` and `down`, with no shared subagent tab pane.
