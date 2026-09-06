# cmuxagent

A Pi subagent extension that enables multiplexed agent sessions using cmux. This package allows you to spawn multiple subagents in dedicated terminal panes that run concurrently, with automatic result collection and delivery.

Based on upstream work from [HazAT/pi-interactive-subagents](https://github.com/HazAT/pi-interactive-subagents).

## Features

- **Multiplexed Agent Sessions**: Run multiple agents simultaneously in separate cmux panes
- **Automatic Result Collection**: Results are automatically delivered as steer messages when agents complete
- **Persistent Naming**: Named agents can be messaged even after they finish
- **Status Tracking**: Real-time status monitoring of running subagents
- **Resource Management**: Automatic cleanup of panes when agents complete

## Installation

To install this package, you must have Pi and cmux already on your PATH, a model provider authenticated, and Pi must be launched inside a cmux terminal surface.

```bash
pi install git:github.com/motionid/cmuxagent@v1
cmux hooks pi install
pi
```

## Usage

The package provides three main tools:

1. `subagent` - Spawns a new subagent in a dedicated pane
2. `subagent_message` - Sends a message to a running or finished subagent by name
3. `subagents_list` - Lists all available subagent definitions

### Example Usage

```typescript
// Spawn a new subagent
await subagent({
  agent: "worker",
  name: "researcher",
  task: "Research the latest developments in AI"
});

// Send a message to a running or finished subagent
await subagent_message({
  name: "researcher",
  message: "Can you elaborate on that point?"
});

// List available subagents
const available = await subagents_list();
```

## Requirements

- cmux must be installed and available in your PATH
- Pi coding agent framework

## Testing

To run the integration tests, you need a usable authenticated model:

```bash
PI_TEST_MODEL=<provider/model> npm run test:integration
```

For example, with Qwen Cloud:

```bash
PI_TEST_MODEL=qwen-cloud/qwen3-coder-plus npm run test:integration
```

Note that the integration test requires a model provider to be authenticated and accessible.

## License

MIT