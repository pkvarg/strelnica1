import { db } from "@/db";
import { notificationsLog } from "@/db/schema";
import crypto from "crypto";

const HONO_URL = process.env.NEXT_PUBLIC_HONO_API_URL || "https://hono.pictusweb.sk";
const API_TOKEN = process.env.STRELNICA_API_TOKEN || "";

async function callHono(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${HONO_URL}/api/strelnica/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  return { success: res.ok, error: data.error };
}

async function logNotification(opts: {
  channel: "email" | "sms";
  to: string;
  template: string;
  locale: string;
  subject?: string;
  body?: string;
  bookingId?: string;
  userId?: string;
  status: "sent" | "failed" | "retrying";
  providerResponse?: unknown;
}) {
  await db.insert(notificationsLog).values({
    channel: opts.channel,
    to: opts.to,
    template: opts.template,
    locale: opts.locale as "sk" | "hu",
    subject: opts.subject ?? null,
    bodyHash: opts.body
      ? crypto.createHash("sha256").update(opts.body).digest("hex")
      : null,
    bookingId: opts.bookingId ?? null,
    userId: opts.userId ?? null,
    status: opts.status as "sent" | "failed" | "retrying",
    providerResponse: opts.providerResponse ?? null,
  });
}

export async function notifyInvitation(opts: {
  email: string;
  firstName: string;
  invitationUrl: string;
  locale: string;
  userId: string;
}) {
  const result = await callHono("invitation", {
    email: opts.email,
    firstName: opts.firstName,
    invitationUrl: opts.invitationUrl,
    locale: opts.locale,
  });

  await logNotification({
    channel: "email",
    to: opts.email,
    template: "invitation",
    locale: opts.locale,
    userId: opts.userId,
    status: result.success ? "sent" : "failed",
    providerResponse: result,
  });

  return result;
}

export async function notifyOtpEmail(opts: {
  email: string;
  code: string;
  purpose: string;
  locale: string;
  userId?: string;
}) {
  const result = await callHono("otp/email", {
    email: opts.email,
    code: opts.code,
    purpose: opts.purpose,
    locale: opts.locale,
  });

  await logNotification({
    channel: "email",
    to: opts.email,
    template: "otp_email",
    locale: opts.locale,
    userId: opts.userId,
    status: result.success ? "sent" : "failed",
    providerResponse: result,
  });

  return result;
}

export async function notifyOtpSms(opts: {
  phone: string;
  code: string;
  purpose: string;
  locale: string;
  userId?: string;
}) {
  const result = await callHono("otp/sms", {
    phone: opts.phone,
    code: opts.code,
    purpose: opts.purpose,
    locale: opts.locale,
  });

  await logNotification({
    channel: "sms",
    to: opts.phone,
    template: "otp_sms",
    locale: opts.locale,
    userId: opts.userId,
    status: result.success ? "sent" : "failed",
    providerResponse: result,
  });

  return result;
}

export async function notifyAdminsBookingRequest(opts: {
  memberName: string;
  memberEmail: string;
  rangeId: string;
  date: string;
  time: string;
  guestCount: number;
  note: string | null;
  approveUrl: string;
  declineUrl: string;
  adminEmails: string[];
  locale: string;
  bookingId: string;
}) {
  for (const email of opts.adminEmails) {
    const result = await callHono("booking-request-admin", {
      email,
      memberName: opts.memberName,
      memberEmail: opts.memberEmail,
      rangeId: opts.rangeId,
      date: opts.date,
      time: opts.time,
      guestCount: opts.guestCount,
      note: opts.note,
      approveUrl: opts.approveUrl,
      declineUrl: opts.declineUrl,
      locale: opts.locale,
    });

    await logNotification({
      channel: "email",
      to: email,
      template: "booking_request_admin",
      locale: opts.locale,
      bookingId: opts.bookingId,
      status: result.success ? "sent" : "failed",
      providerResponse: result,
    });
  }
}

export async function notifyMemberBookingApproved(opts: {
  email: string;
  phone: string;
  memberName: string;
  rangeId: string;
  date: string;
  time: string;
  locale: string;
  bookingId: string;
  userId: string;
}) {
  const emailResult = await callHono("booking-approved", {
    email: opts.email,
    memberName: opts.memberName,
    rangeId: opts.rangeId,
    date: opts.date,
    time: opts.time,
    locale: opts.locale,
  });

  await logNotification({
    channel: "email",
    to: opts.email,
    template: "booking_approved",
    locale: opts.locale,
    bookingId: opts.bookingId,
    userId: opts.userId,
    status: emailResult.success ? "sent" : "failed",
    providerResponse: emailResult,
  });

  return emailResult;
}

export async function notifyMemberBookingDeclined(opts: {
  email: string;
  memberName: string;
  rangeId: string;
  date: string;
  time: string;
  reason: string | null;
  locale: string;
  bookingId: string;
  userId: string;
}) {
  const result = await callHono("booking-declined", {
    email: opts.email,
    memberName: opts.memberName,
    rangeId: opts.rangeId,
    date: opts.date,
    time: opts.time,
    reason: opts.reason,
    locale: opts.locale,
  });

  await logNotification({
    channel: "email",
    to: opts.email,
    template: "booking_declined",
    locale: opts.locale,
    bookingId: opts.bookingId,
    userId: opts.userId,
    status: result.success ? "sent" : "failed",
    providerResponse: result,
  });

  return result;
}

export async function notifyBookingReminder(opts: {
  email: string;
  phone: string;
  memberName: string;
  rangeId: string;
  date: string;
  time: string;
  checkInUrl: string;
  locale: string;
  bookingId: string;
  userId: string;
}) {
  const emailResult = await callHono("booking-reminder", {
    email: opts.email,
    memberName: opts.memberName,
    rangeId: opts.rangeId,
    date: opts.date,
    time: opts.time,
    checkInUrl: opts.checkInUrl,
    locale: opts.locale,
  });

  await logNotification({
    channel: "email",
    to: opts.email,
    template: "booking_reminder",
    locale: opts.locale,
    bookingId: opts.bookingId,
    userId: opts.userId,
    status: emailResult.success ? "sent" : "failed",
    providerResponse: emailResult,
  });

  return emailResult;
}

export async function notifyPasswordReset(opts: {
  email: string;
  firstName: string;
  resetUrl: string;
  locale: string;
  userId?: string;
}) {
  const result = await callHono("password-reset", {
    email: opts.email,
    firstName: opts.firstName,
    resetUrl: opts.resetUrl,
    locale: opts.locale,
  });

  await logNotification({
    channel: "email",
    to: opts.email,
    template: "password_reset",
    locale: opts.locale,
    userId: opts.userId,
    status: result.success ? "sent" : "failed",
    providerResponse: result,
  });

  return result;
}

export async function notifyContact(opts: {
  name: string;
  email: string;
  phone: string | null;
  message: string;
  locale: string;
}) {
  const result = await callHono("contact", {
    name: opts.name,
    email: opts.email,
    phone: opts.phone,
    message: opts.message,
    locale: opts.locale,
  });

  await logNotification({
    channel: "email",
    to: "admin",
    template: "contact",
    locale: opts.locale,
    status: result.success ? "sent" : "failed",
    providerResponse: result,
  });

  return result;
}
