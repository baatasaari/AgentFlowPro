import nodemailer from "nodemailer";
import type { BusinessSettings, Appointment, Service, StaffMember } from "@shared/schema";

function createTransporter(settings: BusinessSettings) {
  if (settings.smtpHost && settings.smtpUser && settings.smtpPass) {
    return nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: (settings.smtpPort || 587) === 465,
      auth: { user: settings.smtpUser, pass: settings.smtpPass },
    });
  }
  // Ethereal (dev-only — prints preview URL to console)
  return null;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export async function sendAppointmentConfirmation(opts: {
  settings: BusinessSettings;
  appointment: Appointment;
  service?: Service | null;
  staff?: StaffMember | null;
}) {
  const { settings, appointment, service, staff } = opts;
  const transporter = createTransporter(settings);
  if (!transporter) {
    // Dev mode: log to console
    console.log(`[EMAIL] Appointment confirmation would be sent to ${appointment.customerEmail}`);
    console.log(`  Appointment: ${appointment.startsAt} - ${service?.name || "General"}`);
    return;
  }

  const from = settings.smtpFrom || settings.email || `noreply@${settings.businessName || "agentflow"}.com`;
  const businessName = settings.businessName || "Our Practice";
  const starts = new Date(appointment.startsAt);
  const ends = new Date(appointment.endsAt);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Appointment Confirmation</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.1);">
      <tr><td style="background:#0ea5e9;padding:32px 40px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:24px;">Appointment Confirmed ✓</h1>
        <p style="color:rgba(255,255,255,.85);margin:8px 0 0;font-size:15px;">${businessName}</p>
      </td></tr>
      <tr><td style="padding:32px 40px;">
        <p style="font-size:16px;color:#111;margin:0 0 24px;">Hi ${appointment.customerName},</p>
        <p style="color:#555;margin:0 0 24px;">Your appointment has been confirmed. Here are the details:</p>
        <table width="100%" style="background:#f8fafc;border-radius:8px;padding:20px;" cellpadding="0" cellspacing="0">
          <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
            <span style="color:#6b7280;font-size:13px;">Service</span><br>
            <strong style="color:#111;font-size:15px;">${service?.name || "General Appointment"}</strong>
            ${service?.price && parseFloat(String(service.price)) > 0 ? `<span style="color:#0ea5e9;font-size:14px;"> — $${service.price} ${service.currency || "USD"}</span>` : ""}
          </td></tr>
          ${staff ? `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;">With</span><br><strong style="color:#111;font-size:15px;">${staff.name}</strong>${staff.role ? `<span style="color:#6b7280;"> · ${staff.role}</span>` : ""}</td></tr>` : ""}
          <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
            <span style="color:#6b7280;font-size:13px;">Date</span><br>
            <strong style="color:#111;font-size:15px;">${formatDate(starts)}</strong>
          </td></tr>
          <tr><td style="padding:8px 0;">
            <span style="color:#6b7280;font-size:13px;">Time</span><br>
            <strong style="color:#111;font-size:15px;">${formatTime(starts)} – ${formatTime(ends)}</strong>
          </td></tr>
        </table>
        ${appointment.customerNotes ? `<p style="color:#555;margin:16px 0 0;">Notes: <em>${appointment.customerNotes}</em></p>` : ""}
        <p style="color:#555;margin:24px 0 0;">If you need to reschedule or cancel, please contact us at least ${settings.cancellationPolicyHours || 24} hours in advance.</p>
        ${settings.phone ? `<p style="color:#555;margin:8px 0;">📞 ${settings.phone}</p>` : ""}
        ${settings.email ? `<p style="color:#555;margin:8px 0;">✉️ ${settings.email}</p>` : ""}
        ${settings.address ? `<p style="color:#555;margin:8px 0;">📍 ${settings.address}</p>` : ""}
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;color:#9ca3af;font-size:12px;">
        This email was sent by ${businessName}. If you did not make this booking, please contact us immediately.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  await transporter.sendMail({
    from,
    to: appointment.customerEmail,
    subject: `Appointment Confirmed — ${formatDate(starts)} at ${formatTime(starts)}`,
    html,
  });
}

export async function sendCancellationEmail(opts: {
  settings: BusinessSettings;
  appointment: Appointment;
  service?: Service | null;
}) {
  const { settings, appointment, service } = opts;
  const transporter = createTransporter(settings);
  if (!transporter) {
    console.log(`[EMAIL] Cancellation email would be sent to ${appointment.customerEmail}`);
    return;
  }

  const from = settings.smtpFrom || settings.email || `noreply@${settings.businessName}.com`;
  const starts = new Date(appointment.startsAt);

  await transporter.sendMail({
    from,
    to: appointment.customerEmail,
    subject: `Appointment Cancelled — ${formatDate(starts)}`,
    html: `<p>Hi ${appointment.customerName},</p>
<p>Your ${service?.name || "appointment"} on ${formatDate(starts)} at ${formatTime(starts)} has been cancelled.</p>
${appointment.cancellationReason ? `<p>Reason: ${appointment.cancellationReason}</p>` : ""}
<p>Please contact us to reschedule: ${settings.phone || settings.email || ""}</p>
<p>${settings.businessName}</p>`,
  });
}
