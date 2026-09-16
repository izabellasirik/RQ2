import type { RiskProfile, UploadedDocument } from '../../types';

/**
 * Lightweight, deterministic "should a broker double-check this" checks — dates and identity
 * mismatches only, never an underwriting/eligibility call. Reuses data the extraction/reconciliation
 * pipeline already tracks (isMissing/isConflicting, identityReviewNote, mvr, registeredOwner) rather
 * than a parallel source of truth. A flag here is always advisory, never an error: e.g. a vehicle's
 * registered owner differing from the Named Insured is common and legitimate (a leasing company), so
 * it's surfaced, not blocked.
 */

export interface ReviewFlag {
  id: string;
  message: string;
  severity: 'info' | 'warning';
}

function daysBetween(fromIso: string, toIso: string): number | null {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function isPastDate(dateStr: string | undefined, now: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < now.getTime();
}

/** How stale an MVR report can be before it's flagged — 90 days is a common broker rule of thumb, not a carrier-specific requirement. */
const MVR_STALE_DAYS = 90;

function normalizeForCompare(value: string): string {
  return value.trim().toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');
}

export function buildReviewFlags(profile: RiskProfile, documents: UploadedDocument[], now: Date = new Date()): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  const nowIso = now.toISOString();

  for (const driver of profile.drivers) {
    const label = driver.name ?? 'A driver';

    if (driver.identityReviewNote) {
      flags.push({ id: `driver-identity-${driver.id}`, message: driver.identityReviewNote, severity: 'warning' });
    }

    if (isPastDate(driver.expirationDate, now)) {
      flags.push({ id: `license-expired-${driver.id}`, message: `${label}'s driver's license appears expired (expired ${driver.expirationDate}).`, severity: 'warning' });
    }

    if (driver.mvr) {
      if (driver.mvr.medicalCertStatus === 'expired' || isPastDate(driver.mvr.medicalCertExpirationDate, now)) {
        flags.push({ id: `medical-cert-expired-${driver.id}`, message: `${label}'s medical certificate appears expired.`, severity: 'warning' });
      }
      if (driver.mvr.reportDate) {
        const age = daysBetween(driver.mvr.reportDate, nowIso);
        if (age !== null && age > MVR_STALE_DAYS) {
          flags.push({ id: `mvr-stale-${driver.id}`, message: `${label}'s MVR report is ${age} days old — consider requesting a more recent one.`, severity: 'info' });
        }
      }
      if (driver.mvr.violations.length > 1) {
        flags.push({ id: `mvr-violations-${driver.id}`, message: `${label}'s MVR shows ${driver.mvr.violations.length} violations — review required.`, severity: 'warning' });
      }
    }
  }

  // VIN conflicts (two vehicles rows reading the same VIN differently after a merge) already carry
  // their own field-level isConflicting flag via fieldConfidence/conflicts on the row (see
  // reconcileImageExtraction.ts) — represented here just as a one-line summary rather than
  // duplicating the per-field detail already visible on the Fleet tab.
  const vinConflictCount = profile.vehicles.filter((v) => v.conflicts && Object.keys(v.conflicts).some((k) => k === 'vin')).length;
  if (vinConflictCount > 0) {
    flags.push({ id: 'vin-conflicts', message: `${vinConflictCount} vehicle${vinConflictCount === 1 ? '' : 's'} ${vinConflictCount === 1 ? 'has' : 'have'} a VIN read differently by two sources — review before submitting.`, severity: 'warning' });
  }

  const namedInsured = profile.business.namedInsured.value;
  if (namedInsured) {
    for (const vehicle of profile.vehicles) {
      if (vehicle.registeredOwner && normalizeForCompare(vehicle.registeredOwner) !== normalizeForCompare(namedInsured)) {
        flags.push({
          id: `registered-owner-${vehicle.id}`,
          message: `Registration owner "${vehicle.registeredOwner}" differs from Named Insured "${namedInsured}"${vehicle.vin ? ` (VIN ${vehicle.vin})` : ''} — this is common (e.g. a leasing company) but worth confirming.`,
          severity: 'info',
        });
      }
    }
  }

  // Duplicate documents: same file name + byte size uploaded more than once — a broker-facing hint,
  // not an automatic dedup (a genuinely different document can share a generic name like "scan.pdf").
  const seen = new Map<string, number>();
  for (const doc of documents) {
    const key = `${doc.name.toLowerCase()}::${doc.sizeBytes}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const duplicateNames = Array.from(seen.entries()).filter(([, count]) => count > 1);
  for (const [key, count] of duplicateNames) {
    const name = key.split('::')[0];
    flags.push({ id: `duplicate-doc-${key}`, message: `"${name}" appears to have been uploaded ${count} times.`, severity: 'info' });
  }

  return flags;
}
