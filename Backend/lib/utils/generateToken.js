import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Session from "../../models/session.model.js";
import User from "../../models/user.model.js";

const accessMs = 15 * 60 * 1000;
const refreshMs = 30 * 24 * 60 * 60 * 1000;
const hash = (token) => createHash("sha256").update(token).digest("hex");
const options = () => ({ httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV !== "development" });

function issueRefresh(id, generation, expiry) {
  return jwt.sign({ sid: String(id), generation, exp: Math.floor(expiry.getTime() / 1000) }, process.env.JWT_SECRET, {
    algorithm: "HS256", audience: "dayline-refresh", jwtid: randomBytes(24).toString("hex"),
  });
}

function readRefresh(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"], audience: "dayline-refresh" });
    return mongoose.isObjectIdOrHexString(payload.sid) ? payload : null;
  } catch {
    return null;
  }
}

function setCookies(userId, session, refresh, res) {
  const access = jwt.sign({ userId: String(userId), sessionVersion: session.version, sid: String(session._id) }, process.env.JWT_SECRET, {
    algorithm: "HS256", audience: "dayline-access", expiresIn: accessMs / 1000,
  });
  res.cookie("jwt", access, { ...options(), path: "/", maxAge: accessMs });
  res.cookie("refresh", refresh, { ...options(), path: "/api/auth", maxAge: Math.max(0, session.expiresAt.getTime() - Date.now()) });
}

export function clearSessionCookies(res) {
  res.clearCookie("jwt", { ...options(), path: "/" });
  res.clearCookie("refresh", { ...options(), path: "/api/auth" });
}

export async function generateTokenAndCookies(user, res) {
  const id = new mongoose.Types.ObjectId();
  const expiresAt = new Date(Date.now() + refreshMs);
  const token = issueRefresh(id, 0, expiresAt);
  const session = await Session.create({ _id: id, user: user._id, version: user.sessionVersion ?? 0, digest: hash(token), expiresAt });
  setCookies(user._id, session, token, res);
}

export async function readAccessSession(token) {
  let claims;
  try {
    claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"], audience: "dayline-access" });
  } catch {
    return null;
  }
  if (!mongoose.isObjectIdOrHexString(claims.userId) || !mongoose.isObjectIdOrHexString(claims.sid)) return null;
  const session = await Session.exists({
    _id: claims.sid, user: claims.userId, version: claims.sessionVersion,
    revokedAt: null, expiresAt: { $gt: new Date() },
  });
  return session ? claims : null;
}

export async function rotateRefresh(token, res) {
  const claims = readRefresh(token);
  if (!claims) return { ok: false };
  const filter = { _id: claims.sid, revokedAt: null, expiresAt: { $gt: new Date() } };
  const session = await Session.findOne(filter).select("user version expiresAt generation");
  if (!session) return { ok: false };
  const user = await User.findById(session.user).select("sessionVersion");
  if (!user || (user.sessionVersion ?? 0) !== session.version) return { ok: false };

  const replacement = issueRefresh(session._id, claims.generation + 1, session.expiresAt);
  const updated = await Session.findOneAndUpdate({ ...filter, generation: claims.generation, digest: hash(token) }, {
    $set: { digest: hash(replacement) }, $inc: { generation: 1 },
  }, { new: true });
  if (!updated) {
    // A signed older token identifies a real member of this token family.
    const reused = await Session.updateOne({ ...filter, generation: { $gt: claims.generation } }, {
      $set: { revokedAt: new Date() },
    });
    return { ok: false, revoked: reused.modifiedCount ? claims.sid : undefined };
  }
  setCookies(user._id, updated, replacement, res);
  return { ok: true };
}

export async function revokeSession(access, refresh) {
  const claims = readRefresh(refresh) ?? await readAccessSession(access);
  if (!claims) return null;
  await Session.updateOne({ _id: claims.sid, revokedAt: null }, { $set: { revokedAt: new Date() } });
  return claims.sid;
}
