import type { BusinessInfo } from './business';
import type { TransportationInfo } from './transportation';
import type { LossEntry } from './loss';
import type { CoverageLine } from './coverage';
import type { VehicleEntry } from './vehicle';
import type { DriverEntry } from './driver';
import type { Contact } from './contact';

export interface RiskProfile {
  id: string;
  accountId: string;
  business: BusinessInfo;
  transportation: TransportationInfo;
  lossHistory: LossEntry[];
  coverage: CoverageLine[];
  /** Itemized fleet, e.g. from a vehicle schedule spreadsheet. Distinct from transportation.fleetSize/vehicleTypes, which are broker-editable summary fields that may be entered independently of any itemized schedule. */
  vehicles: VehicleEntry[];
  /** Itemized drivers, e.g. from a driver schedule spreadsheet. */
  drivers: DriverEntry[];
  /** People associated with the account who aren't necessarily the Named Insured, an Owner, or a Driver — see types/contact.ts. */
  contacts: Contact[];
  updatedAt: string;
}

/** A flattened pointer to any FieldValue-bearing field in the profile, used by the UI to render/edit generically. */
export type RiskProfileSection = 'business' | 'transportation';
