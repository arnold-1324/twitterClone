import { afterEach, beforeAll, expect, jest, test } from "@jest/globals";
import request from "supertest";
import User from "../models/user.model.js";

let app;
beforeAll(async () => {
  process.env.ENCRYPTION_SECRET ||= "test-encryption-key";
  ({ default: app } = await import("../app.js"));
});
afterEach(() => jest.restoreAllMocks());

test("rejects non-string credentials before querying MongoDB", async () => {
  const find = jest.spyOn(User, "findOne");
  await request(app).post("/api/auth/login").send({ username: { invalid: true }, password: "example" }).expect(400);
  expect(find).not.toHaveBeenCalled();
});

test("looks up password reset requests by normalized email", async () => {
  const find = jest.spyOn(User, "findOne").mockResolvedValue(null);
  await request(app).post("/api/auth/forgot-password").send({ Femail: " person@example.invalid " })
    .expect(200, { success: true, message: "If the email is registered, a reset link will be sent." });
  expect(find).toHaveBeenCalledWith({ email: "person@example.invalid" });
});
