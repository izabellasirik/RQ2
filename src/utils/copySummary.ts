import type { Account, RiskProfile } from '../types';
import { COVERAGE_LABELS } from '../types';
import { displayReadValue } from '../components/riskProfile/FieldRow';
import { formatCurrencyValue } from './currency';

/**
 * Builds a clean, plain-text summary of an account — the "Copy All" feature. Deliberately no UI
 * labels/jargon (no "FieldValue", no confidence badges, no "AI Extracted") and no blank/missing
 * lines cluttering the output — a field with nothing in it is simply omitted, exactly the way a
 * broker would type up a clean Notepad version by hand. Meant to paste into an email, Notepad, a
 * carrier portal, or a CRM note as-is.
 */

function line(label: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value) && value.length === 0) return null;
  return `${label}: ${displayReadValue(value)}`;
}

function section(title: string, lines: (string | null)[]): string | null {
  const filled = lines.filter((l): l is string => l !== null);
  if (filled.length === 0) return null;
  return `${title}\n${filled.join('\n')}`;
}

export function buildAccountCopyText(account: Account, profile: RiskProfile): string {
  const { business, transportation } = profile;
  const blocks: string[] = [];

  const insuredLines = [
    line('Named Insured', business.namedInsured.value ?? account.namedInsured),
    line('Legal Entity', business.legalEntity.value),
    line('DBA', business.dba.value),
    line('Owner', business.ownerName.value),
    line('FEIN', business.fein.value),
    line('Address', business.address.value),
    line('Mailing Address', business.mailingAddress.value),
    line('Phone', business.phone.value),
    line('Email', business.email.value),
    line('Years in Business', business.yearsInBusiness.value),
    line('Annual Revenue', business.annualRevenue.value !== null ? formatCurrencyValue(business.annualRevenue.value) : null),
    line('Description of Operations', business.descriptionOfOperations.value),
    line('Requested Effective Date', business.effectiveDate.value),
    line('DOT Number', transportation.dotNumber.value),
    line('MC Number', transportation.mcNumber.value),
    line('States of Operation', transportation.statesOfOperation.value),
    line('Operating Radius', transportation.operatingRadius.value),
    line('Commodities Hauled', transportation.commoditiesHauled.value),
    line('Fleet Size', transportation.fleetSize.value),
    line('Driver Count', transportation.driverCount.value),
  ];
  const insured = section('NAMED INSURED / BUSINESS', insuredLines);
  if (insured) blocks.push(insured);

  if (profile.contacts.length > 0) {
    const contactBlocks = profile.contacts.map((c, i) => {
      const lines = [line('Name', c.name), line('Role', c.role), line('Phone', c.phone), line('Email', c.email)].filter((l): l is string => l !== null);
      return `Contact ${i + 1}\n${lines.join('\n')}`;
    });
    blocks.push(`CONTACTS\n\n${contactBlocks.join('\n\n')}`);
  }

  if (profile.drivers.length > 0) {
    const driverBlocks = profile.drivers.map((d, i) => {
      const lines = [
        line('Name', d.name),
        line('DOB', d.dob),
        line('Phone', d.phone),
        line('Email', d.email),
        line('License #', d.licenseNumber),
        line('License State', d.licenseState),
        line('License Class', d.licenseClass),
        line('Expiration', d.expirationDate),
        line('Years Experience', d.yearsExperience),
        line('Violations', d.violations),
        d.mvr ? line('MVR Report Date', d.mvr.reportDate) : null,
        d.mvr && d.mvr.violations.length > 0 ? line('MVR Violations', d.mvr.violations.map((v) => [v.date, v.description].filter(Boolean).join(' — ')).join('; ')) : null,
        d.mvr ? line('Medical Cert', d.mvr.medicalCertStatus) : null,
      ].filter((l): l is string => l !== null);
      return `Driver ${i + 1}\n${lines.join('\n')}`;
    });
    blocks.push(`DRIVERS\n\n${driverBlocks.join('\n\n')}`);
  }

  if (profile.vehicles.length > 0) {
    const vehicleBlocks = profile.vehicles.map((v, i) => {
      const lines = [
        line('VIN', v.vin),
        line('Year', v.year),
        line('Make', v.make),
        line('Model', v.model),
        line('Body Type', v.bodyType),
        line('Plate', v.plate),
        line('Value', v.value !== undefined ? formatCurrencyValue(v.value) : null),
        line('Registered Owner', v.registeredOwner),
      ].filter((l): l is string => l !== null);
      return `Vehicle ${i + 1}\n${lines.join('\n')}`;
    });
    blocks.push(`VEHICLES\n\n${vehicleBlocks.join('\n\n')}`);
  }

  const coverageLines = profile.coverage
    .map((c) => line(COVERAGE_LABELS[c.type], c.requestedLimit.value))
    .filter((l): l is string => l !== null);
  if (coverageLines.length > 0) blocks.push(section('COVERAGE REQUESTED', coverageLines)!);

  return blocks.join('\n\n');
}
