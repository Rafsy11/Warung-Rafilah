import { query, getRow, insert } from '../lib/db.js';
import {
  hashPassword,
  comparePassword,
  generateToken,
  sanitizeInput,
  validateEmail,
  validatePassword,
  generateDeviceToken,
  generateRandomToken
} from '../lib/auth.js';
import { sendLoginNotification, sendPasswordResetEmail, sendVerificationEmail } from '../lib/mailer.js';
import { authenticate } from '../middleware/auth.js';

export default async function authRoutes(fastify) {
  /**
   * Login
   */
  fastify.post('/login', async (request, reply) => {
    try {
      const { username, password, remember_me } = request.body;

      // Validate input
      if (!username || !password) {
        return reply.status(400).send({
          success: false,
          message: 'Username dan password harus diisi'
        });
      }

      // Find user
      const user = await getRow(
        'SELECT id, username, email, nama_lengkap, password FROM users WHERE username = ? OR email = ?',
        [username, username]
      );

      if (!user) {
        return reply.status(401).send({
          success: false,
          message: 'Username atau password salah'
        });
      }

      // Verify password
      const passwordValid = await comparePassword(password, user.password);
      if (!passwordValid) {
        return reply.status(401).send({
          success: false,
          message: 'Username atau password salah'
        });
      }

      // Get device info
      const userAgent = request.headers['user-agent'];
      const deviceName = getDeviceName(userAgent);

      // Generate tokens
      const jwtToken = generateToken(user.id, {
        username: user.username,
        email: user.email,
        nama_lengkap: user.nama_lengkap
      });

      let deviceToken = null;
      if (remember_me) {
        deviceToken = generateDeviceToken();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Save device token to database
        await insert(
          'INSERT INTO device_tokens (user_id, token, device_name, device_ua, ip_address, expires_at, is_active) VALUES (?, ?, ?, ?, ?, ?, TRUE)',
          [
            user.id,
            deviceToken,
            deviceName,
            userAgent,
            request.ip,
            expiresAt
          ]
        );

        // Set cookie
        reply.setCookie('device_token', deviceToken, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'Lax',
          maxAge: 30 * 24 * 60 * 60 // 30 days
        });
      }

      // Update last login
      await query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

      // Send notification email
      await sendLoginNotification(user.email, user.username, deviceName);

      return reply.send({
        success: true,
        message: 'Login berhasil!',
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          nama_lengkap: user.nama_lengkap,
          token: jwtToken,
          deviceToken: remember_me ? deviceToken : undefined
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal login'
      });
    }
  });

  /**
   * Register/Sign Up - DISABLED
   */
  fastify.post('/register', async (request, reply) => {
    return reply.status(403).send({
      success: false,
      message: 'Fitur pendaftaran telah dinonaktifkan. Hubungi administrator untuk membuat akun baru.'
    });
  });
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal registrasi'
      });
    }
  ;

  /**
   * Logout
   */
  fastify.post('/logout', { onRequest: [authenticate] }, async (request, reply) => {
    try {
      // Clear device token
      const deviceToken = request.cookies.device_token;
      if (deviceToken) {
        await query('UPDATE device_tokens SET is_active = FALSE WHERE token = ?', [deviceToken]);
        reply.clearCookie('device_token');
      }

      return reply.send({
        success: true,
        message: 'Logout berhasil'
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal logout'
      });
    }
  });

  /**
   * Forgot Password
   */
  fastify.post('/forgot-password', async (request, reply) => {
    try {
      const { email } = request.body;

      if (!email) {
        return reply.status(400).send({
          success: false,
          message: 'Email harus diisi'
        });
      }

      // Find user
      const user = await getRow('SELECT id, username, email FROM users WHERE email = ?', [email]);

      if (!user) {
        // Don't reveal if email exists
        return reply.send({
          success: true,
          message: 'Jika email terdaftar, Anda akan menerima link reset password'
        });
      }

      // Generate reset token
      const resetToken = generateRandomToken();
      await insert(
        'INSERT INTO password_resets (user_id, token, type, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))',
        [user.id, resetToken, 'password_reset']
      );

      // Send email
      await sendPasswordResetEmail(email, resetToken, user.username);

      return reply.send({
        success: true,
        message: 'Jika email terdaftar, Anda akan menerima link reset password'
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal memproses permintaan'
      });
    }
  });

  /**
   * Reset Password
   */
  fastify.post('/reset-password', async (request, reply) => {
    try {
      const { token, password, password_confirm } = request.body;

      if (!token || !password) {
        return reply.status(400).send({
          success: false,
          message: 'Token dan password harus diisi'
        });
      }

      if (password !== password_confirm) {
        return reply.status(400).send({
          success: false,
          message: 'Password tidak cocok'
        });
      }

      // Validate password
      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) {
        return reply.status(400).send({
          success: false,
          message: passwordCheck.message
        });
      }

      // Find reset token
      const reset = await getRow(
        'SELECT user_id FROM password_resets WHERE token = ? AND type = ? AND expires_at > NOW()',
        [token, 'password_reset']
      );

      if (!reset) {
        return reply.status(400).send({
          success: false,
          message: 'Link reset password tidak valid atau sudah kadaluarsa'
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Update password
      await query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, reset.user_id]);

      // Delete used token
      await query('DELETE FROM password_resets WHERE token = ?', [token]);

      return reply.send({
        success: true,
        message: 'Password berhasil direset. Silakan login dengan password baru'
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        message: 'Gagal reset password'
      });
    }
  });

  /**
   * Get current user
   */
  fastify.get('/me', { onRequest: [authenticate] }, async (request, reply) => {
    return reply.send({
      success: true,
      data: request.user
    });
  });


/**
 * Get device name from user agent
 */
function getDeviceName(userAgent) {
  if (!userAgent) return 'Unknown Device';

  if (/Mobi|Android/i.test(userAgent)) {
    if (/iPhone/i.test(userAgent)) return 'iPhone';
    if (/iPad/i.test(userAgent)) return 'iPad';
    if (/Android/i.test(userAgent)) return 'Android Phone';
    return 'Mobile Device';
  }
  if (/Windows/i.test(userAgent)) return 'Windows PC';
  if (/Macintosh/i.test(userAgent)) return 'Mac';
  if (/Linux/i.test(userAgent)) return 'Linux';

  return 'Unknown Device';
}
