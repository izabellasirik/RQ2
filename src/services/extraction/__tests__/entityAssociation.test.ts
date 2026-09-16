import { describe, expect, it } from 'vitest';
import type { DriverEntry } from '../../../types';
import { resolveMvrAssociation, applyMvrCandidate, isAmbiguousNameMatch, isExactNameMatch } from '../entityAssociation';
import type { MvrCandidate } from '../fieldExtraction/mvrPatterns';
import { createEmptyRiskProfile } from '../emptyRiskProfile';

function driver(overrides: Partial<DriverEntry>): DriverEntry {
  return { id: `drv_${Math.random()}`, ...overrides };
}

function candidate(overrides: Partial<MvrCandidate>): MvrCandidate {
  return { record: { violations: [] }, matchedText: 'test', ...overrides };
}

describe('name matching', () => {
  it('treats identical names (ignoring case/punctuation) as an exact match', () => {
    expect(isExactNameMatch('John Smith', 'john smith')).toBe(true);
    expect(isExactNameMatch('John Smith', 'John Doe')).toBe(false);
  });

  it('flags a close-but-different name as ambiguous, never as a match', () => {
    expect(isAmbiguousNameMatch('John Smith', 'Jonathan Smith')).toBe(true);
    expect(isAmbiguousNameMatch('John Smith', 'John Smith')).toBe(false); // exact, not ambiguous
    expect(isAmbiguousNameMatch('John Smith', 'Maria Garcia')).toBe(false); // unrelated
  });
});

describe('TEST 2 — three drivers, three licenses: no values merged', () => {
  it('keeps three distinct drivers as three distinct rows', () => {
    let profile = createEmptyRiskProfile('acct_1');
    // Simulates three separate driver's-license documents each pushing their own row — the same
    // path setByPath('drivers', ...) takes per document.
    profile.drivers = [
      driver({ name: 'John Smith', dob: '1980-01-01', licenseNumber: 'AAA111' }),
      driver({ name: 'Maria Garcia', dob: '1985-05-05', licenseNumber: 'BBB222' }),
      driver({ name: 'David Lee', dob: '1990-09-09', licenseNumber: 'CCC333' }),
    ];
    expect(profile.drivers).toHaveLength(3);
    const names = profile.drivers.map((d) => d.name);
    expect(new Set(names).size).toBe(3);
    // No cross-contamination of license numbers between rows.
    expect(profile.drivers.find((d) => d.name === 'John Smith')?.licenseNumber).toBe('AAA111');
    expect(profile.drivers.find((d) => d.name === 'Maria Garcia')?.licenseNumber).toBe('BBB222');
  });
});

describe('TEST 7 — MVR association', () => {
  it('associates an MVR to the one driver with a matching license number, even with no other signal', () => {
    const drivers = [driver({ name: 'John Smith', licenseNumber: 'AAA111' }), driver({ name: 'Jonathan Smith', licenseNumber: 'BBB222' })];
    const result = resolveMvrAssociation(candidate({ licenseNumberHint: 'aaa111' }), drivers);
    expect(result).toEqual({ type: 'matched', driverId: drivers[0].id });
  });

  it('flags an ambiguous name (John Smith vs Jonathan Smith) for review instead of guessing', () => {
    const drivers = [driver({ name: 'John Smith' }), driver({ name: 'Jonathan Smith' })];
    const result = resolveMvrAssociation(candidate({ driverNameHint: 'Jon Smith' }), drivers);
    expect(result.type).toBe('ambiguous');
    if (result.type === 'ambiguous') {
      expect(result.note).toMatch(/unable to confidently determine/i);
    }
  });

  it('creates a new driver row when the MVR names someone not yet on file, rather than discarding it', () => {
    const drivers = [driver({ name: 'John Smith' })];
    const result = resolveMvrAssociation(candidate({ driverNameHint: 'Priya Patel' }), drivers);
    expect(result.type).toBe('new_driver');
  });

  it('applyMvrCandidate attaches the record and clears any prior review note on a confident match', () => {
    const profile = createEmptyRiskProfile('acct_1');
    profile.drivers = [driver({ name: 'John Smith', licenseNumber: 'AAA111', identityReviewNote: 'stale note' })];
    const note = applyMvrCandidate(
      profile,
      candidate({ licenseNumberHint: 'AAA111', record: { reportDate: '2024-01-01', violations: [{ date: '2023-05-01', description: 'Speeding' }] } }),
      'doc_1',
      'mvr.pdf'
    );
    expect(note).toBeNull();
    expect(profile.drivers).toHaveLength(1);
    expect(profile.drivers[0].mvr?.reportDate).toBe('2024-01-01');
    expect(profile.drivers[0].identityReviewNote).toBeUndefined();
  });

  it('applyMvrCandidate on an ambiguous match adds a new flagged row and never touches the existing similarly-named drivers', () => {
    const profile = createEmptyRiskProfile('acct_1');
    profile.drivers = [driver({ name: 'John Smith' }), driver({ name: 'Jonathan Smith' })];
    const note = applyMvrCandidate(profile, candidate({ driverNameHint: 'Jon Smith' }), 'doc_1', 'mvr.pdf');
    expect(note).not.toBeNull();
    expect(profile.drivers).toHaveLength(3);
    // Neither pre-existing driver was mutated with the new MVR data.
    expect(profile.drivers[0].mvr).toBeUndefined();
    expect(profile.drivers[1].mvr).toBeUndefined();
    expect(profile.drivers[2].identityReviewNote).toBeTruthy();
  });
});
