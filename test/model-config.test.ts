import assert from 'assert';
import { test } from 'node:test';
import { resolveModel, loadModelOverrides } from '../pi-extension/subagents/model-config.js';

// Test the resolution order: explicit -> project -> global -> profile -> parent
test('resolveModel prioritizes explicit over all others', () => {
  assert.equal(
    resolveModel({ 
      explicit: "a", 
      project: "b", 
      global: "c", 
      profile: "d", 
      parent: "e", 
      available: ["a", "b", "c", "d", "e"] 
    }), 
    "a"
  );
});

test('resolveModel skips unavailable explicit model', () => {
  assert.equal(
    resolveModel({ 
      explicit: "missing", 
      project: "b", 
      global: "c", 
      profile: "d", 
      parent: "e", 
      available: ["b", "c", "d", "e"] 
    }), 
    "b"
  );
});

test('resolveModel falls back to project when explicit is missing', () => {
  assert.equal(
    resolveModel({ 
      project: "b", 
      global: "c", 
      profile: "d", 
      parent: "e", 
      available: ["b", "c", "d", "e"] 
    }), 
    "b"
  );
});

test('resolveModel skips unavailable project model', () => {
  assert.equal(
    resolveModel({ 
      project: "missing", 
      global: "c", 
      profile: "d", 
      parent: "e", 
      available: ["c", "d", "e"] 
    }), 
    "c"
  );
});

test('resolveModel falls back to global when project is missing', () => {
  assert.equal(
    resolveModel({ 
      global: "c", 
      profile: "d", 
      parent: "e", 
      available: ["c", "d", "e"] 
    }), 
    "c"
  );
});

test('resolveModel skips unavailable global model', () => {
  assert.equal(
    resolveModel({ 
      global: "missing", 
      profile: "d", 
      parent: "e", 
      available: ["d", "e"] 
    }), 
    "d"
  );
});

test('resolveModel falls back to profile when global is missing', () => {
  assert.equal(
    resolveModel({ 
      profile: "d", 
      parent: "e", 
      available: ["d", "e"] 
    }), 
    "d"
  );
});

test('resolveModel skips unavailable profile model', () => {
  assert.equal(
    resolveModel({ 
      profile: "missing", 
      parent: "e", 
      available: ["e"] 
    }), 
    "e"
  );
});

test('resolveModel falls back to parent when profile is missing', () => {
  assert.equal(
    resolveModel({ 
      parent: "e", 
      available: ["e"] 
    }), 
    "e"
  );
});

test('resolveModel returns undefined when no available models', () => {
  assert.equal(
    resolveModel({ 
      explicit: "missing", 
      project: "missing", 
      global: "missing", 
      profile: "missing", 
      parent: "missing", 
      available: [] 
    }), 
    undefined
  );
});

test('resolveModel returns undefined when no models provided', () => {
  assert.equal(
    resolveModel({ 
      available: ["a", "b", "c"] 
    }), 
    undefined
  );
});