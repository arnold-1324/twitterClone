import { monitorMongo } from "../lib/requestMetrics.js";
import mongoose from "mongoose";

export default async function connectMongoDB() {
  const localUri = process.env.MONGODB_LOCAL_URL || "mongodb://127.0.0.1:27017/twitterClone";
  const uri = process.env.MONGODB_URL || localUri;
  const options = { monitorCommands: true, serverSelectionTimeoutMS: 5000, maxPoolSize: 30, waitQueueTimeoutMS: 5000, socketTimeoutMS: 15000 };
  if (process.env.MONGODB_PROXY_HOST && process.env.MONGODB_URL) {
    options.proxyHost = process.env.MONGODB_PROXY_HOST;
    options.proxyPort = Number(process.env.MONGODB_PROXY_PORT || 9050);
  }

  try {
    await mongoose.connect(uri, options);
  } catch (error) {
    if (process.env.NODE_ENV === "production" || uri === localUri) throw error;
    console.warn("Primary MongoDB connection failed; trying the local development database.");
    await mongoose.connect(localUri, options.proxyHost ? { ...options, proxyHost: undefined, proxyPort: undefined } : options);
  }
  monitorMongo(mongoose.connection.getClient());
  console.log("MongoDB connected");
}
