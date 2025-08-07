import { mailtrapclient, sender } from "./mail.config.js";
import {
  PASSWORD_RESET_REQUEST_TEMPLATE,
  VERIFICATION_EMAIL_TEMPLATE,
  WELCOME_EMAIL_TEMPLATE,
  PASSWORD_RESET_SUCCESS_TEMPLATE
} from "./emailTemplate.js";

// Use FRONTEND_URL to construct links in emails
const FRONTEND_URL = process.env.FRONTEND_URL || "https://frontend-gamma-opal-34.vercel.app";

export const sendVerificationEmail = async (email, verificationToken) => {
  const recipient = [{ email }];
  // Link to verify email on frontend
  const verificationURL = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;

  try {
    const htmlContent = VERIFICATION_EMAIL_TEMPLATE.replace("{verificationURL}", verificationURL);
    const response = await mailtrapclient.send({
      from: sender,
      to: recipient,
      subject: "Verify your email",
      html: htmlContent,
      category: "Email Verification",
    });
    console.log("Verification email sent successfully", response);
  } catch (error) {
    console.error("Error sending verification email", error);
    throw new Error(`Error sending verification email: ${error}`);
  }
};

export const sendWelcomeEmail = async (email, username) => {
  const recipient = [{ email }];
  // Direct user to their dashboard or profile page
  const dashboardURL = `${FRONTEND_URL}/users/${encodeURIComponent(username)}`;

  try {
    let emailContent = WELCOME_EMAIL_TEMPLATE
      .replace(/{username}/g, username)
      .replace(/{dashboardURL}/g, dashboardURL);

    const response = await mailtrapclient.send({
      from: sender,
      to: recipient,
      subject: "Welcome to Our Community!",
      html: emailContent,
      category: "Welcome Email",
    });
    console.log("Welcome email sent successfully", response);
  } catch (error) {
    console.error("Error sending welcome email", error);
    throw new Error(`Error sending welcome email: ${error}`);
  }
};

export const sendResetPasswordEmail = async (email, resetToken) => {
  const recipient = [{ email }];
  // Link to reset password on frontend
  const resetPasswordURL = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

  try {
    const htmlContent = PASSWORD_RESET_REQUEST_TEMPLATE.replace("{resetURL}", resetPasswordURL);
    const response = await mailtrapclient.send({
      from: sender,
      to: recipient,
      subject: "Reset your password",
      html: htmlContent,
      category: "Password Reset",
    });
    console.log("Password reset email sent successfully", response);
    return response;
  } catch (error) {
    console.error("Error sending password reset email", error);
    throw new Error(`Error sending password reset email: ${error}`);
  }
};

export const sendPasswordResetSuccessEmail = async (email) => {
  const recipient = [{ email }];

  try {
    const response = await mailtrapclient.send({
      from: sender,
      to: recipient,
      subject: "Password Reset Successful",
      html: PASSWORD_RESET_SUCCESS_TEMPLATE,
      category: "Password Reset",
    });
    console.log("Password reset success email sent successfully", response);
  } catch (error) {
    console.error("Error sending password reset success email", error);
    throw new Error(`Error sending password reset success email: ${error}`);
  }
};
