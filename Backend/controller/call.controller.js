import { createHmac } from "node:crypto";

export function getCallConfig(req, res) {
  const iceServers = [];
  const stun = process.env.CALL_STUN_URL;
  const turn = process.env.CALL_TURN_URL;
  const secret = process.env.CALL_TURN_SECRET;
  if (stun?.startsWith("stun:")) iceServers.push({ urls: stun });
  if (turn && /^turns?:/.test(turn) && secret) {
    const username = `${Math.floor(Date.now() / 1000) + 3600}:${req.user._id}`;
    const credential = createHmac("sha1", secret).update(username).digest("base64");
    iceServers.push({ urls: turn, username, credential });
  }
  res.json({ iceServers });
}
