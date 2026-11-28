import express from "express";
import { getTracks, searchTracks, validTrackId } from "../lib/musicCatalog.js";
import { searchSpotify } from "../lib/spotifyCatalog.js";
import { limitResource } from "../lib/rateLimits.js";

import { authenticatedUser } from "../middleware/protectRoute.js";
import { searchLibrary, recordMusicSearch } from "../lib/hostedMusic.js";
import { musicCategories } from "../models/musicLibrary.model.js";
import { activeStickerPack } from "../lib/stickerPack.js";
import { streamLibraryArtwork, streamLibraryAudio, streamStickerArtwork } from "../lib/libraryAudio.js";
import MusicAdmin from "./musicAdmin.routers.js";

const router = express.Router();
router.use("/admin", MusicAdmin);
router.get("/audio/:id", limitResource, streamLibraryAudio);
router.get("/artwork/:file", limitResource, streamLibraryArtwork);
router.get("/stickers/:file", limitResource, streamStickerArtwork);
router.get("/stickers", limitResource, async (_req, res, next) => {
  try {
    return res.set("Cache-Control", "public, max-age=30").json(await activeStickerPack());
  } catch (error) { return next(error); }
});

router.get("/", limitResource, async (req, res, next) => {
  const { q, ids, source = "spotify", category, page = "1", sort = "suggested" } = req.query;
  const list = typeof ids === "string" ? ids.split(",") : null;
  if ((q !== undefined && (typeof q !== "string" || q.length > 150))
    || (ids !== undefined && (!list || list.length > 24 || !list.every(validTrackId)))
    || !["library", "spotify", "commons"].includes(source)
    || (category !== undefined && !musicCategories.includes(category))
    || !["suggested", "trending"].includes(sort)
    || typeof page !== "string" || !/^[1-9]\d?$/.test(page)) {
    return res.status(400).json({ error: "Choose a valid search or track list." });
  }
  try {
    if (list) return res.set("Cache-Control", "public, max-age=300").json(await getTracks(list));
    if (source === "library") {
      const user = req.cookies?.jwt ? await authenticatedUser(req) : null;
      const result = await searchLibrary({ query: q ?? "", category, page: Number(page), user: user?._id, sort });
      if (user && q && page === "1") recordMusicSearch(user._id, q, result.tracks);
      return res.set("Cache-Control", "private, no-store").json(result);
    }
    const result = source === "spotify" ? await searchSpotify(q) : { tracks: await searchTracks(q), scope: "catalog" };
    return res.set("Cache-Control", "public, max-age=120").json(result);
  } catch (error) {
    return next(error);
  }
});

export default router;
