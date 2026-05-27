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
      subject: 'Xác thực tài khoản AI Debate Platform',
      html: `<p>Nhấn vào liên kết sau để xác thực tài khoản:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p>`,
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${ENV.CLIENT_URL}/reset-password?token=${token}`;
    await this.getTransporter().sendMail({
      from: ENV.MAIL_FROM || ENV.SMTP_USER,
      to: email,
      subject: 'Đặt lại mật khẩu AI Debate Platform',
      html: `<p>Nhấn vào liên kết sau để đặt lại mật khẩu:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  }
}

export const emailService = new EmailService();
