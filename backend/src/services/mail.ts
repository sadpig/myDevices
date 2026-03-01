import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

let transporter: nodemailer.Transporter | null = null;
let prismaRef: PrismaClient | null = null;

export function initMail(prisma: PrismaClient) { prismaRef = prisma; }

async function getSmtpConfig() {
  if (prismaRef) {
    try {
      const settings = await prismaRef.systemSetting.findMany({
        where: { key: { startsWith: 'smtp.' } },
      });
      const map = Object.fromEntries(settings.map((s: { key: string; value: string }) => [s.key, s.value]));
      if (map['smtp.host']) return map;
    } catch { /* fallback to env */ }
  }
  return {
    'smtp.host': process.env.SMTP_HOST || '',
    'smtp.port': process.env.SMTP_PORT || '587',
    'smtp.user': process.env.SMTP_USER || '',
    'smtp.pass': process.env.SMTP_PASS || '',
    'smtp.from': process.env.SMTP_FROM || '',
    'smtp.secure': process.env.SMTP_SECURE || 'false',
  };
}

async function getTransporter() {
  const cfg = await getSmtpConfig();
  if (!cfg['smtp.host']) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: cfg['smtp.host'],
      port: parseInt(cfg['smtp.port'] || '587'),
      secure: cfg['smtp.secure'] === 'true',
      auth: { user: cfg['smtp.user'], pass: cfg['smtp.pass'] },
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const t = await getTransporter();
  if (!t) return false;
  const cfg = await getSmtpConfig();
  try {
    await t.sendMail({ from: cfg['smtp.from'] || cfg['smtp.user'], to, subject, html });
    return true;
  } catch (err) {
    console.error('Failed to send email:', err);
    return false;
  }
}

export function resetTransporter() { transporter = null; }
