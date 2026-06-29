/**
 * Sanitization utilities untuk mencegah XSS dan injection attacks
 */

/**
 * Sanitize string input - remove dangerous characters
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

/**
 * Sanitize untuk SQL LIKE queries - escape wildcards
 */
export function sanitizeLikePattern(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(input: unknown): number | null {
  const num = Number(input);
  if (isNaN(num) || !isFinite(num)) return null;
  return num;
}

/**
 * Sanitize UUID
 */
export function sanitizeUuid(input: string): string | null {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!input || !uuidRegex.test(input)) return null;
  return input.toLowerCase();
}

/**
 * Sanitize phone number - hanya angka dan +
 */
export function sanitizePhoneNumber(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[^\d+]/g, '');
}

/**
 * Sanitize barcode - hanya alphanumeric dan dash
 */
export function sanitizeBarcode(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[^a-zA-Z0-9-]/g, '');
}

/**
 * Validate & sanitize email
 */
export function sanitizeEmail(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  
  const email = input.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) return null;
  return email;
}

/**
 * Sanitize untuk display - escape HTML entities
 */
export function escapeHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  const entityMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
  };
  
  return input.replace(/[&<>"'/]/g, (char) => entityMap[char] || char);
}

/**
 * Safe JSON parse dengan error handling
 */
export function safeJsonParse<T>(input: string, fallback: T): T {
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}
