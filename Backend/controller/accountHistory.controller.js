import AccountHistory, { historyKinds } from "../models/accountHistory.model.js";
import User from "../models/user.model.js";
import { beforeCursor, sendCursor } from "../lib/cursorPage.js";

export async function recordAccountChanges(user, changes) {
  if (!changes.length) return;
  try {
    await AccountHistory.insertMany(changes.map(({ kind, action, profileValue }) => ({
      user, kind, action,
      ...(["bio", "name", "username"].includes(kind) && profileValue && { profileValue }),
    })));
  } catch (error) {
    console.error("Could not record account history:", error.name);
  }
}

export async function getAccountHistory(req, res, next) {
  try {
    const { kind, sort = "newest" } = req.query;
    if (kind !== undefined && !historyKinds.includes(kind)) return res.status(400).json({ error: "Unknown history filter." });
    if (sort !== "newest" && sort !== "oldest") return res.status(400).json({ error: "Unknown history order." });
    const direction = sort === "oldest" ? 1 : -1;
    const records = await AccountHistory.find({
      user: req.user._id, ...(kind === undefined ? {} : { kind }), ...beforeCursor(req.query.before, direction),
    }).select("kind action profileValue createdAt").sort({ createdAt: direction, _id: direction }).limit(26).maxTimeMS(3000).lean();
    res.set("Cache-Control", "private, no-store");
    return res.json({ entries: sendCursor(res, records, 25), joinedAt: req.user.createdAt });
  } catch (error) {
    return next(error);
  }
}

// Each write is scoped to the signed-in user, and repeated settings requests
// only produce one entry when the value actually changes.
export async function setProfilePrivacy(req, res, next) {
  const { hideBio } = req.body;
  if (typeof hideBio !== "boolean") return res.status(400).json({ error: "Choose bio visibility." });
  try {
    const filter = hideBio ? { $ne: true } : true;
    const result = await User.updateOne({ _id: req.user._id, hideBio: filter }, { $set: { hideBio } });
    if (result.modifiedCount) await recordAccountChanges(req.user._id, [{ kind: "privacy", action: hideBio ? "hidden" : "visible" }]);
    return res.json({ hideBio });
  } catch (error) {
    return next(error);
  }
}
