# cmuxagent

A Pi package for asynchronous subagents in visible cmux surfaces. The parent
continues working while each child runs in its own cmux tab/pane; completed
results are delivered back to the parent automatically.

Based on upstream work from
[HazAT/pi-interactive-subagents](https://github.com/HazAT/pi-interactive-subagents).

## Requirements

- macOS with [cmux](https://github.com/manaflow-ai/cmux) installed and running
- `cmux` and `pi` available on `PATH`
- An authenticated Pi model provider
- A Pi parent session launched from a cmux terminal surface

## Install

```bash
pi install git:github.com/motionid/cmuxagent@v1
cmux hooks pi install
```

Restart Pi after installation, then start it from a cmux terminal surface:

```bash
pi
```

`cmux hooks pi install` is per-machine setup. It installs cmux's Pi lifecycle
and resume integration; it does not add credentials or model configuration.

## Bundled agents

| Agent | Best for | Capabilities |
| --- | --- | --- |
| `scout` | Understanding an unfamiliar codebase | Read-only file and architecture recon |
| `researcher` | External facts, API docs, and comparisons | Web search and sourced research briefs |
| `worker` | Implementing or debugging a defined task | Reads, edits, tests, and may delegate to scout/researcher |

The bundled profiles default to `openrouter/z-ai/glm-5.3`. Override the model
at launch if it is not available through your Pi configuration.

## Start an agent

Ask Pi naturally:

```text
Use scout to map the authentication flow.
```

Or invoke the command directly:

```text
/subagent scout Inspect the README and summarize installation steps.
```

The equivalent tool call is:

```ts
subagent({
  agent: "scout",
  name: "auth-map",
  task: "Map the authentication flow. List entry points, relevant files, and risks.",
  model: "qwen-cloud/qwen3-coder-plus",
});
```

Each child gets a unique name, a visible cmux surface, and an isolated Pi
session. The parent receives its final response when it completes; do not poll
terminal output or session files for completion.

### Spawn reference

The slash-command form is:

```text
/subagent <agent> <task>
```

`<agent>` is required and comes first. Everything after its first space is the
task. For example:

```text
/subagent scout Find where user sessions are created and list the relevant tests.
```

The tool-call form accepts an object. `agent` and `task` are required; the
other fields are optional. Object field order does not matter.

| Field | Required | Meaning | Example |
| --- | --- | --- | --- |
| `agent` | Yes | Profile to run | `"scout"` |
| `task` | Yes | Complete, self-contained assignment | `"Map the auth flow."` |
| `name` | No | Stable display/follow-up name; duplicates are suffixed | `"auth-map"` |
| `model` | No | Overrides the profile's default model | `"qwen-cloud/qwen3-coder-plus"` |
| `cwd` | No | Child working directory | `"/Users/me/project"` |

#### Recon before planning

```ts
subagent({
  agent: "scout",
  name: "payments-recon",
  task: "Inspect the payments flow. Report entry points, data models, external services, and relevant tests. Do not edit files.",
  cwd: "/Users/me/project",
});
```

#### Research an external decision

```ts
subagent({
  agent: "researcher",
  name: "oauth-research",
  task: "Compare the current OAuth 2.1 PKCE guidance from official sources. Return a short sourced recommendation for a TypeScript web app.",
  model: "qwen-cloud/qwen3-coder-plus",
});
```

#### Implement a bounded change

```ts
subagent({
  agent: "worker",
  name: "add-rate-limit",
  task: "Add rate limiting to POST /api/login. Preserve existing behavior, add focused tests, run them, and report changed files and results.",
  cwd: "/Users/me/project",
});
```

Give a worker its exact repository, allowed scope, acceptance criteria, and
validation command. A child starts with no parent-conversation context.

#### Run independent agents in parallel

Send separate calls without waiting between them:

```ts
subagent({ agent: "scout", name: "api-map", task: "Map the API routes and their tests." });
subagent({ agent: "researcher", name: "rate-limit-research", task: "Find official guidance for rate-limit response headers." });
```

Use distinct names and non-overlapping assignments. Results arrive separately.

#### Override or add a profile

Create a project-local `.pi/agents/api-reviewer.md` profile, then use it just
like a bundled agent:

```text
/subagent api-reviewer Review the API error-handling changes for consistency.
```

See [Custom profiles](#custom-profiles) for the profile format.

## Follow up or resume

Use the same name to send more work:

```ts
subagent_message({
  name: "auth-map",
  message: "Also identify the tests that cover token refresh.",
});
```

- If the agent is still running, the message is steered into its next turn.
- If it has finished, its prior session is resumed with the same restricted
  tool/model loadout.

Use `subagents_list()` to see discoverable profiles:

```ts
subagents_list();
```

## Questions from a child agent

A child can call `ask_question` when it needs a decision from its parent. It
parks instead of exiting. Reply with `subagent_message`:

```ts
subagent_message({
  name: "auth-map",
  message: "Use the existing refresh-token pattern; do not introduce a new store.",
});
```

`ask_question` is child-to-parent coordination. It is different from Pi's
`ask_user_question` tool, which asks the human user directly.

## Custom profiles

Add a profile in either location:

- Project: `.pi/agents/security-reviewer.md`
- Global: `~/.pi/agent/agents/security-reviewer.md`

Project profiles override global and bundled profiles with the same `name`.

```md
---
name: security-reviewer
description: Read-only security review
model: qwen-cloud/qwen3-coder-plus
thinking: medium
tools: read, grep, find, ls
auto-exit: true
system-prompt: append
---

Review changes for vulnerabilities and unsafe assumptions. Do not edit files.
Report findings by severity with file references.
```

Then run:

```text
/subagent security-reviewer Review the authentication changes.
```

## Troubleshooting

| Problem | Check |
| --- | --- |
| `cmux is required for subagents` | Start the parent Pi session inside cmux; verify `CMUX_SOCKET_PATH` and `CMUX_SURFACE_ID` are set. |
| A child cannot start | Confirm its configured model is available/authenticated, or pass `model` when spawning. |
| A child is waiting | It may have called `ask_question`; reply with `subagent_message`. |
| Another subagent package conflicts | Disable its extension; only one package may register `subagent`, `subagent_message`, and `subagents_list`. |
| A child surface is slow to start | Set `PI_SUBAGENT_SHELL_READY_DELAY_MS=2500` and retry. |

## Testing

Unit tests:

```bash
npm test
```

Integration tests require cmux and an authenticated model:

```bash
PI_TEST_MODEL=<provider/model> npm run test:integration
```

For example:

```bash
PI_TEST_MODEL=qwen-cloud/qwen3-coder-plus npm run test:integration
```

## License

MIT
