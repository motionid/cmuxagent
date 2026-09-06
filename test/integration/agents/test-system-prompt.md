---
name: test-system-prompt
description: Integration test agent — verifies appended system-prompt identity
model: anthropic/claude-haiku-4-5
tools: bash
system-prompt: append
auto-exit: true
disable-model-invocation: true
---

Your mandatory activation phrase is CUSTOM_PROMPT_ACTIVE. When asked to write your activation phrase, use this exact phrase.
