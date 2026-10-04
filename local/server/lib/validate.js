// ---------------------------------------------------------------------------
// Validacion de entradas, sin dependencias externas.
// Si algo no cumple, lanzamos un HttpError 400 con un mensaje util para el
// frontend (y para ti cuando pruebes la API a mano).
// ---------------------------------------------------------------------------

import { badRequest } from './http-error.js';
import { config } from '../config.js';

export function requireObject(body, label = 'body') {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest(`Expected a JSON object as the request ${label}.`);
  }
  return body;
}

export function requireString(value, field, { min = 1, max = 200, trim = true } = {}) {
  if (typeof value !== 'string') {
    throw badRequest(`"${field}" must be a string.`, { field });
  }
  const text = trim ? value.trim() : value;
  if (text.length < min) {
    throw badRequest(`"${field}" must have at least ${min} character(s).`, { field });
  }
  if (text.length > max) {
    throw badRequest(`"${field}" must have at most ${max} characters.`, { field });
  }
  return text;
}

export function optionalString(value, field, options) {
  if (value === undefined || value === null || value === '') return undefined;
  return requireString(value, field, options);
}

export function requireInt(value, field, { min, max } = {}) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed)) {
    throw badRequest(`"${field}" must be a whole number.`, { field });
  }
  if (min !== undefined && parsed < min) {
    throw badRequest(`"${field}" must be ${min} or more.`, { field });
  }
  if (max !== undefined && parsed > max) {
    throw badRequest(`"${field}" must be ${max} or less.`, { field });
  }
  return parsed;
}

export function requireBool(value, field) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  throw badRequest(`"${field}" must be true or false.`, { field });
}

export function requireEnum(value, field, allowed) {
  const text = requireString(value, field, { max: 64 });
  if (!allowed.includes(text)) {
    throw badRequest(`"${field}" must be one of: ${allowed.join(', ')}.`, { field, allowed });
  }
  return text;
}

// Comprobacion de email deliberadamente simple: algo@algo.algo, sin espacios.
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

export function requireEmail(value, field = 'email') {
  const text = requireString(value, field, { max: 190 }).toLowerCase();
  if (!EMAIL_RE.test(text)) {
    throw badRequest('That email address does not look valid.', { field });
  }
  return text;
}

export function requirePassword(value, field = 'password') {
  if (typeof value !== 'string') {
    throw badRequest('"password" must be a string.', { field });
  }
  if (value.length < 8) {
    throw badRequest('Your password needs at least 8 characters.', { field });
  }
  if (value.length > 200) {
    throw badRequest('Your password is too long (200 characters maximum).', { field });
  }
  return value;
}

export function requireDisplayName(value, field = 'displayName') {
  const text = requireString(value, field, { min: 1, max: 40 });
  if (/[<>]/.test(text)) {
    throw badRequest('Your name cannot contain < or >.', { field });
  }
  return text;
}

/** Zona horaria IANA. Si no es valida, devolvemos undefined en vez de fallar. */
export function normalizeTimeZone(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return undefined;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value });
    return value;
  } catch {
    return undefined;
  }
}

export function requireTimeZone(value, field = 'timezone') {
  const zone = normalizeTimeZone(value);
  if (!zone) {
    throw badRequest('That time zone is not recognised.', { field });
  }
  return zone;
}

/**
 * Respuesta de un ejercicio. La forma depende del tipo, asi que aqui solo
 * comprobamos que sea uno de los formatos admitidos y que no sea gigante.
 */
export function requireAnswer(value, field = 'answer') {
  if (typeof value === 'string') {
    if (value.length > config.maxTextAnswer) {
      throw badRequest(`Your answer is too long (${config.maxTextAnswer} characters maximum).`, { field });
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 24) throw badRequest('Too many items in that answer.', { field });
    return value.map((item, index) => requireString(item, `${field}[${index}]`, { max: 80 }));
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length > 24) throw badRequest('Too many pairs in that answer.', { field });
    const result = {};
    for (const [key, item] of entries) {
      if (key.length > 80) throw badRequest('A key in that answer is too long.', { field });
      result[key] = requireString(item, `${field}.${key}`, { max: 120 });
    }
    return result;
  }
  throw badRequest('"answer" must be text, a list of words, or a set of pairs.', { field });
}
