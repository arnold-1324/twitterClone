import { describe, expect, jest, test } from "@jest/globals";
import request from "supertest";
import { createRateStore } from "../lib/rateLimits.js";
import { createReadCache } from "../lib/readCache.js";
import { beforeCursor, sendCursor } from "../lib/cursorPage.js";

test("rate budgets isolate resources, reject new keys when full and renew after expiration", () => {
  let time = 0;
  const take = createRateStore({ maxEntries: 2, now: () => time });
  expect(take("post:user", 1, 2000).allowed).toBe(true);
  expect(take("post:user", 1, 2000).allowed).toBe(false);
  expect(take("search:user", 1, 2000).allowed).toBe(true);
  expect(take("third", 1, 2000).allowed).toBe(false);
  time = 2001;
  expect(take("third", 1, 2000).allowed).toBe(true);
});

test("cache coalesces concurrent reads and invalidation preserves a newer value", async () => {
  const cache = createReadCache();
  let finish;
  const load = jest.fn(() => new Promise((resolve) => { finish = resolve; }));
  const first = cache.read("key", load);
  const simultaneous = cache.read("key", load);
  await Promise.resolve();
  expect(load).toHaveBeenCalledTimes(1);
  cache.invalidate("key");
  expect(await cache.read("key", () => "fresh")).toBe("fresh");
  finish("old");
  expect(await first).toBe("old");
  expect(await simultaneous).toBe("old");
  expect(await cache.read("key", load)).toBe("fresh");
});

test("invalid cursors return a client error and equal timestamps use the ID tie breaker", () => {
  expect(() => beforeCursor("invalid")).toThrow("Invalid page cursor");
  const id = "0123456789abcdef01234567";
  const row = { _id: id, createdAt: new Date(1000) };
  const res = { set: jest.fn() };
  expect(sendCursor(res, [row, row], 1)).toEqual([row]);
  expect(res.set).toHaveBeenCalledWith("X-Next-Cursor", `1000.${id}`);
  const filter = beforeCursor(`1000.${id}`);
  expect(filter.$or[1].createdAt.getTime()).toBe(1000);
  expect(String(filter.$or[1]._id.$lt)).toBe(id);
});

describe("HTTP protections", () => {
  let app;
  test("write requests from untrusted browser origins are rejected", async () => {
    process.env.ENCRYPTION_SECRET ||= "test-encryption-key";
    ({ default: app } = await import("../app.js"));
    await request(app).post("/api/auth/logout").set("Origin", "https://cross-origin.invalid").expect(403);
  });

  test("login is throttled and shares no quota with logout", async () => {
    process.env.ENCRYPTION_SECRET ||= "test-encryption-key";
    ({ default: app } = await import("../app.js"));
    for (let index = 0; index < 10; index++) {
      await request(app).post("/api/auth/login").send({ username: 0 }).expect(400);
    }
    const result = await request(app).post("/api/auth/login").send({ username: 0 }).expect(429);
    expect(Number(result.headers["retry-after"])).toBeGreaterThan(0);
    await request(app).post("/api/auth/logout").expect(200);
  });
});

test("new encrypted messages reject alterations and old ciphertext stays readable", async () => {
  const { createHash, createCipheriv } = await import("node:crypto");
  process.env.ENCRYPTION_SECRET ||= "test-encryption-key";
  const { encrypt, decrypt } = await import("../lib/utils/Msg_encryption/encrypt.js");
  const encrypted = encrypt("private text");
  expect(decrypt(encrypted)).toBe("private text");
  const altered = (encrypted.encryptedData.startsWith("00") ? "01" : "00") + encrypted.encryptedData.slice(2);
  expect(() => decrypt({ ...encrypted, encryptedData: altered })).toThrow();
  const iv = Buffer.alloc(16, 1);
  const legacyKey = Buffer.from(createHash("sha256").update(process.env.ENCRYPTION_SECRET).digest("base64").slice(0, 32));
  const cipher = createCipheriv(process.env.ENCRYPTION_ALGO || "aes-256-cbc", legacyKey, iv);
  const encryptedData = Buffer.concat([cipher.update("old message"), cipher.final()]).toString("hex");
  expect(decrypt({ iv: iv.toString("hex"), encryptedData })).toBe("old message");
});
