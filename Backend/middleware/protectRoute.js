import User from "../models/user.model.js";
import { readAccessSession } from "../lib/utils/generateToken.js";

export async function protectRoute(req, res, next) {
  try {
    const claims = await readAccessSession(req.cookies.jwt);
    const user = claims && await User.findById(claims.userId).select("-password");
    if (!user || (user.sessionVersion ?? 0) !== claims.sessionVersion) {
      return res.status(401).json({ error: "Authentication required" });
    }
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}
