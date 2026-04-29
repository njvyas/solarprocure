/**
 * email.service.js
 * Sends transactional emails via SMTP.
 * SMTP config is loaded from system_settings (configurable in Admin UI).
 * Gracefully no-ops if email is disabled or SMTP not configured.
 */
const nodemailer = require('nodemailer');
const settings   = require('./settings.service');
const logger     = require('../utils/logger');

let _transporter = null;
let _configHash  = '';

async function getTransporter() {
  const cfg = await settings.get('email');
  if (cfg.enabled !== 'true' || !cfg.host || !cfg.user) return null;

  // Rebuild transporter only if config changed
  const hash = `${cfg.host}:${cfg.port}:${cfg.user}:${cfg.secure}`;
  if (_transporter && hash === _configHash) return _transporter;

  _transporter = nodemailer.createTransport({
    host:   cfg.host,
    port:   parseInt(cfg.port) || 587,
    secure: cfg.secure === 'true',
    auth:   { user: cfg.user, pass: cfg.password },
    tls:    { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });
  _configHash = hash;
  return _transporter;
}

async function send({ to, subject, html, text }) {
  const transporter = await getTransporter();
  if (!transporter) {
    logger.info('Email skipped — SMTP not configured or disabled', { to, subject });
    return { skipped: true };
  }
  const cfg = await settings.get('email');
  try {
    const info = await transporter.sendMail({
      from: `"${cfg.from_name || 'SolarProcure'}" <${cfg.from_email || cfg.user}>`,
      to,
      subject,
      html,
      text,
    });
    logger.info('Email sent', { to, subject, messageId: info.messageId });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    logger.error('Email send failed', { to, subject, error: err.message });
    return { sent: false, error: err.message };
  }
}

async function testConnection() {
  const transporter = await getTransporter();
  if (!transporter) return { ok: false, error: 'SMTP not configured or email disabled' };
  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Transactional templates ─────────────────────────────────────

async function sendRfqInvite({ vendorEmail, vendorName, rfqTitle, rfqId, bidToken, deadline, tenantName }) {
  const appName = (await settings.getValue('branding', 'app_name')) || 'SolarProcure';
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const bidUrl  = `${baseUrl}/bid/${rfqId}?token=${bidToken}`;

  return send({
    to:      vendorEmail,
    subject: `[${appName}] Invitation to bid — ${rfqTitle}`,
    text: `Dear ${vendorName},\n\nYou have been invited to submit a quote for: ${rfqTitle}\n\nDeadline: ${deadline}\nBid link: ${bidUrl}\n\nThis link is unique to your account. Do not share it.\n\n— ${tenantName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <div style="background:#1e293b;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="color:#f8fafc;margin:0;font-size:18px">${appName}</h2>
        </div>
        <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
          <p style="color:#1e293b">Dear <strong>${vendorName}</strong>,</p>
          <p style="color:#1e293b">You have been invited to submit a quote for the following RFQ:</p>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0">
            <strong style="color:#3B82F6;font-size:16px">${rfqTitle}</strong>
            <p style="color:#64748b;margin:8px 0 0">Submission deadline: <strong>${deadline}</strong></p>
          </div>
          <a href="${bidUrl}" style="display:inline-block;background:#3B82F6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:8px 0">
            Submit Your Quote →
          </a>
          <p style="color:#94a3b8;font-size:12px;margin-top:24px">This link is unique to your account. Do not share it.<br>Sent by ${tenantName} via ${appName}.</p>
        </div>
      </div>`,
  });
}

async function sendVendorRegistered({ adminEmail, vendorName, vendorEmail, tenantName }) {
  const appName = (await settings.getValue('branding', 'app_name')) || 'SolarProcure';
  return send({
    to:      adminEmail,
    subject: `[${appName}] New vendor registration — ${vendorName}`,
    text: `A new vendor has registered and is pending approval.\n\nVendor: ${vendorName}\nEmail: ${vendorEmail}\nTenant: ${tenantName}\n\nLog in to review and approve.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <div style="background:#1e293b;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="color:#f8fafc;margin:0;font-size:18px">${appName}</h2>
        </div>
        <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
          <p style="color:#1e293b">A new vendor has registered and is pending approval:</p>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0">
            <strong style="color:#1e293b">${vendorName}</strong><br>
            <span style="color:#64748b">${vendorEmail}</span>
          </div>
          <p style="color:#1e293b">Log in to <strong>${appName}</strong> to review and approve the vendor.</p>
        </div>
      </div>`,
  });
}

async function sendPoNotification({ to, poNumber, status, amount, currency, recipientName }) {
  const appName = (await settings.getValue('branding', 'app_name')) || 'SolarProcure';
  const statusLabel = { approved: 'Approved ✓', rejected: 'Rejected ✗', pending: 'Pending Review' }[status] || status;
  return send({
    to,
    subject: `[${appName}] Purchase Order ${poNumber} — ${statusLabel}`,
    text: `Dear ${recipientName},\n\nPurchase Order ${poNumber} has been ${status}.\nAmount: ${currency} ${amount}\n\nLog in to view details.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <div style="background:#1e293b;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="color:#f8fafc;margin:0;font-size:18px">${appName}</h2>
        </div>
        <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
          <p style="color:#1e293b">Dear <strong>${recipientName}</strong>,</p>
          <p style="color:#1e293b">Purchase Order <strong>${poNumber}</strong> status has been updated:</p>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0;font-size:18px;font-weight:600;color:${status==='approved'?'#22c55e':status==='rejected'?'#ef4444':'#f59e0b'}">
            ${statusLabel}
          </div>
          <p style="color:#64748b">Amount: <strong>${currency} ${amount}</strong></p>
        </div>
      </div>`,
  });
}

module.exports = { send, testConnection, sendRfqInvite, sendVendorRegistered, sendPoNotification };
