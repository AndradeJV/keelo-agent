import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQualitySignal, calculateAcceptanceRate, getWeeklyWindow } from './metrics-utils.js';

test('calculateAcceptanceRate returns bounded percentage', () => {
  assert.equal(calculateAcceptanceRate(8, 10), 80);
  assert.equal(calculateAcceptanceRate(0, 0), 0);
  assert.equal(calculateAcceptanceRate(12, 10), 100);
});

test('buildQualitySignal low confidence without source', () => {
  const signal = buildQualitySignal('jira', false, false);
  assert.equal(signal.confidence, 'low');
  assert.equal(signal.freshness, 'unknown');
});

test('getWeeklyWindow produces report key and iso dates', () => {
  const result = getWeeklyWindow(new Date('2026-02-17T12:00:00.000Z'));
  assert.match(result.startISO, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(result.endISO, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(result.reportKey, /^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/);
});

