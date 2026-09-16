import type { RiskProfile } from '../../types';
import { emptyField } from '../../types';
import { generateId } from '../../utils/id';

export function createEmptyRiskProfile(accountId: string): RiskProfile {
  return {
    id: generateId('risk'),
    accountId,
    business: {
      namedInsured: emptyField(),
      legalEntity: emptyField(),
      dba: emptyField(),
      ownerName: emptyField(),
      fein: emptyField(),
      address: emptyField(),
      city: emptyField(),
      state: emptyField(),
      zip: emptyField(),
      mailingAddress: emptyField(),
      phone: emptyField(),
      email: emptyField(),
      yearsInBusiness: emptyField(),
      annualRevenue: emptyField(),
      descriptionOfOperations: emptyField(),
      effectiveDate: emptyField(),
    },
    transportation: {
      dotNumber: emptyField(),
      mcNumber: emptyField(),
      fleetSize: emptyField(),
      vehicleTypes: emptyField(),
      operatingRadius: emptyField(),
      statesOfOperation: emptyField(),
      commoditiesHauled: emptyField(),
      driverCount: emptyField(),
      minDriverAge: emptyField(),
      minDriverExperienceYears: emptyField(),
      telematics: emptyField(),
      dashcams: emptyField(),
    },
    lossHistory: [],
    coverage: [],
    vehicles: [],
    drivers: [],
    contacts: [],
    updatedAt: new Date().toISOString(),
  };
}
