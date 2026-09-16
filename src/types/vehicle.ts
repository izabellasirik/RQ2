import type { Confidence, FieldConflict, FieldSource } from './common';

export interface VehicleEntry {
  id: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  value?: number;
  /** Normalized category (Tractor / Power Unit, Straight Truck, Trailer, Van, Pickup) — only set when an explicit type/body-type column says so, never guessed from make/model. */
  bodyType?: string;
  /** License plate as printed on a registration document/card. */
  plate?: string;
  /** As printed on a registration document — deliberately NOT assumed to equal business.namedInsured; a leasing/finance company is a common, legitimate difference (see utils reviewFlags, which surfaces a mismatch as a review flag, never an error). */
  registeredOwner?: string;
  /** The registration document's own address for the registered owner — distinct from business.address. */
  registrationAddress?: string;
  /** Per-field confidence for values read off a document — see DriverEntry.fieldConfidence, same idea. */
  fieldConfidence?: Partial<Record<string, Confidence>>;
  /** Fields where the vision model and OCR read this row differently — see FieldConflict. */
  conflicts?: Partial<Record<string, FieldConflict[]>>;
  /** Absent for a broker-added row (isManual: true) — there is no document to point to. */
  source?: FieldSource;
  /** True for a row the broker added or edited directly, rather than one extracted from a document. Deleting a document never removes or alters a manual row. */
  isManual?: boolean;
  lastUpdatedAt?: string;
}
