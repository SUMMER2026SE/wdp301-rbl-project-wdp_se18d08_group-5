import nodemailer from 'nodemailer';
import { ENV } from '../../config/env.js';
import { BadRequestError } from '../../utils/AppError.js';

class EmailService {
  private getTransporter() {
    if (!ENV.SMTP_USER || !ENV.SMTP_PASS) {
      throw new BadRequestError('SMTP email configuration is missing');
    }

    return nodemailer.createTransport({
      host: ENV.SMTP_HOST,
      port: ENV.SMTP_PORT,
      secure: ENV.SMTP_PORT === 465,
      auth: {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS,
      },
    });
  }

  async sendVerificationEmail(email: string, token: string) {
    const verificationUrl = `${ENV.CLIENT_URL}/verify-email?token=${token}`;
    await this.getTransporter().sendMail({
      from: ENV.MAIL_FROM || ENV.SMTP_USER,
      to: email,
      subject: 'Verify your AI Debate Platform account',
      html: `<p>Click the link below to verify your account:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p>`,
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${ENV.CLIENT_URL}/reset-password?token=${token}`;
    await this.getTransporter().sendMail({
      from: ENV.MAIL_FROM || ENV.SMTP_USER,
      to: email,
      subject: 'Reset your AI Debate Platform password',
      html: `<p>Click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  }
}

export const emailService = new EmailService();
