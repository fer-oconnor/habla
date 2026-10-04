// ---------------------------------------------------------------------------
// Errores HTTP con forma consistente.
//
// Todas las respuestas de error de la API tienen esta forma:
//   { "error": { "code": "not_found", "message": "...", "details": {...} } }
// ---------------------------------------------------------------------------

export class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toJSON() {
    const error = { code: this.code, message: this.message };
    if (this.details !== undefined) error.details = this.details;
    return { error };
  }
}

export const badRequest = (message, details) =>
  new HttpError(400, 'bad_request', message, details);

export const unauthorized = (message = 'You need to sign in to do that.') =>
  new HttpError(401, 'unauthorized', message);

export const forbidden = (message = 'You do not have access to this resource.') =>
  new HttpError(403, 'forbidden', message);

export const notFound = (message = 'Not found.') =>
  new HttpError(404, 'not_found', message);

export const conflict = (message, details) =>
  new HttpError(409, 'conflict', message, details);

export const payloadTooLarge = (message = 'That request is too large.') =>
  new HttpError(413, 'payload_too_large', message);

export const tooManyRequests = (message = 'Too many attempts. Please wait a moment.') =>
  new HttpError(429, 'too_many_requests', message);

export const serverError = (message = 'Something went wrong on our side.') =>
  new HttpError(500, 'server_error', message);
