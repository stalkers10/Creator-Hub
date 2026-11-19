/**
 * Pure unit tests for the quota time helpers (no mocks needed — no DB).
 *
 * Properties verified:
 *  P1  getUsageDateString returns the correct local date at UTC midnight.
 *  P2  getUsageDateString advances the date when the offset pushes past midnight.
 *  P3  getResetsAt returns the next local midnight in UTC.
 *  P4  remainingSeconds never returns a negative value.
 *  P5  remainingSeconds returns 0 when usage equals the limit.
 */

import { describe, expect, it } from 'vitest';

import { getResetsAt, getUsageDateString, remainingSeconds } from './quota';

describe('getUsageDateString', () => {
  it('P1 — returns correct date at UTC midnight with UTC+1 offset', () => {
    // 2026-11-19T23:00:00Z is 2026-11-20T00:00:00+01:00
    const now = new Date('2026-11-19T23:00:00Z');
    expect(getUsageDateString(now, 60)).toBe('2026-11-20');
  });

  it('P2 — stays on same date when offset does not push past midnight', () => {
    // 2026-11-19T22:59:00Z is 2026-11-19T23:59:00+01:00
    const now = new Date('2026-11-19T22:59:00Z');
    expect(getUsageDateString(now, 60)).toBe('2026-11-19');
  });

  it('works with zero offset (UTC)', () => {
    const now = new Date('2026-11-19T12:00:00Z');
    expect(getUsageDateString(now, 0)).toBe('2026-11-19');
  });
});

describe('getResetsAt', () => {
  it('P3 — returns next local midnight as UTC', () => {
    // Local date with UTC+1: 2026-11-19 → resets at 2026-11-20T00:00+01:00 = 2026-11-19T23:00:00Z
    const now = new Date('2026-11-19T12:00:00Z');
    const resetsAt = getResetsAt(now, 60);
    expect(resetsAt.toISOString()).toBe('2026-11-19T23:00:00.000Z');
  });

  it('returns midnight UTC when offset is 0', () => {
    const now = new Date('2026-11-19T12:00:00Z');
    const resetsAt = getResetsAt(now, 0);
    expect(resetsAt.toISOString()).toBe('2026-11-20T00:00:00.000Z');
  });
});

describe('remainingSeconds', () => {
  it('P4 — never returns negative', () => {
    expect(remainingSeconds(1000, 900)).toBe(0);
  });

  it('P5 — returns 0 when usage equals the limit', () => {
    expect(remainingSeconds(900, 900)).toBe(0);
  });

  it('returns correct remaining when below limit', () => {
    expect(remainingSeconds(300, 900)).toBe(600);
  });

  it('returns full limit when nothing used', () => {
    expect(remainingSeconds(0, 900)).toBe(900);
  });
});
