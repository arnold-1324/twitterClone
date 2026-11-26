import { recordAccountChanges } from "./accountHistory.controller.js";
import { getIO, getRecipientRoom } from "../socket/socket.js";
import { presentProfile } from "../lib/utils/presentProfile.js";
import { peopleCache } from "../lib/readCache.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { clearSessionCookies, generateTokenAndCookies, revokeSession, rotateRefresh } from "../lib/utils/generateToken.js";
import { sendResetPasswordEmail, sendVerificationEmail, sendWelcomeEmail, sendPasswordResetSuccessEmail } from "../lib/utils/Mailtrap/email.js";

async function accountData(user) {
  const { password, verificationToken, verificationTokenExpiresAt, resetPasswordToken, sessionVersion,
    resetPasswordExpires, ...account } = user.toObject();
  return presentProfile(account);
}

export async function signUp(req, res) {
  try {
    const fullName = typeof req.body.fullName === "string" ? req.body.fullName.trim() : "";
    const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const { password, confirmPassword } = req.body;
    if (!fullName || fullName.length > 80 || !/^[a-zA-Z0-9_]{3,24}$/.test(username)
      || ["auth", "chat", "settings", "notifications", "update", "api", "search", "create", "reels", "discover", "saved", "activity"].includes(username.toLowerCase())
      || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || typeof password !== "string" || password.length < 6 || Buffer.byteLength(password) > 72
      || password !== confirmPassword) {
      return res.status(400).json({ error: "Enter a name, a valid email, a username of 3–24 letters, digits or underscores, and matching passwords of at least six characters." });
    }

    const localSignup = process.env.NODE_ENV === "development" && process.env.LOCAL_SIGNUP === "true";
    if (!localSignup && !process.env.TOKEN) {
      return res.status(503).json({ error: "Email delivery is unavailable." });
    }
    const verificationCode = localSignup ? undefined : String(crypto.randomInt(100000, 1000000));
    const user = await User.create({
      fullName, username, email,
      password: await bcrypt.hash(password, 10),
      isVerified: localSignup,
      verificationToken: verificationCode,
      verificationTokenExpiresAt: localSignup ? undefined : new Date(Date.now() + 15 * 60 * 1000),
    });
    if (localSignup) {
      await generateTokenAndCookies(user, res);
    } else {
      try {
        await sendVerificationEmail(email, verificationCode);
      } catch {
        await User.deleteOne({ _id: user._id, isVerified: false });
        return res.status(502).json({ error: "Verification email could not be sent. Please try again." });
      }
    }
    peopleCache.clear();
    return res.status(201).json({
      success: true,
      verificationRequired: !localSignup,
      ...(localSignup && { user: await accountData(user) }),
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "Username or email is already in use." });
    console.error("Could not create account:", error.message);
    return res.status(500).json({ error: "Could not create account." });
  }
}

export const Login= async(req,res)=>{
  
try{
  const { username, password } = req.body;
  if (typeof username !== "string" || typeof password !== "string" || Buffer.byteLength(password) > 72) {
    return res.status(400).json({ error: "A username and valid password are required." });
  }
  const user = await User.findOne({ username: username.trim() });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  if (user.isVerified === false && user.verificationToken) {
    return res.status(403).json({ error: "Verify your email to sign in." });
  }

    await generateTokenAndCookies(user,res);

    res.status(201).json({
      sucess:true,
      message: "login  sucessfully",
      user: await accountData(user),
    })

}catch(error){
    console.log("Error in login controller",error.message);
    res.status(500).json({error:"Internal Server Error"});
}
}

export async function Logout(req, res, next) {
  try {
    const id = await revokeSession(req.cookies.jwt, req.cookies.refresh);
    if (id) getIO()?.in(`session:${id}`).disconnectSockets(true);
    clearSessionCookies(res);
    return res.json({ message: "Logged out successfully" });
  } catch (error) {
    return next(error);
  }
}

export async function refreshSession(req, res, next) {
  try {
    const result = await rotateRefresh(req.cookies.refresh, res);
    if (result.ok) return res.sendStatus(204);
    if (result.revoked) getIO()?.in(`session:${result.revoked}`).disconnectSockets(true);
    clearSessionCookies(res);
    return res.status(401).json({ error: "Sign in again to continue" });
  } catch (error) {
    return next(error);
  }
}

export async function verifyEmail(req, res) {
  try {
    const { email, verificationCode } = req.body;
    if (typeof email !== "string" || typeof verificationCode !== "string" || !/^\d{6}$/.test(verificationCode)) {
      return res.status(400).json({ error: "A valid email and verification code are required." });
    }
    const user = await User.findOneAndUpdate({
      email: email.trim().toLowerCase(), verificationToken: verificationCode,
      verificationTokenExpiresAt: { $gt: new Date() }, isVerified: false,
    }, {
      $set: { isVerified: true },
      $unset: { verificationToken: "", verificationTokenExpiresAt: "" },
    }, { new: true });
    if (!user) return res.status(400).json({ error: "Invalid or expired verification code." });

    await generateTokenAndCookies(user, res);
    void sendWelcomeEmail(user.email, user.username).catch(() => {});
    return res.json({ success: true, user: await accountData(user) });
  } catch (error) {
    console.error("Could not verify email:", error.message);
    return res.status(500).json({ error: "Could not verify email." });
  }
}

export async function forgotPassword(req, res) {
  const email = typeof req.body.Femail === "string" ? req.body.Femail.trim().toLowerCase() : "";
  const response = { success: true, message: "If the email is registered, a reset link will be sent." };
  if (!email) return res.json(response);
  try {
    const user = await User.findOne({ email });
    if (user && process.env.TOKEN) {
      const token = crypto.randomBytes(20).toString("hex");
      user.resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      await sendResetPasswordEmail(user.email, token).catch(() => {});
    }
    return res.json(response);
  } catch (error) {
    console.error("Could not request password reset:", error.message);
    return res.status(500).json({ error: "Could not request password reset." });
  }
}

export const ResetPassword = async (req, res) => {
  const { resetToken } = req.params;
  const { password, confirmPassword } = req.body;

  try {
    
    if (typeof password !== "string" || password.length < 6
      || Buffer.byteLength(password) > 72 || password !== confirmPassword
      || !/^[a-f0-9]{40}$/.test(resetToken)) {
      return res.status(400).json({ success: false, error: "Invalid reset token or password." });
    }
    const hash = crypto.createHash("sha256").update(resetToken).digest("hex");
    const user = await User.findOneAndUpdate({
      resetPasswordToken: { $in: [hash, resetToken] },
      resetPasswordExpires: { $gt: new Date() },
    }, {
      $set: { password: await bcrypt.hash(password, 10) },
      $inc: { sessionVersion: 1 },
      $unset: { resetPasswordToken: "", resetPasswordExpires: "" },
    });
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    }
    await recordAccountChanges(user._id, [{ kind: "password" }]);
    getIO()?.in(getRecipientRoom(user._id)).disconnectSockets(true);
    await sendPasswordResetSuccessEmail(user.email).catch(() => {});

    return res.status(200).json({ success: true, message: "Password has been reset successfully" });

  } catch (error) {

    console.log("Error in ResetPassword controller", error.message);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};



