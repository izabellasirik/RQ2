import type { DriverEntry, FieldSource, MvrRecord, RiskProfile } from '../../types';
import type { MvrCandidate } from './fieldExtraction/mvrPatterns';
import { generateId } from '../../utils/id';

/**
 * Entity-aware association: decides which existing DriverEntry (if any) a standalone document —
 * today, an MVR — actually belongs to, WITHOUT ever merging two different people because their
 * documents happened to be uploaded together. The default when identity can't be confidently
 * resolved is a new, clearly-flagged row, never a silent guess onto an existing one. This is the
 * direct fix for the real-world failure mode named in the product brief: two drivers named
 * similarly (e.g. "John Smith" and "Jonathan Smith") must never collapse into one.
 */

function normalizeNameForMatch(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokens(name: string): string[] {
  return normalizeNameForMatch(name).split(' ').filter(Boolean);
}

/** Exact match once case/whitespace/punctuation are normalized away — the only case treated as fully confident on name alone. */
function isExactNameMatch(a: string, b: string): boolean {
  return normalizeNameForMatch(a) === normalizeNameForMatch(b);
}

/** True when `shorter`'s letters all appear in `longer`, in order (not necessarily contiguous) — catches a nickname/full-name relationship like "John" inside "Jonathan" or "Bob" inside "Bobby", which a plain prefix check misses. */
function isSubsequence(shorter: string, longer: string): boolean {
  let i = 0;
  for (const ch of longer) {
    if (i < shorter.length && shorter[i] === ch) i++;
  }
  return i === shorter.length;
}

/**
 * True when two names are close enough to plausibly be confused for each other (share a surname,
 * and the given name is the same or a nickname-style relation of the other, e.g. "John Smith" /
 * "Jonathan Smith", or "Bob Lee" / "Bobby Lee") but are NOT an exact match. This is intentionally
 * the trigger for "needs review," never for "treat as the same person."
 */
function isAmbiguousNameMatch(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  if (ta.join(' ') === tb.join(' ')) return false; // exact — not ambiguous, just a match
  const surnameMatches = ta[ta.length - 1] === tb[tb.length - 1];
  if (!surnameMatches) return false;
  const givenA = ta[0];
  const givenB = tb[0];
  if (!givenA || !givenB || givenA[0] !== givenB[0]) return false;
  if (givenA === givenB) return true;
  const [shorter, longer] = givenA.length <= givenB.length ? [givenA, givenB] : [givenB, givenA];
  return isSubsequence(shorter, longer);
}

export type MvrAssociationResult =
  | { type: 'matched'; driverId: string }
  | { type: 'ambiguous'; candidateDriverIds: string[]; note: string }
  | { type: 'new_driver'; note?: string };

/**
 * Decides where one extracted MvrCandidate belongs among the drivers already on the profile.
 * Priority: an exact license-number match is the strongest possible signal (two people never
 * legitimately share a license number); then DOB + a matching/exact name; then name alone. A name
 * that's close-but-not-exact to more than one distinct existing driver — or to one existing driver
 * when no stronger signal is available to confirm it — is reported as ambiguous rather than guessed.
 */
export function resolveMvrAssociation(candidate: MvrCandidate, drivers: DriverEntry[]): MvrAssociationResult {
  if (candidate.licenseNumberHint) {
    const byLicense = drivers.filter((d) => d.licenseNumber && d.licenseNumber.toUpperCase() === candidate.licenseNumberHint!.toUpperCase());
    if (byLicense.length === 1) return { type: 'matched', driverId: byLicense[0].id };
  }

  if (candidate.dobHint) {
    const byDob = drivers.filter((d) => d.dob === candidate.dobHint);
    if (byDob.length === 1) {
      if (!candidate.driverNameHint || !byDob[0].name || isExactNameMatch(candidate.driverNameHint, byDob[0].name)) {
        return { type: 'matched', driverId: byDob[0].id };
      }
    }
  }

  if (candidate.driverNameHint) {
    const exact = drivers.filter((d) => d.name && isExactNameMatch(d.name, candidate.driverNameHint!));
    if (exact.length === 1) return { type: 'matched', driverId: exact[0].id };
    if (exact.length > 1) {
      // Two existing rows already share this exact name — can't tell which one this MVR is for.
      return {
        type: 'ambiguous',
        candidateDriverIds: exact.map((d) => d.id),
        note: `Multiple drivers named "${candidate.driverNameHint}" are already on file — unable to confidently determine which one this MVR belongs to.`,
      };
    }

    const ambiguous = drivers.filter((d) => d.name && isAmbiguousNameMatch(d.name, candidate.driverNameHint!));
    if (ambiguous.length > 0) {
      const names = Array.from(new Set([candidate.driverNameHint, ...ambiguous.map((d) => d.name!)]));
      return {
        type: 'ambiguous',
        candidateDriverIds: ambiguous.map((d) => d.id),
        note: `Unable to confidently determine whether this MVR belongs to ${names.join(' or ')} — please review.`,
      };
    }

    // No existing driver has a name anywhere close to this one — this is very likely a genuinely
    // new person, not a document that failed to match. Adding them (flagged, since we only have an
    // MVR and not a license) beats silently discarding a real driver's history.
    return { type: 'new_driver' };
  }

  // No name, DOB, or license number could be read off the report at all — there is nothing to
  // match against, and nothing to safely name a new row with either.
  return { type: 'new_driver', note: 'An MVR / driver history report was uploaded, but the driver it belongs to could not be determined. Review and assign it to the correct driver, or delete it if it duplicates one already on file.' };
}

function mvrSource(documentId: string, documentName: string, excerpt: string): FieldSource {
  return { documentId, documentName, excerpt };
}

/**
 * Applies one extracted MvrCandidate to the profile's drivers array, in place — the single place
 * this app ever attaches MVR data to a driver. Mutates `profile.drivers` and returns a short,
 * broker-facing note when the result needs attention (ambiguous or newly-created), so the caller
 * can log/surface it; returns null when the association was confident and silent (the normal case).
 */
export function applyMvrCandidate(profile: RiskProfile, candidate: MvrCandidate, documentId: string, documentName: string): string | null {
  const result = resolveMvrAssociation(candidate, profile.drivers);
  const source = mvrSource(documentId, documentName, candidate.matchedText);
  const record: MvrRecord = { ...candidate.record, source, lastUpdatedAt: new Date().toISOString() };

  if (result.type === 'matched') {
    profile.drivers = profile.drivers.map((d) => (d.id === result.driverId ? { ...d, mvr: record, identityReviewNote: undefined } : d));
    return null;
  }

  if (result.type === 'ambiguous') {
    const newDriver: DriverEntry = {
      id: generateId('drv'),
      name: candidate.driverNameHint,
      dob: candidate.dobHint,
      licenseNumber: candidate.licenseNumberHint,
      licenseState: candidate.licenseStateHint,
      mvr: record,
      identityReviewNote: result.note,
      source,
      lastUpdatedAt: new Date().toISOString(),
    };
    profile.drivers = [...profile.drivers, newDriver];
    return result.note;
  }

  // new_driver
  const newDriver: DriverEntry = {
    id: generateId('drv'),
    name: candidate.driverNameHint,
    dob: candidate.dobHint,
    licenseNumber: candidate.licenseNumberHint,
    licenseState: candidate.licenseStateHint,
    mvr: record,
    identityReviewNote: result.note,
    source,
    lastUpdatedAt: new Date().toISOString(),
  };
  profile.drivers = [...profile.drivers, newDriver];
  return result.note ?? null;
}

/** Same ambiguity check, exposed for a newly-extracted driver-license row (see extractionService.ts's setByPath) — flags, never merges, two close-but-different names on file. */
export { isAmbiguousNameMatch, isExactNameMatch };
