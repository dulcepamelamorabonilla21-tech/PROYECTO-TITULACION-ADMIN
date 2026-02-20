let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (_error) {
  nodemailer = null;
}

function isMailerConfigured() {
  return Boolean(
    nodemailer &&
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM
  );
}

function getTransporter() {
  if (!isMailerConfigured()) return null;

  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendLeadAssignedEmail({ to, advisorName, lead }) {
  const transporter = getTransporter();
  if (!transporter) {
    return { sent: false, reason: 'SMTP no configurado' };
  }

  const appUrl = process.env.ADVISOR_PORTAL_URL || 'http://localhost:5000/login.html';
  const subject = 'Nuevo lead asignado';
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.45;color:#0f172a;">
      <h2 style="margin:0 0 10px;">Hola ${advisorName}, tienes un nuevo lead asignado</h2>
      <p style="margin:0 0 14px;">Ingresa a tu portal para dar seguimiento al cliente.</p>
      <ul style="margin:0 0 14px;padding-left:18px;">
        <li><strong>Lead ID:</strong> ${lead.id}</li>
        <li><strong>Nombre:</strong> ${lead.nombre || '-'}</li>
        <li><strong>Email:</strong> ${lead.email || '-'}</li>
        <li><strong>Telefono:</strong> ${lead.telefono || '-'}</li>
        <li><strong>Servicio:</strong> ${lead.servicio || '-'}</li>
      </ul>
      <p style="margin:0 0 14px;">
        <a href="${appUrl}" style="display:inline-block;background:#0b57d0;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;">
          Ir al portal de asesor
        </a>
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html
  });

  return { sent: true };
}

module.exports = { sendLeadAssignedEmail, isMailerConfigured };
