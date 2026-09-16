import type { FieldValue } from './common';

export interface BusinessInfo {
  namedInsured: FieldValue<string>;
  legalEntity: FieldValue<string>;
  /** "Doing business as" — optional; most accounts have none, and a blank DBA is not a data gap. */
  dba: FieldValue<string>;
  /**
   * The individual owner's name, when a document states one — distinct from, and never inferred
   * from, namedInsured/legalEntity (a business name) or any DriverEntry.name (a person who happens
   * to drive for the business). A driver's license belonging to the business's owner does NOT mean
   * ownerName should be copied from that driver row automatically; the two are only the same person
   * when a document explicitly says so (e.g. an application's "Owner" field).
   */
  ownerName: FieldValue<string>;
  /** Federal Employer Identification Number — optional. */
  fein: FieldValue<string>;
  /** Full raw address as stated in the source document, e.g. "9200 West Commerce Street, Phoenix, AZ 85043". */
  address: FieldValue<string>;
  /** Street portion only, derived from `address` when it parses as "Street, City, State ZIP". */
  city: FieldValue<string>;
  state: FieldValue<string>;
  zip: FieldValue<string>;
  /** Only set when a document explicitly states a mailing address different from the business/physical address — never defaulted or copied from `address`. */
  mailingAddress: FieldValue<string>;
  /** The business's own main phone number — distinct from any DriverEntry.phone or Contact.phone. */
  phone: FieldValue<string>;
  /** The business's own main email — distinct from any DriverEntry.email, Contact.email, or the account envelope's applicant contactEmail (types/account.ts). */
  email: FieldValue<string>;
  yearsInBusiness: FieldValue<number>;
  annualRevenue: FieldValue<number>;
  descriptionOfOperations: FieldValue<string>;
  /** Requested policy effective date, as a plain string (e.g. "2026-01-01") — not parsed/validated as a real date type, same treatment as every other date-shaped field in this app (DriverEntry.dob, LossEntry.lossDate). */
  effectiveDate: FieldValue<string>;
}
