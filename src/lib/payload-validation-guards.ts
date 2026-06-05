import { APIError } from "payload";

// ---------------------------------------------------------------------------
// Helper: validate a number field with a clear Spanish message
// ---------------------------------------------------------------------------

export function validateNumber(
  value: unknown,
  fieldName: string,
  min?: number,
  max?: number,
  required?: boolean,
): void {
  if (required && (value === undefined || value === null || value === "")) {
    throw new APIError(`${fieldName} es requerido.`, 400);
  }

  if (value === undefined || value === null || value === "") {
    return; // not required and empty
  }

  const num = Number(value);
  if (Number.isNaN(num)) {
    throw new APIError(`${fieldName} debe ser un número válido.`, 400);
  }

  if (typeof min === "number" && num < min) {
    throw new APIError(`${fieldName} debe ser mayor o igual a ${min}.`, 400);
  }

  if (typeof max === "number" && num > max) {
    throw new APIError(`${fieldName} debe ser menor o igual a ${max}.`, 400);
  }
}

// ---------------------------------------------------------------------------
// Helper: validate a text field length
// ---------------------------------------------------------------------------

export function validateTextLength(
  value: unknown,
  fieldName: string,
  minLength?: number,
  maxLength?: number,
  required?: boolean,
): void {
  if (required && (value === undefined || value === null || value === "")) {
    throw new APIError(`${fieldName} es requerido.`, 400);
  }

  if (value === undefined || value === null || value === "") {
    return;
  }

  const str = String(value);
  const len = str.length;

  if (typeof minLength === "number" && len < minLength) {
    throw new APIError(
      `${fieldName} debe tener al menos ${minLength} caracteres.`,
      400,
    );
  }

  if (typeof maxLength === "number" && len > maxLength) {
    throw new APIError(
      `${fieldName} debe tener como máximo ${maxLength} caracteres.`,
      400,
    );
  }
}

// ---------------------------------------------------------------------------
// Helper: validate an array field length
// ---------------------------------------------------------------------------

export function validateArrayLength(
  value: unknown,
  fieldName: string,
  minItems?: number,
  maxItems?: number,
  required?: boolean,
): void {
  const arr = Array.isArray(value) ? value : [];

  if (required && arr.length === 0) {
    throw new APIError(`${fieldName} es requerido.`, 400);
  }

  if (typeof minItems === "number" && arr.length < minItems) {
    throw new APIError(
      `${fieldName} debe tener al menos ${minItems} elemento${minItems === 1 ? "" : "s"}.`,
      400,
    );
  }

  if (typeof maxItems === "number" && arr.length > maxItems) {
    throw new APIError(
      `${fieldName} debe tener como máximo ${maxItems} elemento${maxItems === 1 ? "" : "s"}.`,
      400,
    );
  }
}

// ---------------------------------------------------------------------------
// Helper: validate email format
// ---------------------------------------------------------------------------

export function validateEmail(
  value: unknown,
  fieldName: string,
  required?: boolean,
): void {
  if (required && (value === undefined || value === null || value === "")) {
    throw new APIError(`${fieldName} es requerido.`, 400);
  }

  if (value === undefined || value === null || value === "") {
    return;
  }

  const email = String(value).trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new APIError(`${fieldName} debe ser un email válido.`, 400);
  }
}
