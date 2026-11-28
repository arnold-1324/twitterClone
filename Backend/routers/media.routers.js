import express from "express";
import { basename, dirname } from "node:path";
import Group from "../models/group.model.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { sendBucketMedia } from "../lib/bucketMedia.js";
import { findMedia } from "../lib/mediaStore.js";
import { protectRoute } from "../middleware/protectRoute.js";
import { belongsToConversation } from "../socket/socket.js";
import { findVisibleStory } from "../lib/storyLifetime.js";

const router = express.Router();
const missing = (res) => res.status(404).json({ error: "Media not found." });

router.get("/bucket/:id/:asset?", (req, res, next) => serve(req, res, next, true));
router.get("/:id/:asset?", (req, res, next) => serve(req, res, next, false));

async function serve(req, res, next, inBucket) {
  try {
    const media = await findMedia(req.params.id, req.params.asset, inBucket);
    if (!media) return missing(res);
    if (!media.conversationId && !media.groupId && !media.storyId) {
      res.set("Cache-Control", "public, max-age=300");
      return send(media, req, res, next);
    }
    return protectRoute(req, res, async (error) => {
      if (error) return next(error);
      try {
        const userId = req.user._id;
        let allowed;
        if (media.storyId) {
          const story = await findVisibleStory(media.storyId);
          allowed = story?.mediaKey === media.key;
          if (allowed) {
            const seconds = Math.max(0, Math.min(20, Math.floor((story.expiresAt - Date.now()) / 1000)));
            res.vary("Cookie");
            res.set("Cache-Control", `private, max-age=${seconds}, must-revalidate`);
          }
        } else if (media.groupId) {
          allowed = await Group.exists({ _id: media.groupId, members: userId, blocked: { $ne: userId } });
        } else if (await belongsToConversation(media.conversationId, userId)) {
          allowed = media.chatBackground
            ? await Conversation.exists({ _id: media.conversationId, customBackgroundKey: media.key })
            : await Message.exists({ _id: media.messageId, conversationId: media.conversationId, deletedFor: { $ne: userId } });
        }
        if (!allowed) return missing(res);
        return send(media, req, res, next);
      } catch (error) {
        return next(error);
      }
    });
  } catch (error) {
    return next(error);
  }
}

function send(media, req, res, next) {
  if (media.download) res.attachment(media.download);
  res.set("Content-Type", media.contentType);
  if (media.bucketId) return sendBucketMedia(media, req, res, next);
  return res.sendFile(basename(media.path), { root: dirname(media.path), cacheControl: false }, (error) => {
    if (!error) return;
    if (!res.headersSent) res.set("Cache-Control", "no-store");
    if (error.status === 404 && !res.headersSent) {
      res.removeHeader("Content-Disposition");
      return missing(res);
    }
    return next(error);
  });
}

export default router;
