/**
 * EMAIL LIBRARY — Resend
 *
 * All email sending goes through this file.
 * Never import Resend directly in services — always use these functions.
 *
 * Why Resend over Nodemailer?
 *  - Nodemailer keeps persistent SMTP connections which break on serverless
 *  - Resend uses HTTP API — works perfectly on Vercel
 *  - Better deliverability (dedicated infrastructure)
 *  - React Email templates look great out of the box
 */

import { Resend } from "resend";
import { OtpEmailTemplate }          from "@/emails/otp-email";
import { WelcomeEmailTemplate }       from "@/emails/welcome-email";
import { WalletCreditEmailTemplate }  from "@/emails/wallet-credit-email";
import { EventRegistrationEmailTemplate } from "@/emails/event-registration-email";

// ─────────────────────────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────────────────────────

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not set in environment variables.");
    }
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const FROM_NAME  = process.env.RESEND_FROM_NAME  ?? "NexCell";
const FROM       = `${FROM_NAME} <${FROM_EMAIL}>`;

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface SendEmailResult {
  success: boolean;
  id?:     string;
  error?:  string;
}

// ─────────────────────────────────────────────────────────────
// SEND FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Sends the OTP email to the user during login.
 * This is the most critical email — it must always work.
 */
export async function sendOtpEmail(params: {
  to:        string;
  otp:       string;
  expiresAt: Date;
  ipAddress?: string;
}): Promise<SendEmailResult> {
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      params.to,
      subject: `${params.otp} is your NexCell login code`,
      react:   OtpEmailTemplate({
        otp:       params.otp,
        email:     params.to,
        expiresAt: params.expiresAt,
        ipAddress: params.ipAddress,
      }),
    });

    if (error) {
      console.error("[Email] OTP send failed:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("[Email] OTP send exception:", err);
    return { success: false, error: "Failed to send email" };
  }
}

/**
 * Sends a welcome email to new users on their first login.
 */
export async function sendWelcomeEmail(params: {
  to:   string;
  name: string;
}): Promise<SendEmailResult> {
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      params.to,
      subject: `Welcome to NexCell — Where Founders Are Made`,
      react:   WelcomeEmailTemplate({
        name:  params.name || "there",
        email: params.to,
      }),
    });

    if (error) {
      console.error("[Email] Welcome send failed:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("[Email] Welcome send exception:", err);
    return { success: false, error: "Failed to send email" };
  }
}

/**
 * Sends a notification when the user's wallet is credited.
 */
export async function sendWalletCreditEmail(params: {
  to:          string;
  name:        string;
  amountMb:    number;
  amountInr:   number;
  description: string;
  newBalance:  number;
}): Promise<SendEmailResult> {
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      params.to,
      subject: `Your NexCell wallet was credited ₥${params.amountMb.toLocaleString()}`,
      react:   WalletCreditEmailTemplate(params),
    });

    if (error) {
      console.error("[Email] Wallet credit send failed:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("[Email] Wallet credit exception:", err);
    return { success: false, error: "Failed to send email" };
  }
}

/**
 * Sends an event registration confirmation.
 */
export async function sendEventRegistrationEmail(params: {
  to:         string;
  name:       string;
  eventTitle: string;
  eventDate:  Date;
  eventId:    string;
  isPaid:     boolean;
  amountPaid?: number;
}): Promise<SendEmailResult> {
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      params.to,
      subject: `Registration confirmed: ${params.eventTitle}`,
      react:   EventRegistrationEmailTemplate(params),
    });

    if (error) {
      console.error("[Email] Event reg send failed:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("[Email] Event reg exception:", err);
    return { success: false, error: "Failed to send email" };
  }
}

/**
 * Generic notification email for payment approval/rejection.
 */
export async function sendPaymentStatusEmail(params: {
  to:       string;
  name:     string;
  status:   "approved" | "rejected";
  amountInr: number;
  amountMb?: number;
  reason?:   string;
}): Promise<SendEmailResult> {
  try {
    const resend = getResend();
    const subject = params.status === "approved"
      ? `Payment approved — ₥${params.amountMb?.toLocaleString()} credited to your wallet`
      : `Payment request update`;

    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      params.to,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0D1117; color: #ffffff; padding: 32px; border-radius: 12px;">
          <h2 style="color: ${params.status === "approved" ? "#06B6D4" : "#EF4444"}">
            Payment ${params.status === "approved" ? "Approved" : "Rejected"}
          </h2>
          <p>Hi ${params.name || "there"},</p>
          ${params.status === "approved"
            ? `<p>Your payment of ₹${params.amountInr} has been verified and <strong style="color: #06B6D4">₥${params.amountMb?.toLocaleString()}</strong> has been credited to your NexCell wallet.</p>`
            : `<p>Your payment request of ₹${params.amountInr} was not approved.${params.reason ? `<br><br>Reason: ${params.reason}` : ""}</p>`
          }
          <p>Questions? Contact us at nexcell.mirai@gmail.com</p>
          <p style="color: #888; font-size: 12px; margin-top: 32px;">NexCell — Entrepreneurship Club of Mirai School of Technology</p>
        </div>
      `,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  } catch (err) {
    console.error("[Email] Payment status exception:", err);
    return { success: false, error: "Failed to send email" };
  }
}
