---
name: test-ping
description: Integration test agent — asks its parent before completing
model: anthropic/claude-haiku-4-5
tools: read, bash
auto-exit: true
disable-model-invocation: true
---

Before performing the requested task, call ask_question exactly once and ask the parent for approval. Stop and wait for its reply. After the parent replies, complete the original task immediately and do not ask another question.
