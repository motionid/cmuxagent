# cmuxagent Repository Consolidation Design

**Date:** 2026-10-12

## Intent

Make `/Users/sean/Documents/cmuxagent` the single canonical checkout for the Pi cmux subagent extension. The working `pi-interactive-subagents` repository and its history become the foundation, while useful newer work from the existing `cmuxagent` repository is retained. After this consolidation, the planned “one split per subagent” layout change will be implemented only in the consolidated repository.

## Current state

### Working implementation

`/Users/sean/pi-interactive-subagents`

- Package: `pi-interactive-subagents` 3.7.2.
- Branch: `main`, clean, one commit ahead of `origin/main`.
- Remote: `amosblomqvist/pi-interactive-subagents`.
- This is the checkout currently loaded by Pi through `../../pi-interactive-subagents` in `~/.pi/agent/settings.json`.
- Contains the current cmux-only subagent implementation and tests.

### Destination and legacy work

`/Users/sean/Documents/cmuxagent`

- Package: `cmuxagent` 1.0.0.
- Branch: `main`, five commits ahead of `motionid/cmuxagent`.
- Contains a committed portable model-selection feature absent from the working implementation.
- Contains unfinished local setup work: TypeScript development dependencies, `tsconfig.json`, a model-config test correction, and an additional setup test.
- Also contains ignored archives, dependency output, OS metadata, and historical SDD run artifacts that are not part of the combined product.

## Agreed repository identity

- Canonical directory: `/Users/sean/Documents/cmuxagent`.
- Canonical package name: `cmuxagent`.
- Primary remote (`origin`): `git@github.com:motionid/cmuxagent.git`.
- Upstream remote: `https://github.com/amosblomqvist/pi-interactive-subagents.git`.
- Main-line history: the current `pi-interactive-subagents` history.
- Legacy `cmuxagent` history: retained as `legacy/cmuxagent-main` and in a standalone Git bundle.
- The old `/Users/sean/pi-interactive-subagents` checkout will not remain after successful migration.

Changing local history does not authorize rewriting the remote `motionid/cmuxagent` main branch. Any force-push or other remote history replacement requires separate explicit approval.

## Material to retain

The consolidated repository will retain:

1. The full current `pi-interactive-subagents` source, tests, and Git history.
2. The committed portable model-selection feature from legacy `cmuxagent`:
   - `pi-extension/subagents/model-config.ts`;
   - its integration in `pi-extension/subagents/index.ts`;
   - relevant model configuration tests;
   - relevant user documentation and design documentation.
3. Useful unfinished setup work from legacy `cmuxagent`:
   - TypeScript and Node type development dependencies;
   - `tsconfig.json`;
   - corrected TypeScript test import;
   - the additional subagent model-resolution setup test;
   - relevant implementation plans where they explain retained behavior.
4. Package identity and repository metadata for `cmuxagent` and `motionid/cmuxagent`.

The migration will not carry forward:

- `node_modules/`;
- `.DS_Store`;
- ignored `archive/` code;
- `.superpowers/sdd/` execution artifacts;
- obsolete duplicate source or documentation;
- generated temporary files.

Those files remain recoverable from the pre-migration filesystem backup when present.

## Package metadata policy

The consolidated package will:

- use the name `cmuxagent`;
- retain version `3.7.2` initially to avoid an artificial version regression from the working implementation;
- point its repository URL at `motionid/cmuxagent`;
- remain private unless publishing is separately requested;
- preserve the Pi extension entry point and required Pi peer/development dependencies from the working implementation;
- add the useful TypeScript development tooling from the legacy work rather than replacing existing dependencies.

These are implementation calls made to preserve compatibility and avoid losing required dependencies.

## Migration approach

1. Record the exact state of both repositories, including branches, remotes, commits, tracked modifications, untracked files, and ignored legacy material.
2. Create recovery artifacts before changing either path:
   - a Git bundle containing all legacy `cmuxagent` refs;
   - a patch and file archive for its uncommitted/untracked selected work;
   - a Git bundle for the working `pi-interactive-subagents` repository;
   - a full filesystem rename of the old destination to a timestamped backup directory.
3. Relocate `/Users/sean/pi-interactive-subagents` to `/Users/sean/Documents/cmuxagent`. This preserves its `.git` directory and makes its history the main-line history.
4. Configure remotes so `origin` is `motionid/cmuxagent` and `upstream` is `amosblomqvist/pi-interactive-subagents`.
5. Import the old destination’s committed main branch as `legacy/cmuxagent-main`.
6. Port the selected portable-model and setup work into the new main working tree. Resolve overlaps deliberately rather than copying the entire legacy tree over the newer implementation.
7. Rename package metadata and update documentation to the agreed `cmuxagent` identity.
8. Update `~/.pi/agent/settings.json` to load `../../Documents/cmuxagent`.
9. Run unit tests, type checking, package/manifest tests, and appropriate cmux integration checks.
10. Start or reload Pi from the new path and verify that `subagent`, `subagent_message`, and `subagents_list` register from the consolidated checkout.
11. Commit the consolidation in `/Users/sean/Documents/cmuxagent` only after verification.

## Safety and rollback

- No source directory is deleted in place. The old destination is first renamed to a timestamped backup.
- Git bundles and WIP patches are created before relocation.
- No remote branch is rewritten or force-pushed as part of this work.
- If verification fails, restore `~/.pi/agent/settings.json`, move the relocated repository back to `/Users/sean/pi-interactive-subagents`, and restore the old destination directory from its timestamped backup.
- Backup removal is outside this migration and requires a later explicit cleanup decision.

## Verification criteria

The consolidation is complete only when:

- `/Users/sean/Documents/cmuxagent` is the sole active source checkout.
- Its main history contains the current cmux-only implementation lineage.
- `legacy/cmuxagent-main` resolves to the old destination’s pre-migration main commit.
- Recovery bundles and the filesystem backup exist and pass basic validation.
- Package metadata identifies `cmuxagent` and `motionid/cmuxagent`.
- Portable model selection and trusted-project behavior are present and tested.
- The unfinished setup tests and TypeScript configuration are either integrated and passing or explicitly rejected with evidence.
- Existing unit tests pass.
- Type checking passes.
- Applicable cmux integration tests pass from inside cmux.
- Pi settings point to `../../Documents/cmuxagent` and the extension loads there.
- `/Users/sean/pi-interactive-subagents` no longer exists as a second checkout.

## Non-goals

- Implementing the alternating right/down split behavior during the migration commit.
- Publishing an npm package.
- Force-pushing or rewriting the remote repository.
- Retaining obsolete archives or generated dependency directories in the product repository.
- Refactoring unrelated subagent behavior.

## Follow-up

After this consolidation is verified and committed, implement the already approved layout change in `/Users/sean/Documents/cmuxagent`: every subagent receives a new split anchored to the original parent Pi surface, alternating right and down rather than sharing tabs.
