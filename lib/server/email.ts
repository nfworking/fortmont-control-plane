import { Resend } from "resend";

import { ConfirmEmail } from "@/components/email-templates/verify-email";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;

const resend = resendApiKey ? new Resend(resendApiKey) : null;

function maskEmail(value: string) {
  const [localPart, domain] = value.split("@");
  if (!localPart || !domain) return "invalid-email";
  const lead = localPart.slice(0, 2);
  return `${lead}***@${domain}`;
}

function summarizeVerificationUrl(value: string) {
  try {
    const parsed = new URL(value);
    const callback = parsed.searchParams.get("callbackURL");
    const hasToken = Boolean(parsed.searchParams.get("token"));
    return {
      origin: parsed.origin,
      pathname: parsed.pathname,
      hasToken,
      callbackURL: callback,
    };
  } catch {
    return {
      origin: "invalid-url",
      pathname: "invalid-url",
      hasToken: false,
      callbackURL: null,
    };
  }
}

type SendEmailVerificationMessageInput = {
  to: string;
  verificationUrl: string;
};

export async function sendEmailVerificationMessage({
  to,
  verificationUrl,
}: SendEmailVerificationMessageInput) {
  console.info("[email-verification] send requested", {
    to: maskEmail(to),
    fromConfigured: Boolean(resendFromEmail),
    keyConfigured: Boolean(resendApiKey),
    verificationUrl: summarizeVerificationUrl(verificationUrl),
  });

  if (!resend) {
    console.error("Email verification skipped because RESEND_API_KEY is not configured.");
    return;
  }

  if (!resendFromEmail) {
    console.error("Email verification skipped because RESEND_FROM_EMAIL is not configured.");
    return;
  }

  const response = await resend.emails.send({
    from: resendFromEmail,
    to,
    subject: "Confirm your email address",
    react: ConfirmEmail({
      companyName: "Fortmont Cloud and IAM",
      url: verificationUrl,
    }),
    text: `Confirm your email address by opening this link: ${verificationUrl}`,
  });

  if (response.error) {
    console.error("[email-verification] resend rejected send", {
      to: maskEmail(to),
      error: response.error,
    });
    throw new Error(response.error.message || "Resend email send failed");
  }

  console.info("[email-verification] resend accepted send", {
    to: maskEmail(to),
    id: response.data?.id,
  });
}
