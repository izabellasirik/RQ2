import type { RawDocument } from '../../ingestion';
import { toTextLines, type TextLine } from './textLines';
import type { MvrRecord, MvrViolation } from '../../../types';
import { normalizeDate, normalizeIdToken, normalizePlainName } from './idDocumentPatterns';
import { parseStateFromPhrase } from '../../../utils/usStates';

/**
 * MVR (Motor Vehicle Record) detection/extraction — deliberately its own document category, never
 * folded into the driver's-license extractor. An MVR report and a driver's license commonly share
 * several labels (DOB, license number, license class, state) but describe two different things: a
 * license is an identity card, an MVR is a driving-history report FOR a person. Treating them as one
 * would mean an MVR's history/violations get discarded (the license extractor doesn't know about
 * them) or, worse, an MVR silently overwrites a driver's *license* fields wholesale. See
 * entityAssociation.ts for how an extracted MvrCandidate below gets attached (or not) to a specific
 * DriverEntry.
 */

/** True when the document's own text reads as an MVR / driving-history report, not a license/registration. */
export function detectMvr(text: string): boolean {
  const t = text.toLowerCase();
  if (/motor\s+vehicle\s+record/.test(t) || /\bmvr\b/.test(t) || /driving\s+record/.test(t) || /driver\s+history\s+report/.test(t)) return true;
  let signals = 0;
  if (/\bviolation/.test(t)) signals++;
  if (/\bconviction/.test(t)) signals++;
  if (/\blicense\s+status\b/.test(t)) signals++;
  if (/\brecord\s+status\b/.test(t)) signals++;
  if (/\bmedical\s+cert/.test(t)) signals++;
  return signals >= 3;
}

interface LineMatch {
  raw: string;
  line: TextLine;
}

function firstMatch(lines: TextLine[], patterns: RegExp[]): LineMatch | null {
  for (const line of lines) {
    for (const pattern of patterns) {
      const m = line.text.match(pattern);
      if (m && m[1]) return { raw: m[1], line };
    }
  }
  return null;
}

interface ValidMatch<T> {
  value: T;
  line: TextLine;
}

function firstValidMatch<T>(lines: TextLine[], patterns: RegExp[], validate: (raw: string) => T | null): ValidMatch<T> | null {
  for (const line of lines) {
    for (const pattern of patterns) {
      const m = line.text.match(pattern);
      if (!m || !m[1]) continue;
      const value = validate(m[1]);
      if (value !== null) return { value, line };
    }
  }
  return null;
}

/** A violation line as commonly printed: a date, then a description, optionally a severity word. Never invents a description from a bare date with nothing else on the line. */
const VIOLATION_LINE = /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s*[-:—]?\s*(.{3,120})$/;

function extractViolations(lines: TextLine[]): MvrViolation[] {
  const violations: MvrViolation[] = [];
  let inViolationsBlock = false;
  for (const line of lines) {
    const t = line.text.trim();
    if (/^violations?\b|^convictions?\b/i.test(t)) {
      inViolationsBlock = true;
      continue;
    }
    if (!inViolationsBlock) continue;
    if (t === '') continue;
    // A blank-ish header for the next section ends the block — never keeps scanning into unrelated content.
    if (/^(medical|license\s+status|record\s+status|end\s+of\s+record)\b/i.test(t)) {
      inViolationsBlock = false;
      continue;
    }
    const m = t.match(VIOLATION_LINE);
    if (!m) continue;
    const date = normalizeDate(m[1]);
    if (!date) continue;
    const description = m[2].trim().replace(/[.,;]+$/, '');
    const severity: MvrViolation['severity'] = /\bmajor\b|\bserious\b/i.test(description) ? 'major' : /\bminor\b/i.test(description) ? 'minor' : 'unknown';
    violations.push({ date, description, severity });
  }
  return violations;
}

