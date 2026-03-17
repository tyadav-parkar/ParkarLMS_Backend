'use strict';

/**
 * import.controller.js
 * src/modules/import/import.controller.js
 *
 * POST /api/import/employees  — upload + process Excel file
 * GET  /api/import/logs       — paginated import history
 */

const asyncWrapper     = require('../../core/utils/asyncWrapper');
const { parseExcel }   = require('./import.parser');
const { validateRows } = require('./import.validator');
const { processRows }  = require('./import.service');
const ImportLog        = require('./importLog.model');

const MAX_FILE_SIZE_BYTES = (parseInt(process.env.IMPORT_MAX_FILE_SIZE_MB) || 5) * 1024 * 1024;
const MAX_ROWS            =  parseInt(process.env.IMPORT_MAX_ROWS)         || 500;

const ALLOWED_MIMETYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

// ── POST /api/import/employees ────────────────────────────────────────────────
const importEmployees = asyncWrapper(async (req, res) => {

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file received. Send multipart/form-data with field name "file".',
    });
  }
  if (req.file.size > MAX_FILE_SIZE_BYTES) {
    return res.status(413).json({
      success: false,
      message: `File exceeds the ${process.env.IMPORT_MAX_FILE_SIZE_MB || 5} MB limit.`,
    });
  }
  if (!ALLOWED_MIMETYPES.has(req.file.mimetype)) {
    return res.status(415).json({
      success: false,
      message: 'Unsupported file type. Only .xlsx and .xls files are accepted.',
    });
  }

  // ── Step 1: Parse ──────────────────────────────────────────────────────────
  let parsed;
  try {
    parsed = parseExcel(req.file.buffer, { maxRows: MAX_ROWS });
  } catch (parseErr) {
    return res.status(parseErr.statusCode || 422).json({
      success: false, message: parseErr.message,
    });
  }

  if (parsed.rows.length === 0) {
    return res.status(422).json({
      success: false, message: 'No data rows found in the uploaded file.',
    });
  }

  // ── Step 2: Validate ───────────────────────────────────────────────────────
  const { validRows, allErrors, allWarnings, skipped } = validateRows(parsed.rows);

  // skipped = rows that had content but failed validation
  //           (missing required fields, bad format, duplicate emp# or email)
  // parsed.skippedBlanks = completely empty template rows — NOT counted as skipped
  //           because a 500-row template with 18 employees has 482 blank rows
  //           which are just unused template space, not failed records
  const totalSkipped = skipped; // blank rows shown separately in blank_rows_ignored

  if (validRows.length === 0) {
    return res.status(422).json({
      success:  false,
      message:  'All rows failed validation. No records were imported.',
      errors:   allErrors,
      warnings: allWarnings,
    });
  }

  // ── Step 3: Process (all 6 passes inside one transaction) ─────────────────
  let result;
  try {
    result = await processRows(validRows);
  } catch (processErr) {
    return res.status(500).json({
      success: false,
      message: `Import failed and was rolled back: ${processErr.message}`,
    });
  }

  // ── Step 4: Build final warnings ──────────────────────────────────────────
  const finalWarnings = [...allWarnings, ...result.managerWarnings];

  if (result.softDeleted > 0) {
    finalWarnings.push({
      field:   'Soft Delete',
      message: `${result.softDeleted} employee(s) deactivated (not in file): ${result.softDeletedEmps.join(', ')}`,
    });
  }
  if (result.promotedToManager.length > 0) {
    finalWarnings.push({
      field:   'System Role',
      message: `Promoted to manager: ${result.promotedToManager.join(', ')}`,
    });
  }
  if (result.demotedToEmployee.length > 0) {
    finalWarnings.push({
      field:   'System Role',
      message: `Demoted to employee (no longer managing anyone): ${result.demotedToEmployee.join(', ')}`,
    });
  }

  const status = allErrors.length > 0 || finalWarnings.length > 0
    ? 'completed_with_warnings'
    : 'completed';

  // ── Step 5: Persist import log ─────────────────────────────────────────────
  await ImportLog.create({
    uploaded_by: req.user.id,
    file_name:   req.file.originalname,
    total_rows:  parsed.totalRows,   // non-blank rows only (excludes empty template rows)
    inserted:    result.inserted,
    updated:     result.updated,
    skipped:     totalSkipped,
    warnings:    finalWarnings.length ? finalWarnings : null,
    errors:      allErrors.length     ? allErrors     : null,
    status,
  });

  // ── Step 6: Respond ────────────────────────────────────────────────────────
  return res.status(200).json({
    success: true,
    message: status === 'completed'
      ? 'Import completed successfully.'
      : 'Import completed with warnings.',
    summary: {
      total_rows_in_file:  parsed.totalRows,
      inserted:            result.inserted,
      updated:             result.updated,
      skipped:             totalSkipped,
      blank_rows_ignored:  parsed.skippedBlanks,
      deactivated:         result.softDeleted,
      promoted_to_manager: result.promotedToManager.length,
      demoted_to_employee: result.demotedToEmployee.length,
    },
    errors:   allErrors,
    warnings: finalWarnings,
  });
});

// ── GET /api/import/logs ──────────────────────────────────────────────────────
const getImportLogs = asyncWrapper(async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const { count, rows } = await ImportLog.findAndCountAll({
    order:      [['created_at', 'DESC']],
    limit,
    offset,
    attributes: ['id', 'file_name', 'total_rows', 'inserted', 'updated', 'skipped', 'status', 'created_at'],
  });

  return res.status(200).json({
    success: true,
    data:    rows,
    meta: {
      total:      count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  });
});

module.exports = { importEmployees, getImportLogs };