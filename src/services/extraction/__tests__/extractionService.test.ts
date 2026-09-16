import { describe, expect, it } from 'vitest';
import type { ExtractedFieldResult } from '../../../types';
import { createEmptyRiskProfile } from '../emptyRiskProfile';
import { mergeIntoRiskProfile, applyManualEdit, updateRecordEntry } from '../extractionService';
import { buildReviewFlags } from '../reviewFlags';

function result(overrides: Partial<ExtractedFieldResult>): ExtractedFieldResult {
  return {
    fieldPath: 'business.namedInsured',
    value: 'ABC Trucking LLC',
    confidence: 'high',
    source: { documentId: 'doc_1', documentName: 'application.pdf' },
    extractionMethod: 'ai_extraction',
    ...overrides,
  };
}

describe('TEST 3 — Named Insured stays the business; a driver never overwrites it', () => {
  it('keeps business.namedInsured as the business name after a driver row is added from a license', () => {
    let profile = createEmptyRiskProfile('acct_1');
    profile = mergeIntoRiskProfile(profile, [
      result({ fieldPath: 'business.namedInsured', value: 'ABC Trucking LLC' }),
      result({ fieldPath: 'drivers', value: { name: 'John Smith' }, confidence: 'medium', source: { documentId: 'doc_2', documentName: 'license.jpg' } }),
    ]);
    expect(profile.business.namedInsured.value).toBe('ABC Trucking LLC');
    expect(profile.drivers).toHaveLength(1);
    expect(profile.drivers[0].name).toBe('John Smith');
  });
});

describe('TEST 4 — registered owner differing from Named Insured is preserved and flagged, not overwritten', () => {
  it('keeps both values and raises an informational review flag', () => {
    let profile = createEmptyRiskProfile('acct_1');
    profile = mergeIntoRiskProfile(profile, [result({ fieldPath: 'business.namedInsured', value: 'ABC Trucking LLC' })]);
    profile.vehicles = [{ id: 'veh_1', vin: '1FTFW1ET1EFA00001', registeredOwner: 'ABC Leasing LLC' }];

    expect(profile.business.namedInsured.value).toBe('ABC Trucking LLC');
    expect(profile.vehicles[0].registeredOwner).toBe('ABC Leasing LLC');

    const flags = buildReviewFlags(profile, []);
    const flag = flags.find((f) => f.id.startsWith('registered-owner-'));
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('info');
    expect(flag!.message).toMatch(/differs from Named Insured/);
  });
});

describe('TEST 5 — two possible Named Insured values, insufficient confidence: needs review, never arbitrarily chosen', () => {
  it('flags a conflict instead of silently picking either value', () => {
    let profile = createEmptyRiskProfile('acct_1');
    profile = mergeIntoRiskProfile(profile, [
      result({ fieldPath: 'business.namedInsured', value: 'ABC Trucking LLC', confidence: 'medium', source: { documentId: 'doc_1', documentName: 'a.pdf' } }),
      result({ fieldPath: 'business.namedInsured', value: 'ABC Transportation Inc.', confidence: 'medium', source: { documentId: 'doc_2', documentName: 'b.pdf' } }),
    ]);
    expect(profile.business.namedInsured.isConflicting).toBe(true);
    expect(profile.business.namedInsured.alternateValues?.length).toBeGreaterThan(0);
    // Whichever value is primary, the other is preserved as an alternate — never dropped.
    const allValues = [profile.business.namedInsured.value, ...(profile.business.namedInsured.alternateValues ?? []).map((a) => a.value)];
    expect(allValues).toContain('ABC Trucking LLC');
    expect(allValues).toContain('ABC Transportation Inc.');
  });
});

describe('TEST 6 — a broker manual correction persists; a later extraction never silently overwrites it', () => {
  it('keeps the manual value as primary and files a disagreeing extraction as a visible conflict instead of replacing it', () => {
    let profile = createEmptyRiskProfile('acct_1');
    profile = applyManualEdit(profile, 'transportation', 'mcNumber', '123456');
    expect(profile.transportation.mcNumber.confidence).toBe('manual');

    profile = mergeIntoRiskProfile(profile, [
      { fieldPath: 'transportation.mcNumber', value: '999999', confidence: 'high', source: { documentId: 'doc_1', documentName: 'application.pdf' }, extractionMethod: 'ai_extraction' },
    ]);

    // The broker's value is still what's shown...
    expect(profile.transportation.mcNumber.value).toBe('123456');
    expect(profile.transportation.mcNumber.confidence).toBe('manual');
    // ...but the disagreement is visible, not silently dropped.
    expect(profile.transportation.mcNumber.isConflicting).toBe(true);
    expect(profile.transportation.mcNumber.alternateValues?.some((a) => a.value === '999999')).toBe(true);
  });

  it('never mutates an existing manually-edited itemized row (vehicles/drivers) in place — extraction can only add new rows', () => {
    let profile = createEmptyRiskProfile('acct_1');
    profile.vehicles = updateRecordEntry([{ id: 'veh_1', vin: 'OLDVIN0000000000X' }], 'veh_1', { vin: 'CORRECTED00000001' });
    expect(profile.vehicles[0].isManual).toBe(true);
    expect(profile.vehicles[0].vin).toBe('CORRECTED00000001');

    profile = mergeIntoRiskProfile(profile, [
      { fieldPath: 'vehicles', value: { vin: 'CORRECTED00000001', make: 'FORD' }, confidence: 'high', source: { documentId: 'doc_1', documentName: 'registration.pdf' }, extractionMethod: 'ai_extraction' },
    ]);

    // The broker's row is untouched...
    const manualRow = profile.vehicles.find((v) => v.id === 'veh_1');
    expect(manualRow?.vin).toBe('CORRECTED00000001');
    expect(manualRow?.make).toBeUndefined();
    // ...a disagreeing/partial read from a document becomes its own row rather than overwriting it.
    expect(profile.vehicles.length).toBeGreaterThan(1);
  });
});

describe('TEST 8 — missing contact info stays empty and editable, never hallucinated', () => {
  it('leaves business.phone/email and driver phone/email missing when no document mentions them', () => {
    const profile = createEmptyRiskProfile('acct_1');
    expect(profile.business.phone.isMissing).toBe(true);
    expect(profile.business.phone.value).toBeNull();
    expect(profile.business.email.isMissing).toBe(true);
    expect(profile.business.email.value).toBeNull();

    profile.drivers = [{ id: 'drv_1', name: 'John Smith' }];
    expect(profile.drivers[0].phone).toBeUndefined();
    expect(profile.drivers[0].email).toBeUndefined();
  });
});
