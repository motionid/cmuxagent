# cmuxagent package design

## Goal

Publish a private GitHub Pi package that installs the active cmux-backed
subagent implementation in one `pi install` command.

## Scope

The repository will contain only the code currently used at
`~/pi-interactive-subagents`:

- `pi-extension/subagents/` — the Pi extension and cmux surface transport.
- `agents/` — `scout`, `researcher`, and `worker` definitions.
- package metadata, tests, README, and license/attribution required by the
  upstream fork.

The following are excluded:

- `cmux-surface/` — a separate log-routing extension that is not installed.
- Generated cmux hook files, Pi auth, sessions, artifacts, and dependencies.

## Package behavior

Pi loads the root package extension through its `pi.extensions` manifest.
The extension registers the asynchronous `subagent`, `subagent_message`, and
`subagents_list` tools. It requires a Pi parent session running inside cmux;
children use cmux surfaces and return results to their parent.

The package does not embed cmux or credentials. Each machine installs Pi and
cmux, logs into a model provider, and runs `cmux hooks pi install` separately.

## Distribution

A new private GitHub repository named `cmuxagent` is the source of truth. The
README documents a pinned tag installation:

```bash
pi install git:github.com/<owner>/cmuxagent@v1
```

The manifest repository URL points to the new repository. Upstream attribution
and license remain intact.

## Verification and release

Before publishing, run the package unit and integration tests, verify a clean
install from the local path, inspect the installed package registration, then
commit, tag `v1`, and push the branch and tag. A private-repository installer
must authenticate to GitHub through its existing SSH or HTTPS credentials.