export interface MvrCandidate {
  /** Best-effort identity hints read off the report, used only to find the matching DriverEntry — never written into the driver row directly as a wholesale replacement. */
  driverNameHint?: string;
  dobHint?: string;
  licenseNumberHint?: string;
  licenseStateHint?: string;
  record: Omit<MvrRecord, 'source' | 'isManual' | 'lastUpdatedAt'>;
  matchedText: string;
}

export function extractMvrCandidate(lines: TextLine[], fullText: string): MvrCandidate | null {
  if (!detectMvr(fullText)) return null;

  const excerpts: string[] = [];

  const nameMatch = firstMatch(lines, [/^(?:driver\s*name|name)\s*:?\s*(.+)$/i]);
  const driverNameHint = nameMatch ? normalizePlainName(nameMatch.raw) ?? undefined : undefined;
  if (nameMatch && driverNameHint) excerpts.push(nameMatch.line.text);

  const dobMatch = firstValidMatch(lines, [/\bdob\b\s*:?\s*(\S+)/i, /date\s+of\s+birth\s*:?\s*(\S+)/i], normalizeDate);
  if (dobMatch) excerpts.push(dobMatch.line.text);

  const licMatch = firstValidMatch(lines, [/\blicense\s*(?:no\.?|number|#)\s*:?\s*(\S+)/i, /\bdl\s*#\s*:?\s*(\S+)/i], normalizeIdToken);
  if (licMatch) excerpts.push(licMatch.line.text);

  const stateMatch = firstMatch(lines, [/^(?:license\s+)?state\s*:?\s*(\S+)/i]);
  const licenseStateHint = stateMatch ? parseStateFromPhrase(stateMatch.raw) ?? undefined : undefined;

  const reportDateMatch = firstValidMatch(lines, [/\breport\s+date\s*:?\s*(\S+)/i, /\bdate\s+(?:of\s+)?(?:report|order)\s*:?\s*(\S+)/i, /\brun\s+date\s*:?\s*(\S+)/i], normalizeDate);
  if (reportDateMatch) excerpts.push(reportDateMatch.line.text);

  const historyMatch = firstMatch(lines, [/\b(\d+)[\s-]*year\s+(?:history|record)\b/i]);

  const medicalExpMatch = firstValidMatch(
    lines,
    [/\bmedical\s+cert(?:ificate)?\s*(?:exp(?:iration)?)?\s*:?\s*(\S+)/i, /\bmedical\s+exp(?:iration)?\s*:?\s*(\S+)/i],
    normalizeDate
  );
  let medicalCertStatus: MvrRecord['medicalCertStatus'];
  if (medicalExpMatch) {
    excerpts.push(medicalExpMatch.line.text);
    const expiration = new Date(medicalExpMatch.value);
    medicalCertStatus = !Number.isNaN(expiration.getTime()) && expiration.getTime() < Date.now() ? 'expired' : 'valid';
  }

  const violations = extractViolations(lines);

  const hasAnySignal = !!driverNameHint || !!dobMatch || !!licMatch || !!reportDateMatch || violations.length > 0 || !!medicalExpMatch;
  if (!hasAnySignal) return null;

  return {
    driverNameHint,
    dobHint: dobMatch?.value,
    licenseNumberHint: licMatch?.value,
    licenseStateHint,
    record: {
      reportDate: reportDateMatch?.value,
      historyPeriod: historyMatch ? `${historyMatch.raw}-year` : undefined,
      violations,
      medicalCertStatus,
      medicalCertExpirationDate: medicalExpMatch?.value,
    },
    matchedText: excerpts.slice(0, 3).join(' | ') || 'MVR / driver history report',
  };
}

/** Convenience wrapper over extractMvrCandidate for a full RawDocument, so callers outside this module don't need to build TextLine[] themselves. */
export function extractMvrCandidateFromDocument(doc: RawDocument): MvrCandidate | null {
  return extractMvrCandidate(toTextLines(doc), doc.text);
}
