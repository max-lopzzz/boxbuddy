import { describe, it, expect, beforeAll } from "vitest";
import { createSessionToken, verifySessionToken } from "../../lib/session";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-do-not-use-in-prod";
});

describe("session token", () => {
  it("creates a token that verifies as valid", () => {
    const token = createSessionToken();
    expect(verifySessionToken(token)).toBe(true);
  });

  it("rejects a tampered token", () => {
    const token = createSessionToken();
    const tampered = token.slice(0, -2) + "xx";
    expect(verifySessionToken(tampered)).toBe(false);
  });

  it("rejects an empty or missing token", () => {
    expect(verifySessionToken(undefined)).toBe(false);
    expect(verifySessionToken(null)).toBe(false);
    expect(verifySessionToken("")).toBe(false);
  });

  it("rejects an expired token", () => {
    const realNow = Date.now;
    Date.now = () => realNow() - 200 * 24 * 60 * 60 * 1000;
    const oldToken = createSessionToken();
    Date.now = realNow;
    expect(verifySessionToken(oldToken)).toBe(false);
  });
});
