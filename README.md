# cmuxagent

Async subagents for [Pi](https://github.com/earendil-works/pi), running in visible cmux surfaces. Spawn a subagent, keep working in the parent session, and receive the result automatically when it finishes.

**cmux-only fork.** This repository consolidates [amosblomqvist/pi-interactive-subagents](https://github.com/amosblomqvist/pi-interactive-subagents) with the cmuxagent package work. See [Acknowledgements](#acknowledgements) for the full upstream lineage.

## Quick start

### 1. Prerequisites

Install and configure:

- [pi](https://github.com/badlogic/pi-mono)
- [cmux](https://github.com/manaflow-ai/cmux)
- At least one model provider usable by pi

Confirm both commands are available:

```bash
pi --version
cmux --version
```

### 2. Install cmuxagent

For this local checkout:

```bash
cd /Users/sean/Documents/cmuxagent
npm install
pi install "$(pwd)"
```

Or install the current GitHub branch using your existing GitHub credentials:

```bash
pi install git:github.com/motionid/cmuxagent
```

A local installation references the checkout directly rather than copying it. Confirm the package is registered:

```bash
pi list
```

The output should include the resolved path:

```text
/Users/sean/Documents/cmuxagent
```

### 3. Resolve a `pi-subagents` conflict

This extension and `npm:pi-subagents` both register a tool named `subagent`, so their extensions cannot be enabled together. You may keep the `pi-subagents` skills and prompts by disabling only its extension in `~/.pi/agent/settings.json`:

```json
{
  "source": "npm:pi-subagents",
  "extensions": []
}
```

Use that object in the `packages` array instead of the plain `"npm:pi-subagents"` entry. Alternatively, remove the conflicting package completely:

```bash
pi remove npm:pi-subagents
```

Other cmux packages are fine as long as they do not register `subagent`, `subagent_message`, or `subagents_list`.

### 4. Start pi inside cmux

Open a terminal surface in cmux, then run:

```bash
pi
```

The extension requires `CMUX_SOCKET_PATH` and `CMUX_SURFACE_ID`, which cmux supplies automatically to its terminal surfaces. Running pi in Terminal.app, iTerm, or a plain shell outside cmux will show a setup error when you try to spawn an agent.

### 5. Try a subagent

In pi, run:

```text
/subagent scout Inspect the README and summarize its installation steps
```

Expected behavior:

1. A pane opens on the right without taking keyboard focus.
2. The scout runs in a named cmux tab in that pane.
3. Its status appears above the main pi editor.
4. The result returns to the main session automatically.

A second subagent opens as another tab in the same right-side pane.

### Updating

The installation points directly at this checkout. After pulling or editing code, start a new pi session or run `/reload`; you do not need to reinstall the package.

```bash
cd /Users/sean/Documents/cmuxagent
git pull
npm install
```

### Uninstalling

```bash
pi remove /Users/sean/Documents/cmuxagent
```

Then confirm removal with `pi list`.

### Troubleshooting

**“Tool `subagent` conflicts with …”**

Disable or remove the other package that registers `subagent`; see step 3.

**“cmux is required for subagents”**

Start pi from a terminal surface inside cmux. Check that `echo "$CMUX_SOCKET_PATH"` and `echo "$CMUX_SURFACE_ID"` are non-empty.

**A pane opens but the command never starts**

Increase the shell startup delay before starting pi:

```bash
export PI_SUBAGENT_SHELL_READY_DELAY_MS=2500
```

**A configured subagent model is unavailable**

cmuxagent warns once, skips unavailable configured models, and falls through to the next source in the precedence chain. Run `/subagent-setup` again or use an explicit model that is available in the parent Pi session.

## How it works

`subagent()` returns immediately. The first sub-agent creates a right split off the parent pi surface; later sub-agents open as tabs in that same pane. Surface creation preserves keyboard focus. A live widget above the input tracks every running sub-agent, and when one finishes, its result is steered into the main session as a notification that triggers a new turn.

```
╭─ Subagents ──────────────────────────── 2 running ─╮
│ 00:23  scout      active · bash 7m                 │
│ 00:45  scout-2    waiting 2m                       │
╰────────────────────────────────────────────────────╯
```

Spawn several in parallel — they run concurrently and steer results back independently as each finishes.

cmux manages the split layout. Closing one sub-agent tab leaves the shared sub-agent pane available to the remaining tabs; if that pane disappears, the next spawn creates a fresh right split.

If your shell startup is slow and launch commands get dropped before the prompt is ready, raise the delay:

```bash
export PI_SUBAGENT_SHELL_READY_DELAY_MS=2500   # default: 500
```

## Tools

| Tool | Description |
| --- | --- |
| `subagent` | Spawn a sub-agent in a dedicated cmux surface (async) |
| `subagent_message` | Message a sub-agent by name — steers it if running, resumes its session if finished |
| `subagents_list` | List available agent definitions |
| `ask_question` | *(sub-agent sessions only)* Ask the orchestrator a question and wait for the reply |

There is also a `/subagent <agent> <task>` command for spawning directly and `/subagent-setup` for persistent bundled-agent model defaults.

### Spawning

```typescript
subagent({ agent: "scout", task: "Analyze the auth module" });
subagent({ agent: "worker", name: "dark-mode", task: "Implement the dark mode toggle" });
```

| Parameter | Type | Default | Description |
| --------- | ---- | ------- | ----------- |
| `agent` | string | required | Which agent to spawn (must be known and permitted) |
| `task` | string | required | Task prompt |
| `name` | string | agent name | Display name for the pane and widget. Must be unique — duplicates are auto-suffixed (`scout`, `scout-2`, …) |
| `model` | string | resolved model | Override the model for this spawn |
| `cwd` | string | agent's `cwd` | Working directory (see [Role folders](#role-folders)) |

### Messaging

`subagent_message` is addressed **by name only**. Names are unique per session and persist after a sub-agent finishes, so the same name works either way:

```typescript
subagent_message({ name: "scout", message: "Also check the auth middleware" });
```

- **Running** — the message is typed into the live pane (newlines flattened) and picked up at the next turn boundary. The call returns immediately; the eventual completion still arrives as a steer message.
- **Finished** — the session is resumed with the message as the follow-up task, like a fresh spawn: fire-and-forget, always autonomous, result steered back later. The resumed run reclaims its original name.

Every spawn records name → session file in `artifacts/<sessionId>/subagent-registry.json`, so names stay addressable across pi restarts. A nested sub-agent that spawns children gets its own registry keyed by its own session id. Resume is refused with a clear error (listing known names) if the name isn't registered, the session file is gone, or the session predates sandboxed resume.

**Resume replays the original sandbox.** At spawn time the fully-resolved loadout — tool allowlist, backing extensions, model, thinking level, system prompt, spawn whitelist, cwd — is snapshotted to `<session>.loadout.json`. Resume rebuilds the exact same restricted process from that snapshot rather than relaunching unrestricted.

### ask_question

A sub-agent can ask its orchestrator a single freeform question when requirements are ambiguous or a decision materially affects the work. The session **stays open** (parked as `waiting`) instead of exiting; the parent is notified with the sub-agent's name, replies via `subagent_message({ name, message })`, and the reply arrives as the sub-agent's next turn. Parallel questions are supported — each waiting sub-agent has its own name.

If the reply arrives while the sub-agent is still mid-turn, it is absorbed into the current turn — either way the question is marked answered and the session exits normally when the work is done. If the parent never replies, the pane stays open until a human closes it. Only available inside sub-agent sessions.

## Bundled agents

| Agent | Default model | Tools | Role |
| ----- | ------------- | ----- | ---- |
| **scout** | Inherit parent | `read`, `grep`, `find`, `ls` | Fast read-only codebase recon |
| **researcher** | Inherit parent | `web_search`, `web_fetch`, `safe_bash` | Web research, synthesized into a sourced brief |
| **worker** | Inherit parent | `read`, `write`, `edit`, `bash`, `web_search`, `web_fetch` + spawning | General implementer; may spawn `scout` and `researcher` |

All three inherit the parent Pi session's model by default, are autonomous (`auto-exit: true`), and carry their identity in the system prompt (`system-prompt: append`).

## Model configuration

Run `/subagent-setup` to choose `Inherit parent model` or one of the models currently available to Pi for each bundled role. The command can save to:

- global configuration: `~/.pi/cmuxagent/config.json`;
- trusted project configuration: `.pi/cmuxagent/config.json`.

Project configuration is read and written only when Pi reports that the project is trusted. Both files use this shape:

```json
{
  "models": {
    "scout": "provider/model",
    "researcher": "provider/model",
    "worker": "provider/model"
  }
}
```

A spawn resolves its model in this exact order:

1. explicit `subagent({ model })` value;
2. trusted project override;
3. global override;
4. a custom profile's explicit `model` field;
5. the parent session model.

Unavailable candidates produce a warning and are skipped in favor of the next available source. `/subagent-setup` writes only cmuxagent configuration; it never changes Pi's global settings, authentication, credentials, or provider catalogues.

## Custom agents

Place a `.md` file in `.pi/agents/` (project) or `~/.pi/agent/agents/` (global). Discovery priority: **project > global > package-bundled** — a project-local file overrides a bundled agent with the same name.

```markdown
---
name: my-agent
description: Does something specific
model: openrouter/z-ai/glm-5.3
thinking: medium
tools: read, edit, write, safe_bash, web_search
session-mode: lineage-only
auto-exit: true
---

You are a specialized agent that does X...
```

### Frontmatter reference

| Field | Type | Description |
| ----- | ---- | ----------- |
| `name` | string | Agent name (used in `agent: "my-agent"`) |
| `description` | string | Shown in `subagents_list` |
| `model` | string | Default model |
| `thinking` | string | `minimal`, `low`, `medium`, or `high` |
| `tools` | string | Strict tool allowlist. Built-ins: `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`. Extension-backed: `web_search`, `web_fetch`, `safe_bash`, `video_extract`, `youtube_search`, `google_image_search`. Only the extensions backing the listed tools are loaded into the child |
| `subagent_agents` | string | Comma-separated agent names this agent may spawn. **Presence of this field grants the spawning toolset** (`subagent`, `subagent_message`, `subagents_list`) and restricts spawn targets to the list. Omit it and the agent cannot spawn at all |
| `skills` | string | Comma-separated skill names to auto-load |
| `session-mode` | string | `standalone` (default), `lineage-only`, or `fork` — see below |
| `system-prompt` | string | `append` or `replace`: pass the body as the child's `--append-system-prompt` / `--system-prompt`. Omit and the body is prepended to the task prompt instead |
| `auto-exit` | boolean | Auto-shutdown when the agent finishes (see below) |
| `interactive` | boolean | Whether stall/recovery transitions wake the parent (see below) |
| `cwd` | string | Default working directory |
| `disable-model-invocation` | boolean | Hide from `subagents_list`; still spawnable by explicit name |
| `cli` | string | `claude` runs the agent via the Claude Code CLI instead of pi |

### session-mode

- `standalone` — fresh session, no lineage link to the caller (default)
- `lineage-only` — fresh session with `parentSession` linkage for discovery/fork UX, but no copied turns
- `fork` — child session seeded with the caller's conversation context

### auto-exit

With `auto-exit: true`, the session shuts down when the agent's turn ends — the agent just writes its final message and stops (there is no "done" tool). The last assistant message becomes the summary returned to the parent. Recommended for all autonomous agents.

Notes:

- **Manual input does not strand an auto-exit sub-agent.** If a human types into the pane, the session still closes once that turn completes normally — only an escape/abort leaves it open.
- **Auto-exit is suppressed while work is in flight:** the session parks as `waiting` instead of exiting when an `ask_question` is still unanswered, or when the agent's own child sub-agents are still running (a worker can stop after dispatching children and stays open until the last result returns).

### interactive

Controls whether `stalled`/`recovered` status transitions send a steer message to the parent session. Defaults to the inverse of `auto-exit`: autonomous agents get stall pings; user-driven agents stay quiet (the user is already working in that pane — the widget still updates). Set explicitly to override.

## Tool access control

Access is **whitelist-only**. Every sub-agent process is launched with `--no-extensions` (extension discovery disabled) and `--tools <allowlist>`; only the extensions backing the listed tools are loaded back in explicitly. There is no default toolset and no deny-list — an agent gets exactly what its frontmatter lists. The restriction survives resume via the loadout snapshot.

Spawns must name a known agent at **every** depth. A top-level session may spawn anything discoverable; a sub-agent may only spawn the agents in its `subagent_agents` list (enforced via `PI_SUBAGENT_ALLOWED`). There is no agentless spawn route, so a child can never escalate to a full-toolset profile by omitting its agent.

Extensions can register additional tools for sub-agents at runtime via `registerToolExtension(name, path)` on the `__pi_interactive_subagents` process global.

## Role folders

`cwd` starts a sub-agent in a directory with its own config, so role-specific setups (CLAUDE.md, skills, extensions) apply:

```
project/
└── agents/
    ├── game-designer/   ← CLAUDE.md, .pi/…
    └── sre/             ← CLAUDE.md, .pi/…
```

```typescript
subagent({ agent: "worker", cwd: "agents/sre", task: "Review the deployment pipeline" });
```

Set a per-agent default with `cwd:` in frontmatter.

## Status widget & configuration

The widget tracks each sub-agent from a runtime activity snapshot written by the child: `starting`, `active` (turn/provider/tool work), `waiting` (open for input or another stage), `stalled` (no valid snapshot for too long), or `running` (fallback). Sub-agent sessions also show their own tools widget — toggle it with `Ctrl+Alt+O`. Completion messages expand with `Ctrl+O`.

Status display is configured via `config.json` in the extension directory (copy `config.json.example`; it's gitignored):

```json
{
  "status": { "enabled": true }
}
```

## Acknowledgements

This cmux-only package is consolidated from [amosblomqvist/pi-interactive-subagents](https://github.com/amosblomqvist/pi-interactive-subagents), itself derived from [HazAT/pi-interactive-subagents](https://github.com/HazAT/pi-interactive-subagents). The upstream project originated the subagent architecture, multiplexer surface layer, and status widget; its supervision features were inspired by [RepoPrompt](https://repoprompt.com/). Upstream MIT licensing and attribution are retained.

## License

MIT
