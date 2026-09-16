import type { FieldSource } from './common';

/**
 * A named person associated with the account who is NOT necessarily the Named Insured, an Owner,
 * or a Driver — e.g. an office manager, a safety director, or "the person who called." Kept as its
 * own itemized array (mirrors DriverEntry/VehicleEntry) rather than folded into BusinessInfo,
 * because an account can have zero, one, or several contacts and none of them need be the same
 * entity as the business itself. Extraction never invents a role — a document has to say who the
 * person is relative to the account, or `role` stays blank rather than guessed.
 */
export interface Contact {
  id: string;
  name?: string;
  /** Free text as stated by the document/broker, e.g. "Safety Director", "Office Manager" — never inferred. */
  role?: string;
  phone?: string;
  email?: string;
  /** Absent for a broker-added row (isManual: true) — there is no document to point to. */
  source?: FieldSource;
  /** True for a row the broker added or edited directly, rather than one extracted from a document. */
  isManual?: boolean;
  lastUpdatedAt?: string;
}
