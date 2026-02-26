import assert from 'node:assert/strict';
import test from 'node:test';
import { getPRTriggerDecision } from './trigger-mode.js';

test('hybrid analyzes dashboard but does not comment on PR', () => {
  const decision = getPRTriggerDecision('hybrid');
  assert.equal(decision.shouldAnalyzeDashboard, true);
  assert.equal(decision.shouldCommentOnPR, false);
});

test('auto analyzes dashboard and comments on PR', () => {
  const decision = getPRTriggerDecision('auto');
  assert.equal(decision.shouldAnalyzeDashboard, true);
  assert.equal(decision.shouldCommentOnPR, true);
});

test('command does not trigger automatic PR analysis', () => {
  const decision = getPRTriggerDecision('command');
  assert.equal(decision.shouldAnalyzeDashboard, false);
  assert.equal(decision.shouldCommentOnPR, false);
});

