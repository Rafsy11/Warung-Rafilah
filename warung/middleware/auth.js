import { verifyToken } from '../lib/auth.js';
import { getRow } from '../lib/db.js';

/**
 * Authentication middleware
 */
export async function authenticate(request, reply) {
  try {
    // Check for Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Check for device token in cookies
      const deviceToken = request.cookies.device_token;
      if (!deviceToken) {
        return reply.status(401).send({
          success: false,
          message: 'Tidak ada token autentikasi'
        });
      }

      // Verify device token
      const deviceData = await getRow(
        `SELECT dt.user_id, u.id, u.username, u.email, u.nama_lengkap
         FROM device_tokens dt
         JOIN users u ON dt.user_id = u.id
         WHERE dt.token = ? AND dt.is_active = TRUE
         AND (dt.expires_at IS NULL OR dt.expires_at > NOW())`,
        [deviceToken]
      );

      if (!deviceData) {
        reply.clearCookie('device_token');
        return reply.status(401).send({
          success: false,
          message: 'Device token tidak valid atau sudah kadaluarsa'
        });
      }

      request.user = deviceData;
      return;
    }

    // Extract JWT token
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return reply.status(401).send({
        success: false,
        message: 'Token tidak valid atau sudah kadaluarsa'
      });
    }

    // Get user data from database
    const user = await getRow(
      'SELECT id, username, email, nama_lengkap FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user) {
      return reply.status(401).send({
        success: false,
        message: 'User tidak ditemukan'
      });
    }

    request.user = user;
  } catch (error) {
    return reply.status(401).send({
      success: false,
      message: 'Gagal verifikasi autentikasi'
    });
  }
}

/**
 * Optional authentication - doesn't fail if unauthenticated
 */
export async function optionalAuth(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);

      if (decoded) {
        const user = await getRow(
          'SELECT id, username, email, nama_lengkap FROM users WHERE id = ?',
          [decoded.id]
        );
        if (user) {
          request.user = user;
        }
      }
    }
  } catch (error) {
    // Silently ignore
  }
}

export default { authenticate, optionalAuth };
