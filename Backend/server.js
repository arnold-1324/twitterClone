import { startRequestMetrics } from "./lib/requestMetrics.js";
import { createServer } from "node:http";
import app, { origins } from "./app.js";
import Conversation from "./models/conversation.model.js";
import ConversationPreference from "./models/conversationPreference.model.js";
import connectMongoDB from "./DB/ConnectMongodb.js";
import { setupSocket } from "./socket/socket.js";
import { startRedis } from "./Redis.js";
import { saveCallHistory } from "./lib/callHistory.js";
import { Story, StoryLike } from "./models/story.model.js";
import StoryActivity from "./models/storyActivity.model.js";
import MessageRead from "./models/messageRead.model.js";
import Note from "./models/note.model.js";
import { LibraryTrack, MusicEvent } from "./models/musicLibrary.model.js";
import PostView from "./models/postView.model.js";
import { startStoryCleanup } from "./lib/storyLifetime.js";

const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || "0.0.0.0";
const server = createServer({ headersTimeout: 15000, requestTimeout: 60000, keepAliveTimeout: 5000 }, app);
setupSocket(server, origins, saveCallHistory);

try {
  await connectMongoDB();
  await Promise.all([Conversation.init(), ConversationPreference.init(), MessageRead.init(), Story.init(), StoryLike.init(), StoryActivity.init(), Note.init(), PostView.init(), LibraryTrack.init(), MusicEvent.init()]);
  startRedis();
  void startRequestMetrics();
  startStoryCleanup();
  server.listen(port, host, () => console.log(`Server listening on ${host}:${port}`));
} catch (error) {
  console.error("Backend startup failed:", error.message);
  process.exitCode = 1;
}
