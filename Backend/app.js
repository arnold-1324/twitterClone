import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { limitIp } from "./lib/rateLimits.js";
import compression from "compression";
import cors from "cors";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import xss from "xss-clean";
import path from "node:path";

import AuthRoutes from "./routers/auth.routers.js";
import UserRoutes from "./routers/user.routers.js";
import PostRouters from "./routers/post.routers.js";
import Notification from "./routers/notification.routers.js";
import MessageRoutes from "./routers/message.routers.js";
import GroupRoutes from "./routers/group.routers.js";
import PollRoutes from "./routers/poll.routers.js";
import MediaRoutes from "./routers/media.routers.js";
dotenv.config();

const app = express();
app.disable("x-powered-by");
const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
if (Number.isSafeInteger(proxyHops) && proxyHops > 0) app.set("trust proxy", proxyHops);
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(self)",
  });
  next();
});
app.use(compression());

const frontend = fileURLToPath(new URL("../Frontend/dist/", import.meta.url));
export const origins = [
  "https://twitterclonefrontend-alpha.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);
app.use(cors({ origin: origins, credentials: true, exposedHeaders: ["X-Next-Cursor", "Retry-After"] }));

app.get("/health", limitIp, (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.set("Cache-Control", "no-store").status(ready ? 200 : 503).json({ ready });
});

app.use("/api", limitIp, (req, res, next) => {
  res.set("Cache-Control", "no-store");
  const origin = req.get("Origin");
  const sameHost = origin === `https://${req.get("Host")}` || origin === `http://${req.get("Host")}`;
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && (
    (origin && !sameHost && !origins.includes(origin))
    || (!origin && req.get("Sec-Fetch-Site") === "cross-site")
  )) return res.status(403).json({ error: "Request origin is not allowed." });
  next();
});
app.use(cookieParser());
app.use(express.json({ limit: '128kb' }));
app.use(express.urlencoded({ limit: '128kb', extended: false, parameterLimit: 40 }));

app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

app.use("/api/auth", AuthRoutes);
app.use("/api/users", UserRoutes);
app.use("/api/posts", PostRouters);
app.use("/api/notification", Notification);
app.use("/api/messages",MessageRoutes);
app.use("/api/groups", GroupRoutes);
app.use("/api/polls", PollRoutes);
app.use("/api/media", MediaRoutes);
app.use("/api", (_req, res) => res.status(404).json({ error: "Route not found" }));

if (process.env.NODE_ENV === "production" && fs.existsSync(path.join(frontend, "index.html"))) {
  app.use(express.static(frontend));
  app.get("*", (_req, res) => res.sendFile(path.join(frontend, "index.html")));
}

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.name === "CastError" || error.name === "ValidationError") return res.status(400).json({ error: "Invalid resource or data." });
  if (error.name === "MulterError") {
    const status = error.code === "LIMIT_UNEXPECTED_FILE" ? 400 : 413;
    return res.status(status).json({ error: status === 400 ? "Unexpected attachment field." : "Upload exceeds the allowed limits." });
  }
  if (error.status >= 400 && error.status <= 503) return res.status(error.status).json({ error: error.message });
  console.error("Request failed:", error.message);
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
