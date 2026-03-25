'use strict';

/**
 * import.controller.js
 * src/modules/import/import.controller.js
 *
 * POST /api/import/employees  — upload + process Excel file
 * GET  /api/import/logs       — paginated import history
 */

const asyncWrapper     = require('../../core/utils/asyncWrapper');        
const { AppError }     = require('../../core/errors/AppError');
const logger           = require('../../core/utils/logger');
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

const OPERATION = 'EMPLOYEE_IMPORT';

async function persistImportLog(payload, context = {}) {
  try {
    await ImportLog.create(payload);
  } catch (logErr) {
    logger.error('Failed to persist ImportLog entry', {
      ...context,
      operation: OPERATION,
      error: logErr.message,
    });
  }
}

const buildContext = (req) => ({
  operation: OPERATION,
  userId: req.user?.id,
  fileName: req.file?.originalname,
});

// ── POST /api/import/employees ────────────────────────────────────────────────
const importEmployees = asyncWrapper(async (req, res) => {
  const context = buildContext(req);
  let parsed;
  let validationOutcome;
  let processingResult;

  logger.info('Import request received', context);

  try {
    if (!req.file) {
      throw new AppError('No file received. Send multipart/form-data with field name "file".', 400);
    }
    if (req.file.size > MAX_FILE_SIZE_BYTES) {
      throw new AppError(`File exceeds the ${process.env.IMPORT_MAX_FILE_SIZE_MB || 5} MB limit.`, 413);
    }
    if (!ALLOWED_MIMETYPES.has(req.file.mimetype)) {
      throw new AppError('Unsupported file type. Only .xlsx and .xls files are accepted.', 415);
    }

    // ── Step 1: Parse ───────────────────────────────────────────────────────
    try {
      parsed = parseExcel(req.file.buffer, { maxRows: MAX_ROWS });
      logger.info('Import file parsed', { ...context, totalRows: parsed.totalRows });
    } catch (parseErr) {
      throw new AppError(parseErr.message, parseErr.statusCode || 422);
    }

    if (parsed.rows.length === 0) {
      throw new AppError('No data rows found in the uploaded file.', 422);
    }

    // ── Step 2: Validate ───────────────────────────────────────────────────
    validationOutcome = validateRows(parsed.rows);
    const { validRows, allErrors, allWarnings, skipped } = validationOutcome;
    const totalSkipped = skipped;

    logger.info('Import validation completed', {
      ...context,
      validRows: validRows.length,
      skipped: totalSkipped,
    });

    if (validRows.length === 0) {
      throw new AppError('All rows failed validation. No records were imported.', 422, undefined, { details: allErrors });
    }

    // ── Step 3: Process ────────────────────────────────────────────────────
    processingResult = await processRows(validRows, { loggerContext: context });

    logger.info('Import processing completed', {
      ...context,
      inserted: processingResult.inserted,
      updated: processingResult.updated,
      softDeleted: processingResult.softDeleted,
    });

    // ── Step 4: Build final warnings ───────────────────────────────────────
    const finalWarnings = [...allWarnings, ...processingResult.managerWarnings];

    if (processingResult.softDeleted > 0) {
      finalWarnings.push({
        field:   'Soft Delete',
        message: `${processingResult.softDeleted} employee(s) deactivated (not in file): ${processingResult.softDeletedEmps.join(', ')}`,
      });
    }
    if (processingResult.promotedToManager.length > 0) {
      finalWarnings.push({
        field:   'System Role',
        message: `Promoted to manager: ${processingResult.promotedToManager.join(', ')}`,
      });
    }
    if (processingResult.demotedToEmployee.length > 0) {
      finalWarnings.push({
        field:   'System Role',
        message: `Demoted to employee (no longer managing anyone): ${processingResult.demotedToEmployee.join(', ')}`,
      });
    }

    const status = (allErrors.length > 0 || finalWarnings.length > 0)
      ? 'completed_with_warnings'
      : 'completed';

    // ── Step 5: Persist import log ─────────────────────────────────────────
    await persistImportLog({
      uploaded_by: req.user.id,
      file_name:   req.file.originalname,
      total_rows:  parsed.totalRows,
      inserted:    processingResult.inserted,
      updated:     processingResult.updated,
      skipped:     totalSkipped,
      warnings:    finalWarnings.length ? finalWarnings : null,
      errors:      allErrors.length     ? allErrors     : null,
      status,
    }, { ...context, step: 'success' });

    logger.info('Import completed', { ...context, status });

    // ── Step 6: Respond ────────────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      message: status === 'completed'
        ? 'Import completed successfully.'
        : 'Import completed with warnings.',
      summary: {
        total_rows_in_file:  parsed.totalRows,
        inserted:            processingResult.inserted,
        updated:             processingResult.updated,
        skipped:             totalSkipped,
        blank_rows_ignored:  parsed.skippedBlanks,
        deactivated:         processingResult.softDeleted,
        promoted_to_manager: processingResult.promotedToManager.length,
        demoted_to_employee: processingResult.demotedToEmployee.length,
      },
      errors:   allErrors,
      warnings: finalWarnings,
    });
  } catch (err) {
    const normalizedError = err instanceof AppError
      ? err
      : new AppError(err.message, err.statusCode || 500);

    const failureErrors = validationOutcome?.allErrors?.length
      ? validationOutcome.allErrors
      : [{ field: 'Import', message: normalizedError.message }];

    const failureWarnings = validationOutcome?.allWarnings?.length ? validationOutcome.allWarnings : null;

    await persistImportLog({
      uploaded_by: req.user?.id ?? null,
      file_name:   req.file?.originalname ?? 'unknown',
      total_rows:  parsed?.totalRows ?? 0,
      inserted:    processingResult?.inserted ?? 0,
      updated:     processingResult?.updated ?? 0,
      skipped:     validationOutcome?.skipped ?? 0,
      warnings:    failureWarnings,
      errors:      failureErrors,
      status:      'failed',
    }, { ...context, step: 'failure' });

    logger.error('Import failed', { ...context, error: normalizedError.message });

    throw normalizedError;
  }
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