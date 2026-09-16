import type { FieldSource } from './common';

export interface MvrViolation {
  date?: string;
  /** Free text as printed on the report — never paraphrased or invented. */
  description?: string;
  /** Only ever set from an explicit "major/serious" vs "minor" marking on the report itself — never an underwriting judgment call this app makes on its own. */
  severity?: 'minor' | 'major' | 'unknown';
}

/**
 * One MVR (Motor Vehicle Record) report, associated with exactly one DriverEntry once identity is
 * confident enough — see services/extraction/entityAssociation.ts. Deliberately basic/deterministic:
 * this version surfaces facts (dates, violations, medical cert status) for the broker to review, and
 * does not make any eligibility/underwriting call.
 */
export interface MvrRecord {
  reportDate?: string;
  /** As stated on the report, e.g. "3-year", "5-year" — never computed from dates alone. */
  historyPeriod?: string;
  violations: MvrViolation[];
  medicalCertStatus?: 'valid' | 'expired' | 'unknown';
  medicalCertExpirationDate?: string;
  /** Absent for a broker-entered record — there is no document to point to. */
  source?: FieldSource;
  isManual?: boolean;
  lastUpdatedAt?: string;
}
