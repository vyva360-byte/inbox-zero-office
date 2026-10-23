import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    try {
      await axios.post(
        emailGatewayUrl(),
        { to: email, otp: token },
        { headers: emailGatewayHeaders() },
      );
    } catch (error) {
      throw emailGatewayError(error);
    }
  },
});

// Sign-in codes are sent through a small email gateway configured on the
// Convex deployment. Set these environment variables on the deployment:
//
//   EMAIL_OTP_GATEWAY_URL   Base URL of a gateway that accepts
//                           POST {base}/v1/email/otp with JSON
//                           { "to": <email>, "otp": <code> }.
//   EMAIL_OTP_GATEWAY_KEY   Bearer key for that gateway.
//
// If the gateway is not configured, email sign-in fails with a clear error
// and guest (anonymous) sign-in remains available.
function emailGatewayUrl(): string {
  const base = process.env.EMAIL_OTP_GATEWAY_URL;
  if (!base) {
    throw new Error(
      "EMAIL_OTP_GATEWAY_URL is not set on this Convex deployment, so email sign-in cannot send codes.",
    );
  }
  return `${base.replace(/\/+$/, "")}/v1/email/otp`;
}

function emailGatewayHeaders(): Record<string, string> {
  const key = process.env.EMAIL_OTP_GATEWAY_KEY;
  if (!key) {
    throw new Error(
      "EMAIL_OTP_GATEWAY_KEY is not set on this Convex deployment, so email sign-in cannot send codes.",
    );
  }
  return { Authorization: `Bearer ${key}` };
}

// Never stringify the whole request error: it carries the request headers.
function emailGatewayError(error: unknown): Error {
  const response = (
    error as { response?: { status?: number; data?: { error?: unknown } } }
  )?.response;
  if (response) {
    const detail =
      typeof response.data?.error === "string" ? `: ${response.data.error}` : "";
    return new Error(
      `Could not send the sign-in code (HTTP ${response.status})${detail}`,
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Could not send the sign-in code: ${message}`);
}
