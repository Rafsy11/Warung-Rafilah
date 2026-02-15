import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

/**
 * Send email
 */
export async function sendEmail(to, subject, html) {
  try {
    const result = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html
    });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send login notification email
 */
export async function sendLoginNotification(email, username, deviceName) {
  const html = `
    <h2>Login Ke Akun Anda</h2>
    <p>Akun Anda baru saja login dari perangkat:</p>
    <p><strong>${deviceName || 'Unknown Device'}</strong></p>
    <p>Waktu: ${new Date().toLocaleString('id-ID')}</p>
    <p>Jika ini bukan Anda, segera ubah password akun Anda.</p>
  `;
  return sendEmail(email, '✓ Login Berhasil - Toko Rafilah', html);
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email, resetToken, username) {
  const resetLink = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
  const html = `
    <h2>Reset Password Anda</h2>
    <p>Halo ${username},</p>
    <p>Kami menerima permintaan untuk reset password akun Anda.</p>
    <p><a href="${resetLink}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
    <p>Link ini berlaku selama 1 jam.</p>
    <p>Jika Anda tidak melakukan permintaan ini, abaikan email ini.</p>
  `;
  return sendEmail(email, '🔐 Reset Password - Toko Rafilah', html);
}

/**
 * Send verification email
 */
export async function sendVerificationEmail(email, verificationToken, username) {
  const verifyLink = `${process.env.APP_URL}/verify-email?token=${verificationToken}`;
  const html = `
    <h2>Verifikasi Email Anda</h2>
    <p>Halo ${username},</p>
    <p>Terima kasih telah mendaftar di Toko Rafilah.</p>
    <p><a href="${verifyLink}" style="background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verifikasi Email</a></p>
    <p>Link ini berlaku selama 24 jam.</p>
  `;
  return sendEmail(email, '✉️ Verifikasi Email - Toko Rafilah', html);
}

export default {
  sendEmail,
  sendLoginNotification,
  sendPasswordResetEmail,
  sendVerificationEmail
};
