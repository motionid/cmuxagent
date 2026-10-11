# Portable agent models design

## Goal

Make bundled cmuxagent profiles work on any Pi installation without requiring
the maintainer's model catalogue, while allowing users to persist role-specific
model overrides.

## Defaults and resolution

Bundled `scout`, `researcher`, and `worker` profiles no longer specify fixed
models. Their default is the model selected in the parent Pi session.

A spawned model resolves in this order:

1. Explicit `subagent({ model })` value.
2. Trusted project override from `.pi/cmuxagent/config.json`.
3. Global override from `~/.pi/cmuxagent/config.json`.
4. A profile's explicit `model` value, for custom profiles.
5. The parent session model.

An override that is not available in the parent session is ignored with a
clear warning; the next value in the resolution order is used.

## Configuration

Both configuration files have this shape:

```json
{
  "models": {
    "scout": "provider/model",
    "researcher": "provider/model",
    "worker": "provider/model"
  }
}
```

Missing roles inherit the parent model. Unknown keys are ignored. Project
configuration is read only when Pi trusts the project.

## Setup command

`/subagent-setup` reads the models available to the active Pi session. It
prompts once for the save scope, then once per bundled agent. Each prompt
contains `Inherit parent model` plus the currently available models. It writes
only cmuxagent configuration; it never changes Pi's global model settings,
authentication, or provider catalogue.

## Validation

Pure tests cover loading both config scopes, trusted-project precedence, model
resolution order, and an unavailable override falling back to the next source.
An extension-load check verifies the new command and existing subagent tools
can coexist.
