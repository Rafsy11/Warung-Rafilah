# Security Guidelines - Warung POS

## 🔐 Security Features Implemented

### 1. Authentication & Authorization
- ✅ JWT-based authentication dengan HMAC-SHA256
- ✅ HTTPOnly cookies untuk session management
- ✅ Role-based access control (Owner, Cashier, Agent)
- ✅ Secure password hashing dengan pgcrypto crypt() & bcrypt
- ✅ Session expiration (24 jam)

### 2. Rate Limiting
- ✅ Login rate limiting: 5 percobaan per 5 menit (sliding window)
- ✅ API general: 100 request per menit
- ✅ API write: 30 write operations per menit
- ✅ Webhook: 50 webhooks per menit

### 3. Input Validation
- ✅ Zod schema validation untuk semua input
- ✅ SQL injection protection via parameterized queries
- ✅ Input sanitization & type checking

### 4. Audit Logging
- ✅ Login success/failed logging
- ✅ Critical operations logging (product CRUD, sales, transactions)
- ✅ IP address & User-Agent tracking
- ✅ Metadata untuk forensic analysis

### 5. Security Headers
- ✅ Strict-Transport-Security (HSTS)
- ✅ X-Frame-Options: SAMEORIGIN
- ✅ X-Content-Type-Options: nosniff
- ✅ Content-Security-Policy (CSP)
- ✅ X-XSS-Protection
- ✅ Referrer-Policy
- ✅ Permissions-Policy

### 6. Webhook Security
- ✅ HMAC signature verification
- ✅ Constant-time comparison (timing attack prevention)
- ✅ Idempotency via event_id deduplication

### 7. Docker Security
- ✅ Non-root user (nextjs:nodejs)
- ✅ Multi-stage builds
- ✅ Minimal attack surface (alpine-based)

## 🚨 Security Best Practices

### Environment Variables
**CRITICAL**: Never commit `.env` files to git!

```bash
# Generate strong secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Minimum requirements:
JWT_SECRET=minimum_32_characters_random_string
QRIS_WEBHOOK_SECRET=minimum_32_characters_random_string
POSTGRES_PASSWORD=strong_password_minimum_16_characters
```

### Database Security
1. **Connection Pool**
   - Max connections: 10 (default)
   - Timeout: 30 seconds
   - SSL mode: require (production)

2. **Query Safety**
   - Always use parameterized queries
   - Never interpolate user input directly into SQL
   - Use transactions for multi-step operations

3. **Permissions**
   - Aplikasi user: READ, INSERT, UPDATE (NO DELETE)
   - Admin user: Full access untuk maintenance
   - Separate roles untuk dev/staging/prod

### API Security Checklist
- [ ] Validasi semua input dengan Zod schemas
- [ ] Check authorization di setiap protected endpoint
- [ ] Log semua critical operations ke audit_logs
- [ ] Return generic error messages (jangan expose internal details)
- [ ] Rate limit semua public endpoints
- [ ] Validate Content-Type headers
- [ ] Sanitize error messages (no stack traces to client)

### Session Management
- Session duration: 24 jam
- Cookie flags: `httpOnly`, `secure`, `sameSite: strict`
- Auto-logout setelah inactivity (implementasi di client)
- Token refresh mechanism (future improvement)

## 🔍 Security Monitoring

### Audit Logs Query Examples

```sql
-- Failed login attempts dalam 1 jam terakhir
SELECT username, ip_address, COUNT(*) as attempts
FROM core.audit_logs
WHERE action = 'login_failed' 
  AND created_at > now() - interval '1 hour'
GROUP BY username, ip_address
HAVING COUNT(*) >= 3;

-- Suspicious IP addresses (multiple failed logins)
SELECT ip_address, COUNT(DISTINCT user_id) as users_attempted, COUNT(*) as total_attempts
FROM core.audit_logs
WHERE action = 'login_failed'
  AND created_at > now() - interval '24 hours'
GROUP BY ip_address
HAVING COUNT(*) >= 10;

-- Critical operations oleh specific user
SELECT action, resource_type, resource_id, created_at, metadata
FROM core.audit_logs
WHERE user_id = 'xxx-xxx-xxx'
  AND action IN ('product_delete', 'sale_cancel', 'float_adjust')
ORDER BY created_at DESC;
```

## 🛡️ Incident Response

### Jika Terjadi Security Breach:

1. **Immediate Actions**
   - Rotate semua secrets (JWT_SECRET, QRIS_WEBHOOK_SECRET)
   - Force logout semua user (clear cookies)
   - Disable compromised accounts
   - Enable maintenance mode jika diperlukan

2. **Investigation**
   - Query audit_logs untuk timeline
   - Check IP addresses yang mencurigakan
   - Review recent code changes
   - Inspect database for anomalies

3. **Recovery**
   - Patch vulnerability
   - Restore from backup jika data corrupted
   - Update dependencies
   - Deploy hotfix

4. **Post-Mortem**
   - Document what happened
   - Update security procedures
   - Notify stakeholders jika diperlukan

## 📋 Security Checklist untuk Deployment

### Pre-Production
- [ ] Semua secrets di-generate dengan crypto.randomBytes(32)
- [ ] .env files tidak ter-commit ke git
- [ ] Database credentials strong & unique
- [ ] SSL/TLS certificates valid
- [ ] Cloudflare tunnel configured properly
- [ ] Firewall rules configured (hanya allow port 443)
- [ ] Database backups automated

### Production
- [ ] NODE_ENV=production
- [ ] Cookie secure flag = true
- [ ] HTTPS only (redirect HTTP → HTTPS)
- [ ] Rate limiting active
- [ ] Audit logging enabled
- [ ] Error reporting configured (Sentry/similar)
- [ ] Monitoring & alerting setup
- [ ] Regular security updates schedule

## 🔗 Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/pages/building-your-application/configuring/security)
- [PostgreSQL Security Checklist](https://www.postgresql.org/docs/current/security.html)
- [Node.js Security Best Practices](https://nodejs.org/en/learn/getting-started/security-best-practices)

## 📞 Security Contact

Jika menemukan vulnerability, segera laporkan ke:
- Email: security@example.com
- Jangan publish vulnerability secara publik sebelum dipatch

---

**Last Updated**: 2026-06-25
**Version**: 1.0.0
