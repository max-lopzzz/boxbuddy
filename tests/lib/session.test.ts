import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken } from "../../lib/session";

const KEY_MATERIAL = "test-secret-do-not-use-in-prod";

describe("session token", () => {
  it("creates a token that verifies as valid", () => {
    const token = createSessionToken(KEY_MATERIAL);
    expect(verifySessionToken(token, KEY_MATERIAL)).toBe(true);
  });

  it("rejects a tampered token", () => {
    const token = createSessionToken(KEY_MATERIAL);
    const tampered = token.slice(0, -2) + "xx";
    expect(verifySessionToken(tampered, KEY_MATERIAL)).toBe(false);
  });

  it("rejects an empty or missing token", () => {
    expect(verifySessionToken(undefined, KEY_MATERIAL)).toBe(false);
    expect(verifySessionToken(null, KEY_MATERIAL)).toBe(false);
    expect(verifySessionToken("", KEY_MATERIAL)).toBe(false);
  });

  it("rejects an expired token", () => {
    const realNow = Date.now;
    Date.now = () => realNow() - 200 * 24 * 60 * 60 * 1000;
    const oldToken = createSessionToken(KEY_MATERIAL);
    Date.now = realNow;
    expect(verifySessionToken(oldToken, KEY_MATERIAL)).toBe(false);
  });

  it("rejects a token verified under a different key material (e.g. after a passcode change)", () => {
    const token = createSessionToken("key-a");
    expect(verifySessionToken(token, "key-b")).toBe(false);
  });
});
