'use strict';

/**
 * Generic Joi validation middleware runner.
 *
 * After successful validation it ALWAYS writes the coerced / defaulted
 * value back to req[property], so controllers receive Joi's transformed
 * output (e.g. default page=1, default limit=10, trimmed strings).
 *
 * Usage:
 *   const validateBody   = (schema) => validate(schema, 'body');
 *   const validateQuery  = (schema) => validate(schema, 'query');
 *   const validateParams = (schema) => validate(schema, 'params');
 */
const validate = (schema, property = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[property], {
    abortEarly:   false,
    stripUnknown: true,
    allowUnknown: false,
  });

  if (error) {
    const messages = error.details.map(d => d.message).join(', ');
    return res.status(400).json({
      success:          false,
      message:          messages,
      validationErrors: error.details.map(d => ({
        field:   d.path.join('.'),
        message: d.message,
      })),
    });
  }

  // Write the cleaned / defaulted value back so controllers see it.
  // req.body is writable — assign directly.
  // req.query and req.params are getter-only on IncomingMessage —
  // mutate their contents in place instead of replacing the reference.
  if (property === 'body') {
    req.body = value;
  } else {
    const target = req[property];
    Object.keys(target).forEach((k) => delete target[k]);
    Object.assign(target, value);
  }
  next();
};

const validateBody   = (schema) => validate(schema, 'body');
const validateQuery  = (schema) => validate(schema, 'query');
const validateParams = (schema) => validate(schema, 'params');

module.exports = { validate, validateBody, validateQuery, validateParams };
