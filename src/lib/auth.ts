import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import Database from "better-sqlite3";
import { jazzPlugin } from "jazz-tools/better-auth/auth/server";
import { Resend } from "resend";
import nodemailer from "nodemailer";

const resend = new Resend(process.env.RESEND_API_KEY);
const isProduction = process.env.NODE_ENV === "production";

// Create Ethereal test account for development (no signup required)
let devTransport: nodemailer.Transporter | null = null;
async function getDevTransport() {
  if (devTransport) return devTransport;

  const testAccount = await nodemailer.createTestAccount();
  devTransport = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  return devTransport;
}

export const auth = betterAuth({
  database: new Database("./auth.db"),
  plugins: [
    jazzPlugin(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Transform the API verification URL to our custom client-side verification page
        // Original: /api/auth/magic-link/verify?token=xxx&callbackURL=/
        // New: /auth/verify?token=xxx&callbackURL=/
        const parsedUrl = new URL(url);
        const token = parsedUrl.searchParams.get("token");
        const callbackURL = parsedUrl.searchParams.get("callbackURL") || "/";

        // Build the custom verification URL that handles verification client-side
        // This ensures the x-jazz-auth header is sent with the verification request
        const customUrl = `${parsedUrl.origin}/auth/verify?token=${token}&callbackURL=${encodeURIComponent(callbackURL)}`;

        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Sign in to Strudel LM</h1>
            <p>Click the button below to sign in to your account:</p>
            <a href="${customUrl}" style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">
              Sign In
            </a>
            <p style="color: #666; font-size: 14px;">
              If you didn't request this email, you can safely ignore it.
            </p>
            <p style="color: #666; font-size: 12px;">
              Or copy and paste this link: ${customUrl}
            </p>
          </div>
        `;

        if (isProduction) {
          // Use Resend in production
          await resend.emails.send({
            from: process.env.EMAIL_FROM || "Strudel LM <noreply@strudel.fm>",
            to: email,
            subject: "Sign in to Strudel LM",
            html: emailHtml,
          });
        } else {
          // Use Ethereal in development (no signup required)
          const transport = await getDevTransport();
          const info = await transport.sendMail({
            from: "Strudel LM <noreply@strudel.fm>",
            to: email,
            subject: "Sign in to Strudel LM",
            html: emailHtml,
          });

          // Log the preview URL where you can view the email
          console.log(`\n🔗 Magic link for ${email}:\n${customUrl}`);
          console.log(
            `📧 Preview email: ${nodemailer.getTestMessageUrl(info)}\n`,
          );
        }
      },
    }),
  ],
});
