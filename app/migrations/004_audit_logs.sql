-- Migration: Create audit_logs table for security monitoring
-- Created: 2026-06-25

-- Create audit logs table
CREATE TABLE IF NOT EXISTS core.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  ip_address VARCHAR(50),
  user_agent TEXT,
  metadata JSONB,
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON core.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON core.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON core.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON core.audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON core.audit_logs(ip_address);

-- Create index untuk searching metadata
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata ON core.audit_logs USING gin(metadata);

-- Add comment
COMMENT ON TABLE core.audit_logs IS 'Audit trail untuk semua aktivitas penting dalam sistem';
COMMENT ON COLUMN core.audit_logs.action IS 'Jenis aksi: login_success, login_failed, product_create, sale_create, dll';
COMMENT ON COLUMN core.audit_logs.metadata IS 'Data tambahan dalam format JSON';

-- Grant permissions
GRANT SELECT, INSERT ON core.audit_logs TO pos_admin;
GRANT USAGE, SELECT ON SEQUENCE core.audit_logs_id_seq TO pos_admin;
