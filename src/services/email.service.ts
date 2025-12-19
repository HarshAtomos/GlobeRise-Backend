import nodemailer from 'nodemailer';
import { config } from '../config/env';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.host,          // smtp.gmail.com
      port: config.email.port,          // 587
      secure: false,                    // MUST be false for 587
      auth: {
        user: config.email.user,        // no-reply@globerise.eu
        pass: config.email.pass,        // App Password
      },
      requireTLS: true,                 // 🔒 Force STARTTLS
      tls: {
        rejectUnauthorized: true,       // 🔒 Prevent MITM
      },
    });

    // ✅ Verify SMTP connection at startup
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('❌ SMTP connection failed:', error);
      } else {
        console.log('✅ SMTP server is ready to send emails');
      }
    });
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${config.frontendUrl}/verify-email?token=${token}`;

    await this.transporter.sendMail({
      from: config.email.from,               // no-reply@globerise.eu
      replyTo: 'support@globerise.eu',        // Optional but recommended
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome! Please verify your email</h2>
          <p>Click the button below to verify your email address:</p>
          <a href="${verificationUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; 
                    color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">
            Verify Email
          </a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #666; word-break: break-all;">${verificationUrl}</p>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">
            If you didn't create an account, please ignore this email.
          </p>
        </div>
      `,
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: config.email.from,
      replyTo: 'support@globerise.eu',
      to: email,
      subject: 'Reset Your Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #2196F3; 
                    color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">
            Reset Password
          </a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #666; word-break: break-all;">${resetUrl}</p>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">
            This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
          </p>
        </div>
      `,
    });
  }
}

export default new EmailService();
