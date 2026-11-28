import User from "../models/user.model.js";
import { readAccessSession } from "../lib/utils/generateToken.js";

export async function authenticatedUser(req) {
  const claims = await readAccessSession(req.cookies?.jwt);
  const user = claims && await User.findById(claims.userId).select("-password");
  return user && (user.sessionVersion ?? 0) === claims.sessionVersion ? user : null;
}

export async function protectRoute(req, res, next) {
  try {
    const user = await authenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}
