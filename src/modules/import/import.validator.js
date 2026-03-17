'use strict';

/**
 * import.validator.js
 * src/modules/import/import.validator.js
 *
 * Pure row-level validation — zero DB calls.
 * Called after parsing, before any DB writes.
 *
 * ── What causes a row to be SKIPPED (hard error) ──────────────────────────────
 *   • Employee Number missing or blank
 *   • Employee Number invalid format (not alphanumeric/hyphen/underscore, >50 chars)
 *   • Employee Number duplicated within the same file (second+ occurrence skipped)
 *   • Email missing or blank
 *   • Email invalid format (must contain @ and domain)
 *   • Email duplicated within the same file (second+ occurrence skipped)
 *
 * ── What generates a WARNING (row still proceeds) ─────────────────────────────
 *   • Band/Level exceeds 50 characters — will be truncated
 *   • Job Title exceeds 150 characters — will be truncated
 *   • Department name exceeds 100 characters
 *   • Reports To Email present but invalid format — manager will not be set
 *
 * ── What is silently ignored ──────────────────────────────────────────────────
 *   • Completely blank rows (skipped by parser before validation)
 *   • Optional fields left blank (First Name, Last Name, Job Title, Band,
 *     Department, Manager Emp Number, Reports To Email) — blank = keep existing
 */

const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMP_NUM_RE = /^[A-Za-z0-9_-]{1,50}$/;

/**
 * Validate a single row.
 *
 * @param {object} row
 * @param {number} rowNo  1-based for human-readable error messages
 * @returns {{ errors: object[], warnings: object[] }}
 */
function validateRow(row, rowNo) {
  const errors   = [];
  const warnings = [];

  const pushError = (field, message) => errors.push({ row: rowNo, field, message });
  const pushWarn  = (field, message) => warnings.push({ row: rowNo, field, message });

  // ── Required: Employee Number ─────────────────────────────────────────────
  if (!row.employee_number?.trim()) {
    pushError('Employee Number', 'Employee Number is required — row skipped');
  } else if (!EMP_NUM_RE.test(row.employee_number.trim())) {
    pushError(
      'Employee Number',
      `Invalid format "${row.employee_number}" — alphanumeric, hyphen and underscore only, max 50 chars`
    );
  }

  // ── Required: Email ───────────────────────────────────────────────────────
  if (!row.email?.trim()) {
    pushError('Email', 'Email is required — row skipped');
  } else if (!EMAIL_RE.test(row.email.trim().toLowerCase())) {
    pushError('Email', `Invalid email format: "${row.email}" — row skipped`);
  }

  // ── Optional field warnings ───────────────────────────────────────────────
  if (row.band_identifier?.length > 50) {
    pushWarn('Band / Level', 'Exceeds 50 characters — will be truncated to 50');
  }
  if (row.job_title?.length > 150) {
    pushWarn('Job Title', 'Exceeds 150 characters — will be truncated to 150');
  }
  if (row.department?.length > 100) {
    pushWarn('Department', 'Department name exceeds 100 characters');
  }
  if (
    row.reports_to_email?.trim() &&
    !EMAIL_RE.test(row.reports_to_email.trim().toLowerCase())
  ) {
    pushWarn(
      'Reports To Email',
      `Invalid email format: "${row.reports_to_email}" — manager_id will not be set via this field`
    );
  }

  return { errors, warnings };
}

/**
 * Validate all parsed rows.
 * Every row is checked — not short-circuited on first error.
 *
 * Tracks:
 *   seenEmpNums — duplicate employee_number within the file
 *   seenEmails  — duplicate email within the file
 *
 * @param {object[]} rows
 * @returns {{
 *   validRows:   object[],
 *   allErrors:   object[],
 *   allWarnings: object[],
 *   skipped:     number,   — total rows not imported (errors + duplicates)
 * }}
 */
function validateRows(rows) {
  const allErrors   = [];
  const allWarnings = [];
  const seenEmpNums = new Map(); // UPPER(emp#)  → first rowNo
  const seenEmails  = new Map(); // lower(email) → first rowNo

  const validRows = rows.filter((row, idx) => {
    const rowNo  = idx + 1; // 1-based for UI error messages

    const empNum = row.employee_number
      ? String(row.employee_number).trim().toUpperCase()
      : null;

    const email = row.email
      ? String(row.email).trim().toLowerCase()
      : null;

    // ── Duplicate Employee Number within file ──────────────────────────────
    if (empNum && seenEmpNums.has(empNum)) {
      allErrors.push({
        row:     rowNo,
        field:   'Employee Number',
        message: `Duplicate Employee Number "${row.employee_number}" — already on row ${seenEmpNums.get(empNum)}. This row is skipped.`,
      });
      return false; // skip — do not process this row
    }
    if (empNum) seenEmpNums.set(empNum, rowNo);

    // ── Duplicate Email within file ────────────────────────────────────────
    if (email && EMAIL_RE.test(email) && seenEmails.has(email)) {
      allErrors.push({
        row:     rowNo,
        field:   'Email',
        message: `Duplicate email "${row.email}" — already on row ${seenEmails.get(email)}. This row is skipped.`,
      });
      return false; // skip
    }
    if (email && EMAIL_RE.test(email)) seenEmails.set(email, rowNo);

    // ── Per-row field validation ───────────────────────────────────────────
    const { errors, warnings } = validateRow(row, rowNo);
    allErrors.push(...errors);
    allWarnings.push(...warnings);

    return errors.length === 0; // only valid rows proceed to DB
  });

  // skipped = all rows that did not make it into validRows
  const skipped = rows.length - validRows.length;

  return { validRows, allErrors, allWarnings, skipped };
}

module.exports = { validateRow, validateRows };