import { describe, expect, it } from 'vitest';
import type { DriverEntry } from '../../../types';
import { createEmptyRiskProfile } from '../emptyRiskProfile';
import { buildReviewFlags } from '../reviewFlags';

const NOW = new Date('2026-06-01T00:00:00.000Z');

function driver(overrides: Partial<DriverEntry>): DriverEntry {
  return { id: `drv_${Math.random()}`, ...overrides };
}

describe('buildReviewFlags — deterministic, advisory, never an eligibility call', () => {
  it('flags an expired license without blocking anything else', () => {
    const profile = createEmptyRiskProfile('acct_1');
    profile.drivers = [driver({ name: 'John Smith', expirationDate: '2020-01-01' })];
    const flags = buildReviewFlags(profile, [], NOW);
    expect(flags.some((f) => f.id.startsWith('license-expired-'))).toBe(true);
  });

  it('does not flag a license that has not expired yet', () => {
    const profile = createEmptyRiskProfile('acct_1');
    profile.drivers = [driver({ name: 'John Smith', expirationDate: '2030-01-01' })];
    const flags = buildReviewFlags(profile, [], NOW);
    expect(flags.some((f) => f.id.startsWith('license-expired-'))).toBe(false);
  });

  it('flags an expired medical certificate and a stale MVR report', () => {
    const profile = createEmptyRiskProfile('acct_1');
    profile.drivers = [
      driver({
        name: 'John Smith',
        mvr: { reportDate: '2026-01-01', violations: [], medicalCertStatus: 'expired', medicalCertExpirationDate: '2025-01-01' },
      }),
    ];
    const flags = buildReviewFlags(profile, [], NOW);
    expect(flags.some((f) => f.id.startsWith('medical-cert-expired-'))).toBe(true);
    expect(flags.some((f) => f.id.startsWith('mvr-stale-'))).toBe(true);
  });

  it('flags multiple violations for broker review, but a single violation does not trigger it', () => {
    const profile = createEmptyRiskProfile('acct_1');
    profile.drivers = [
      driver({ name: 'A', mvr: { violations: [{ date: '2025-01-01', description: 'Speeding' }, { date: '2025-06-01', description: 'Failure to signal' }] } }),
      driver({ name: 'B', mvr: { violations: [{ date: '2025-01-01', description: 'Speeding' }] } }),
    ];
    const flags = buildReviewFlags(profile, [], NOW);
    expect(flags.filter((f) => f.id.startsWith('mvr-violations-'))).toHaveLength(1);
  });

  it('surfaces a driver identity review note as its own flag', () => {
    const profile = createEmptyRiskProfile('acct_1');
    profile.drivers = [driver({ name: 'Jon Smith', identityReviewNote: 'Unable to confidently determine whether this MVR belongs to Jon Smith or John Smith — please review.' })];
    const flags = buildReviewFlags(profile, [], NOW);
    const flag = flags.find((f) => f.id.startsWith('driver-identity-'));
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warning');
  });

  it('flags a document uploaded more than once by name+size', () => {
    const profile = createEmptyRiskProfile('acct_1');
    const docs = [
      { id: 'd1', accountId: 'acct_1', name: 'license.jpg', fileType: 'image' as const, category: 'driver_license' as const, uploadedAt: NOW.toISOString(), status: 'processed' as const, sizeBytes: 1000 },
      { id: 'd2', accountId: 'acct_1', name: 'license.jpg', fileType: 'image' as const, category: 'driver_license' as const, uploadedAt: NOW.toISOString(), status: 'processed' as const, sizeBytes: 1000 },
    ];
    const flags = buildReviewFlags(profile, docs, NOW);
    expect(flags.some((f) => f.id.startsWith('duplicate-doc-'))).toBe(true);
  });

  it('never flags a registered-owner difference when there is no Named Insured to compare against', () => {
    const profile = createEmptyRiskProfile('acct_1');
    profile.vehicles = [{ id: 'veh_1', registeredOwner: 'ABC Leasing LLC' }];
    const flags = buildReviewFlags(profile, [], NOW);
    expect(flags.some((f) => f.id.startsWith('registered-owner-'))).toBe(false);
  });
});
