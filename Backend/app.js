import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { requestMetrics, recordBrowserTiming } from "./lib/requestMetrics.js";
import { protectRoute } from "./middleware/protectRoute.js";
import { limitIp, limitResource } from "./lib/rateLimits.js";
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
import StoryRoutes from "./routers/story.routers.js";
import NoteRoutes from "./routers/note.routers.js";
import MusicRoutes from "./routers/music.routers.js";
import AdminRoutes from "./routers/admin.routers.js";
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
    "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(self)",
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

app.use("/api", requestMetrics, limitIp, (req, res, next) => {
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

app.post("/api/telemetry", protectRoute, limitResource, (req, res) => {
  return recordBrowserTiming(req.body?.samples) ? res.sendStatus(204) : res.status(400).json({ error: "Invalid timing sample." });
});
app.use("/api/auth", AuthRoutes);
app.use("/api/users", UserRoutes);
app.use("/api/posts", PostRouters);
app.use("/api/notification", Notification);
app.use("/api/messages",MessageRoutes);
app.use("/api/groups", GroupRoutes);
app.use("/api/polls", PollRoutes);
app.use("/api/media", MediaRoutes);
app.use("/api/stories", StoryRoutes);
app.use("/api/notes", NoteRoutes);
app.use("/api/music", MusicRoutes);
app.use("/api/admin", AdminRoutes);
app.use("/api", (_req, res) => res.status(404).json({ error: "Route not found" }));

if (process.env.NODE_ENV === "production" && fs.existsSync(path.join(frontend, "index.html"))) {
  const refreshFiles = new Set(["index.html", "sw.js", "registerSW.js", "manifest.webmanifest", "manifest.json"]);
  const fingerprintedAsset = /-[A-Za-z0-9_-]{8}\.(?:m?js|css|woff2?|ttf|eot|wasm|png|jpe?g|webp|avif|svg|gif)$/i;
  const staticPath = /^\/(?:assets|call-models|licenses)(?:\/|$)|\.(?:m?js|css|json|webmanifest|map|ico|png|jpe?g|jfif|gif|webp|avif|svg|woff2?|ttf|eot|wasm|task|tflite|txt|xml|pdf|mp[34]|webm|ogg)$/i;
  app.use(express.static(frontend, {
    redirect: false,
    setHeaders(res, file) {
      const name = path.basename(file);
      if (refreshFiles.has(name)) res.setHeader("Cache-Control", "no-store");
      else if (path.dirname(file) === path.join(frontend, "assets") && fingerprintedAsset.test(name)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));
  app.get("*", (req, res) => {
    res.set("Cache-Control", "no-store");
    if (staticPath.test(req.path) || !req.accepts("html")) return res.status(404).type("text/plain").send("Not found");
    return res.sendFile(path.join(frontend, "index.html"));
  });
}

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.name === "CastError" || error.name === "ValidationError") return res.status(400).json({ error: "Invalid resource or data." });
  if (error.name === "MulterError") {
    const reasons = { LIMIT_UNEXPECTED_FILE: "Unexpected attachment field or too many files.",
      LIMIT_FILE_SIZE: "The file or combined attachments exceed the upload size limit.",
      LIMIT_FILE_COUNT: "The upload contains too many files.", LIMIT_FIELD_VALUE: "An upload field exceeds its size limit.",
      LIMIT_FIELD_COUNT: "The upload contains too many fields.", LIMIT_PART_COUNT: "The upload contains too many parts." };
    const status = error.code === "LIMIT_UNEXPECTED_FILE" ? 400 : 413;
    return res.status(status).json({ error: reasons[error.code] || "Upload metadata exceeds the allowed limits." });
  }
  if (error.status >= 400 && error.status <= 503) return res.status(error.status).json({ error: error.message });
  console.error("Request failed:", error.message);
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
