import { createServer } from "node:http";
import app, { origins } from "./app.js";
import Conversation from "./models/conversation.model.js";
import connectMongoDB from "./DB/ConnectMongodb.js";
import { setupSocket } from "./socket/socket.js";

const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || "0.0.0.0";
const server = createServer({ headersTimeout: 15000, requestTimeout: 60000, keepAliveTimeout: 5000 }, app);
setupSocket(server, origins);

try {
  await connectMongoDB();
  await Conversation.init();
  server.listen(port, host, () => console.log(`Server listening on ${host}:${port}`));
} catch (error) {
  console.error("Backend startup failed:", error.message);
  process.exitCode = 1;
}
