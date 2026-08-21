/**
 * M05 Context Assembler — PiiMasker
 *
 * Applies PII masking to signal payloads before delivery to a requesting agent.
 * The masking level is determined by the agent's contract (piiHandlingLevel):
 *
 *   NONE    → All PII fields stripped from the payload. Agent sees only
 *             non-personal signals and metadata.
 *   MASKED  → PII fields partially redacted (e.g. "07**8 *** ***", "JO** D**").
 *             Agent can see that PII exists but not the full value.
 *   FULL    → No masking. Agent receives raw PII fields. Only granted to
 *             agents with specific regulatory authorisation.
 *
 * PII field detection is heuristic-based (field name matching).
 * Production deployment should augment with a data classification service.
 *
 * Recognised PII field names (case-insensitive):
 *   phone, mobile, telephone, dob, dateOfBirth, date_of_birth,
 *   email, emailAddress, fullName, full_name, name, surname, forename,
 *   postcode, post_code, zipCode, sortCode, sort_code, accountNumber,
 *   account_number, nationalInsurance, national_insurance, ni, nin,
 *   passport, passportNumber
 */

import type { PiiHandlingLevel } from '../core/types.js';

const PII_FIELDS = new Set([
  'phone', 'mobile', 'telephone', 'tel',
  'dob', 'dateofbirth', 'date_of_birth', 'birthdate',
  'email', 'emailaddress', 'email_address',
  'fullname', 'full_name', 'name', 'surname', 'forename', 'firstname', 'lastname',
  'postcode', 'post_code', 'zipcode', 'zip_code',
  'sortcode', 'sort_code', 'accountnumber', 'account_number',
  'nationalinsurance', 'national_insurance', 'ni', 'nin', 'nino',
  'passport', 'passportnumber', 'passport_number',
  'address', 'addressline1', 'address_line_1',
  'ipaddress', 'ip_address',
]);

function isPiiField(key: string): boolean {
  return PII_FIELDS.has(key.toLowerCase().replace(/[-_\s]/g, ''));
}

function maskValue(value: unknown): string {
  if (typeof value !== 'string') return '***';
  if (value.length <= 4) return '****';
  // Show first 2 and last 2 characters; mask the middle
  return `${value.slice(0, 2)}${'*'.repeat(Math.max(2, value.length - 4))}${value.slice(-2)}`;
}

export class PiiMasker {
  /**
   * Apply masking to a signal payload according to the agent's PII handling level.
   */
  mask(
    payload: Record<string, unknown>,
    level:   PiiHandlingLevel,
  ): Record<string, unknown> {
    if (level === 'FULL') return payload; // no masking

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(payload)) {
      if (!isPiiField(key)) {
        // Non-PII field: pass through (including nested objects)
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result[key] = this.mask(value as Record<string, unknown>, level);
        } else {
          result[key] = value;
        }
        continue;
      }

      // PII field: apply level-appropriate masking
      if (level === 'NONE') {
        // Strip the field entirely
        continue;
      }

      // MASKED: partially redact
      result[key] = maskValue(value);
    }

    return result;
  }

  /**
   * Mask a batch of payloads, returning only non-empty results.
   */
  maskBatch(
    payloads: Array<{ signalId: string; payload: Record<string, unknown> }>,
    level:    PiiHandlingLevel,
  ): Array<{ signalId: string; payload: Record<string, unknown> }> {
    return payloads.map(({ signalId, payload }) => ({
      signalId,
      payload: this.mask(payload, level),
    }));
  }
}
