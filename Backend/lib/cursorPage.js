import mongoose from "mongoose";

export function beforeCursor(raw, direction = -1) {
  if (raw === undefined) return {};
  const match = typeof raw === "string" && /^(\d{1,15})\.([a-f0-9]{24})$/.exec(raw);
  if (!match) throw Object.assign(new Error("Invalid page cursor."), { status: 400 });
  const time = new Date(Number(match[1]));
  if (!Number.isFinite(time.getTime())) throw Object.assign(new Error("Invalid page cursor."), { status: 400 });
  const id = new mongoose.Types.ObjectId(match[2]);
  const comparison = direction === 1 ? "$gt" : "$lt";
  return { $or: [{ createdAt: { [comparison]: time } }, { createdAt: time, _id: { [comparison]: id } }] };
}

export function sendCursor(res, rows, pageSize) {
  if (rows.length > pageSize) {
    const last = rows[pageSize - 1];
    res.set("X-Next-Cursor", `${new Date(last.createdAt).getTime()}.${last._id}`);
  }
  return rows.slice(0, pageSize);
}
