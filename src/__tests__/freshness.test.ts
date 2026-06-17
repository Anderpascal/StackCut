/**
 * Tests for src/lib/freshness.ts — the data-freshness trust signal.
 * Thresholds (30/90 days) must stay in lockstep with validate-data.mjs.
 */

import { describe, it, expect } from 'vitest';
import { getFreshness } from '../lib/freshness';

// A fixed "now" so the tests are deterministic regardless of when they run.
const NOW = Date.parse('2026-06-13T00:00:00Z');

describe('getFreshness', () => {
  it('marks data verified today/recently as fresh with no caveat', () => {
    expect(getFreshness('2026-06-13', NOW).level).toBe('fresh');
    expect(getFreshness('2026-06-07', NOW).level).toBe('fresh');
    expect(getFreshness('2026-06-07', NOW).caveat).toBeNull();
  });

  it('marks 30–90 day-old data as aging with a soft caveat', () => {
    const f = getFreshness('2026-04-20', NOW); // ~54 days
    expect(f.level).toBe('aging');
    expect(f.caveat).toMatch(/confirm on the vendor/i);
  });

  it('marks data older than 90 days as stale with a strong caveat', () => {
    const f = getFreshness('2026-01-01', NOW); // ~163 days
    expect(f.level).toBe('stale');
    expect(f.caveat).toMatch(/over 90 days old/i);
  });

  it('handles boundaries: exactly 30 days is still fresh, 31 is aging', () => {
    expect(getFreshness('2026-05-14', NOW).level).toBe('fresh'); // 30 days
    expect(getFreshness('2026-05-13', NOW).level).toBe('aging'); // 31 days
  });

  it('returns unknown for missing or malformed dates', () => {
    expect(getFreshness(null, NOW).level).toBe('unknown');
    expect(getFreshness(undefined, NOW).level).toBe('unknown');
    expect(getFreshness('not-a-date', NOW).level).toBe('unknown');
  });

  it('uses friendly relative labels', () => {
    expect(getFreshness('2026-06-13', NOW).label).toMatch(/today/);
    expect(getFreshness('2026-06-12', NOW).label).toMatch(/yesterday/);
    expect(getFreshness('2026-06-07', NOW).label).toMatch(/6 days ago/);
  });
});
