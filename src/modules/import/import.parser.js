'use strict';

/**
 * import.parser.js
 * src/modules/import/import.parser.js
 *
 * Parses an uploaded .xlsx / .xls buffer into normalised employee row objects.
 * Uses SheetJS (xlsx) — no disk writes, works entirely on the in-memory buffer.
 *
 * Template layout (expected):
 *   Row 1 — banner
 *   Row 2 — required / optional badges
 *   Row 3 — column headers   ← detected automatically
 *   Row 4 — field hint notes
 *   Row 5+ — data rows
 *
 * The parser auto-detects the header row by scanning the first 10 rows for
 * "employee number" — so it works even if rows are shifted or a plain
 * Excel (headers in row 1) is uploaded.
 */

const XLSX = require('xlsx');

const HEADER_MAP = {
  // Required
  'employee number':          'employee_number',
  'email':                    'email',
  // Employee fields
  'first name':               'first_name',
  'last name':                'last_name',
  'job title':                'job_title',
  'band / level':             'band_identifier',
  'band/level':               'band_identifier',
  'band':                     'band_identifier',
  // Department
  'department':               'department',
  // Manager — string emp# resolved to integer FK in Pass 4
  'manager emp number':       'manager_emp_number',
  'manager emp#':             'manager_emp_number',
  'manager emp no':           'manager_emp_number',
  'manager employee number':  'manager_emp_number',
  'reports to emp number':    'manager_emp_number',
  'reports to emp no':        'manager_emp_number',
  // Manager email fallback
  'reports to email':         'reports_to_email',
};

function detectHeaderRowIndex(aoa) {
  for (let i = 0; i < aoa.length; i++) {
    const row = aoa[i];
    for (const cell of row) {
      const normalised = String(cell || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (normalised === 'employee number') return i;
    }
  }
  return -1;
}

/**
 * @param {Buffer} buffer
 * @param {{ maxRows?: number }} opts
 * @returns {{ rows: object[], totalRows: number, skippedBlanks: number }}
 * @throws {Error} with .statusCode on structural failures
 */
function parseExcel(buffer, { maxRows = 500 } = {}) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });

  if (!workbook.SheetNames.length) {
    throw Object.assign(new Error('Excel file contains no sheets'), { statusCode: 422 });
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    throw Object.assign(new Error('Employee_Import sheet not found'), { statusCode: 422 });
  }

  const aoa = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw:    false,
  });

  if (!aoa.length) {
    throw Object.assign(
      new Error('File appears empty. Use the correct LMS import template.'),
      { statusCode: 422 }
    );
  }

 
  const headerRowIdx = detectHeaderRowIndex(aoa);

  if (headerRowIdx === -1) {
    throw Object.assign(
      new Error(
        'Could not find "Employee Number" column in rows. ' +
        'Ensure the file has the correct column headers.'
      ),
      { statusCode: 422 }
    );
  }

  // ── Build colMap from detected header row ─────────────────────────────────
  const headerRowArr = aoa[headerRowIdx];
  const colMap = {};

  headerRowArr.forEach((cell, idx) => {
    const key   = String(cell || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const field = HEADER_MAP[key];
    if (field) colMap[field] = idx;
  });

  // Guard: both required columns must be present
  for (const required of ['employee_number', 'email']) {
    if (colMap[required] === undefined) {
      throw Object.assign(
        new Error(
          `Required column not found: "${required}". ` +
          'Check that your column headers match exactly: "Employee Number" and "Email".'
        ),
        { statusCode: 422 }
      );
    }
  }

  // ── Data starts one row after header row ──────────────────────────────────
  // If the template is used: headerRowIdx=2 (row 3), next row is idx=3 (row 4 — notes).
  // We skip one more row to land on idx=4 (row 5 — actual data).
  // If plain Excel: headerRowIdx=0, data starts at idx=1.
  //
  // Detect whether the row immediately after headers looks like a notes row
  // (i.e. does NOT contain a valid email or emp# — it's descriptive text).
  let dataStartIdx = headerRowIdx + 1;

  if (dataStartIdx < aoa.length) {
    const nextRow      = aoa[dataStartIdx];
    const firstCellVal = String(nextRow[colMap['employee_number']] || '').trim();
    const emailCellVal = String(nextRow[colMap['email']]           || '').trim();

    // If the row immediately after headers looks like hint text (no @, no alphanumeric emp#),
    // skip it — it's the notes row in the formatted template.
    const looksLikeNotes =
      !firstCellVal.match(/^[A-Za-z0-9_-]+$/) &&
      !emailCellVal.includes('@');

    if (looksLikeNotes) {
      dataStartIdx++; // skip the notes row (row 4 in the template)
    }
  }

  // ── Parse data rows ───────────────────────────────────────────────────────
  const rows        = [];
  let skippedBlanks = 0;

  for (let i = dataStartIdx; i < aoa.length; i++) {
    if (rows.length >= maxRows) break;

    const rowArr  = aoa[i];
    const isEmpty = Object.values(colMap).every(
      (ci) => !rowArr[ci] || String(rowArr[ci]).trim() === ''
    );
    if (isEmpty) { skippedBlanks++; continue; }

    const row = {};
    for (const [field, ci] of Object.entries(colMap)) {
      const raw  = rowArr[ci];
      row[field] = raw !== undefined && raw !== null ? String(raw).trim() : '';
    }

    // Normalise key lookup fields
    if (row.employee_number)    row.employee_number    = row.employee_number.toUpperCase();
    if (row.email)              row.email              = row.email.toLowerCase();
    if (row.manager_emp_number) row.manager_emp_number = row.manager_emp_number.toUpperCase();
    if (row.reports_to_email)   row.reports_to_email   = row.reports_to_email.toLowerCase();

    rows.push(row);
  }

  return { rows, totalRows: rows.length, skippedBlanks };
}

module.exports = { parseExcel };