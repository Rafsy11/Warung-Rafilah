import { db } from './db';

export type AuditAction = 
  | 'login_success' 
  | 'login_failed' 
  | 'logout'
  | 'product_create' 
  | 'product_update' 
  | 'product_delete'
  | 'sale_create'
  | 'sale_cancel'
  | 'stock_adjust'
  | 'float_adjust'
  | 'transaction_create'
  | 'transaction_manual_confirm'
  | 'closing_perform';

export interface AuditLogEntry {
  user_id?: string;
  action: AuditAction;
  resource_type?: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
  status: 'success' | 'failed';
  error_message?: string;
}

/**
 * Log audit events untuk security monitoring
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    // Pastikan tabel audit_logs sudah ada di database
    await db.query(
      `INSERT INTO core.audit_logs 
       (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata, status, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
      [
        entry.user_id || null,
        entry.action,
        entry.resource_type || null,
        entry.resource_id || null,
        entry.ip_address || null,
        entry.user_agent || null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.status,
        entry.error_message || null
      ]
    );
  } catch (error) {
    // Jangan biarkan audit log failure mengganggu request utama
    console.error('Failed to write audit log:', error);
  }
}

/**
 * Helper untuk extract IP dari request
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  return cfConnectingIp || realIp || forwardedFor?.split(',')[0] || 'unknown';
}

/**
 * Helper untuk extract User-Agent
 */
export function getUserAgent(request: Request): string {
  return request.headers.get('user-agent') || 'unknown';
}
