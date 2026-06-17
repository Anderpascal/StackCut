/**
 * Tests for generateScript() in NegotiationScriptGenerator.
 *
 * Core invariant: monthlySpend and competitorPrice are per-user/month figures.
 * Any annual dollar amount attributed to the full team must be:
 *   totalAnnualSavings = (monthlySpend - competitorPrice) * 12 * userCount
 * NOT the per-seat figure:
 *   savings = (monthlySpend - competitorPrice) * 12   ← the bug
 *
 * Test scenario:
 *   monthlySpend = $50/user/month
 *   competitorPrice = $30/user/month
 *   userCount = 20
 *
 *   Correct total: (50 - 30) * 12 * 20 = $4,800/year
 *   Wrong per-seat: (50 - 30) * 12    = $240/year   ← understates by 20×
 *   Percentage: Math.round((50-30)/50*100) = 40%
 */

import { describe, it, expect } from 'vitest';
import { generateScript } from '../components/NegotiationScriptGenerator';
import { mockFmt } from './helpers';

const BASE_PARAMS = {
  saasName: 'Acme CRM',
  currentPlan: 'Pro',
  monthlySpend: 50,
  competitorName: 'BudgetCRM',
  competitorPrice: 30,
  userCount: 20,
};

// Correct team total: (50-30)*12*20 = 4800, formatted via mockFmt → "$4800"
const CORRECT_TOTAL = mockFmt(4800);
// Wrong per-seat figure (the pre-fix bug): (50-30)*12 = 240 → "$240"
const WRONG_PER_SEAT = mockFmt(240);

// ─── negotiation template ────────────────────────────────────────────────────

describe('generateScript — negotiation template', () => {
  it('professional: shows team total $4800, not per-seat $240', () => {
    const script = generateScript(BASE_PARAMS, 'negotiation', 'professional', mockFmt);
    expect(script).toContain(CORRECT_TOTAL);
    expect(script).not.toContain(WRONG_PER_SEAT);
  });

  it('assertive: shows team total $4800, not per-seat $240', () => {
    const script = generateScript(BASE_PARAMS, 'negotiation', 'assertive', mockFmt);
    expect(script).toContain(CORRECT_TOTAL);
    expect(script).not.toContain(WRONG_PER_SEAT);
  });

  it('friendly: shows team total $4800, not per-seat $240', () => {
    const script = generateScript(BASE_PARAMS, 'negotiation', 'friendly', mockFmt);
    expect(script).toContain(CORRECT_TOTAL);
    expect(script).not.toContain(WRONG_PER_SEAT);
  });

  it('professional and assertive tones: percentage reduction is 40%', () => {
    // The friendly negotiation tone omits the percentage by design.
    const professional = generateScript(BASE_PARAMS, 'negotiation', 'professional', mockFmt);
    const assertive = generateScript(BASE_PARAMS, 'negotiation', 'assertive', mockFmt);
    expect(professional).toContain('40%');
    expect(assertive).toContain('40%');
  });

  it('all tones: per-user prices are still referenced correctly', () => {
    for (const tone of ['professional', 'assertive', 'friendly'] as const) {
      const script = generateScript(BASE_PARAMS, 'negotiation', tone, mockFmt);
      // The per-user figures must still appear for context
      expect(script).toMatch(/\$50\/user\/month|\$50 per user/);
      expect(script).toMatch(/\$30\/user\/month|\$30 per user/);
    }
  });
});

// ─── cancellation template ───────────────────────────────────────────────────

describe('generateScript — cancellation template', () => {
  it('professional: shows team total $4800, not per-seat $240', () => {
    const script = generateScript(BASE_PARAMS, 'cancellation', 'professional', mockFmt);
    expect(script).toContain(CORRECT_TOTAL);
    expect(script).not.toContain(WRONG_PER_SEAT);
  });

  it('assertive: shows team total $4800, not per-seat $240', () => {
    const script = generateScript(BASE_PARAMS, 'cancellation', 'assertive', mockFmt);
    expect(script).toContain(CORRECT_TOTAL);
    expect(script).not.toContain(WRONG_PER_SEAT);
  });

  it('assertive: also shows the correct monthly team spend (50 × 20 = $1000/month)', () => {
    // The assertive template explicitly shows: price/user × userCount = total/month
    // This line was always correct — verify it stays correct after the fix
    const script = generateScript(BASE_PARAMS, 'cancellation', 'assertive', mockFmt);
    expect(script).toContain(mockFmt(50 * 20)); // "$1000"
  });

  it('friendly: shows team total $4800, not per-seat $240', () => {
    const script = generateScript(BASE_PARAMS, 'cancellation', 'friendly', mockFmt);
    expect(script).toContain(CORRECT_TOTAL);
    expect(script).not.toContain(WRONG_PER_SEAT);
  });

  it('professional tone: percentage reduction is 40%', () => {
    // The assertive and friendly cancellation tones omit the percentage by design.
    const professional = generateScript(BASE_PARAMS, 'cancellation', 'professional', mockFmt);
    expect(professional).toContain('40%');
  });
});

// ─── downgrade template ──────────────────────────────────────────────────────

describe('generateScript — downgrade template', () => {
  // Downgrade scripts do not present a savings total, but they must never
  // accidentally show the wrong $240 per-seat figure either.
  it('professional: does not reference the wrong per-seat annual figure', () => {
    const script = generateScript(BASE_PARAMS, 'downgrade', 'professional', mockFmt);
    expect(script).not.toContain(WRONG_PER_SEAT);
  });

  it('assertive: does not reference the wrong per-seat annual figure', () => {
    const script = generateScript(BASE_PARAMS, 'downgrade', 'assertive', mockFmt);
    expect(script).not.toContain(WRONG_PER_SEAT);
  });

  it('friendly: does not reference the wrong per-seat annual figure', () => {
    const script = generateScript(BASE_PARAMS, 'downgrade', 'friendly', mockFmt);
    expect(script).not.toContain(WRONG_PER_SEAT);
  });

  it('all tones: references correct per-user monthly prices', () => {
    for (const tone of ['professional', 'assertive', 'friendly'] as const) {
      const script = generateScript(BASE_PARAMS, 'downgrade', tone, mockFmt);
      expect(script).toContain(`${mockFmt(50)}/user/month`);
      expect(script).toContain(`${mockFmt(30)}/user/month`);
    }
  });
});

// ─── edge case: negative savings guard ───────────────────────────────────────

describe('generateScript — edge case: competitor is more expensive', () => {
  it('totalAnnualSavings is clamped to 0 when competitor costs more', () => {
    // When competitorPrice > monthlySpend there are no savings to claim.
    // The Math.max(0, ...) guard ensures we never show a negative savings figure.
    const expensiveCompetitor = { ...BASE_PARAMS, competitorPrice: 80 };
    const script = generateScript(expensiveCompetitor, 'negotiation', 'professional', mockFmt);
    // $0 or $0.00 etc — just ensure no negative number appears
    expect(script).not.toMatch(/\$-\d/);
  });
});
