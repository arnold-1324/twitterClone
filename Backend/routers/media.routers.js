import express from "express";
import { basename, dirname } from "node:path";
import Group from "../models/group.model.js";
import Message from "../models/message.model.js";
import { findMedia } from "../lib/mediaStore.js";
import { protectRoute } from "../middleware/protectRoute.js";
import { belongsToConversation } from "../socket/socket.js";

const router = express.Router();
const missing = (res) => res.status(404).json({ error: "Media not found." });

router.get("/:id/:asset?", async (req, res, next) => {
  try {
    const media = await findMedia(req.params.id, req.params.asset);
    if (!media) return missing(res);
    if (!media.conversationId && !media.groupId) {
      res.set("Cache-Control", "public, max-age=300");
      return send(media, res, next);
    }
    return protectRoute(req, res, async (error) => {
      if (error) return next(error);
      try {
        const userId = req.user._id;
        const allowed = media.groupId
          ? await Group.exists({ _id: media.groupId, members: userId, blocked: { $ne: userId } })
          : await belongsToConversation(media.conversationId, userId)
            && await Message.exists({ _id: media.messageId, conversationId: media.conversationId, deletedFor: { $ne: userId } });
        if (!allowed) return missing(res);
        return send(media, res, next);
      } catch (error) {
        return next(error);
      }
    });
  } catch (error) {
    return next(error);
  }
});

function send(media, res, next) {
  if (media.download) res.attachment(media.download);
  res.set("Content-Type", media.contentType);
  return res.sendFile(basename(media.path), { root: dirname(media.path), cacheControl: false }, (error) => {
    if (!error) return;
    if (error.status === 404 && !res.headersSent) {
      res.set("Cache-Control", "no-store");
      res.removeHeader("Content-Disposition");
      return missing(res);
    }
    return next(error);
  });
}

export default router;
