// tests/api/items.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "node:child_process";
import net from "node:net";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseClient } from "../../lib/supabase";

const hasEnv = Boolean(
  process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error("Could not determine a free port"));
      }
    });
    server.on("error", reject);
  });
}

async function waitForServer(baseUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/login`);
      if (res.status < 500) return;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms`);
}

// Creates a real Supabase Auth session for the given credentials and returns a
// `Cookie:` header string usable against our own Next.js server — without needing
// a real browser. Uses the same @supabase/ssr package the app itself uses, with a
// cookie adapter that just captures what would be set instead of writing anywhere.
async function loginAndGetCookieHeader(email: string, password: string): Promise<string> {
  const capturedCookies: string[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            capturedCookies.push(`${name}=${value}`);
          });
        },
      },
    }
  );
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return capturedCookies.join("; ");
}

describe.skipIf(!hasEnv)("items API routes (integration)", () => {
  let serverProcess: ChildProcess;
  let baseUrl: string;
  let sessionCookie: string;
  let otherSessionCookie: string;
  let testUserId: string;
  let otherTestUserId: string;
  const createdIds: string[] = [];

  const testEmail = `test-items-api-${Date.now()}@example.com`;
  const testPassword = "test-password-not-real-12345";
  const otherTestEmail = `test-items-api-other-${Date.now()}@example.com`;

  beforeAll(async () => {
    const admin = getSupabaseClient();

    const { data: user, error: userError } = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (userError || !user.user) throw userError ?? new Error("Failed to create test user");
    testUserId = user.user.id;

    const { data: otherUser, error: otherUserError } = await admin.auth.admin.createUser({
      email: otherTestEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (otherUserError || !otherUser.user) {
      throw otherUserError ?? new Error("Failed to create second test user");
    }
    otherTestUserId = otherUser.user.id;

    const port = await getFreePort();
    baseUrl = `http://localhost:${port}`;
    serverProcess = spawn("node_modules/.bin/next", ["dev", "-p", String(port)], {
      cwd: process.cwd(),
      stdio: "pipe",
      detached: true,
    });
    await waitForServer(baseUrl, 60_000);

    sessionCookie = await loginAndGetCookieHeader(testEmail, testPassword);
    otherSessionCookie = await loginAndGetCookieHeader(otherTestEmail, testPassword);
  }, 90_000);

  afterAll(async () => {
    for (const id of createdIds) {
      await fetch(`${baseUrl}/api/items/${id}`, {
        method: "DELETE",
        headers: { Cookie: sessionCookie },
      }).catch(() => {});
    }
    if (serverProcess && serverProcess.pid) {
      try {
        process.kill(-serverProcess.pid, "SIGTERM");
      } catch {
        serverProcess.kill("SIGTERM");
      }
    }
    const admin = getSupabaseClient();
    if (testUserId) await admin.auth.admin.deleteUser(testUserId).catch(() => {});
    if (otherTestUserId) await admin.auth.admin.deleteUser(otherTestUserId).catch(() => {});
  });

  it("rejects unauthenticated requests to the items collection", async () => {
    const res = await fetch(`${baseUrl}/api/items`);
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated item creation", async () => {
    const res = await fetch(`${baseUrl}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Should Not Be Created" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects creating an item with no name", async () => {
    const res = await fetch(`${baseUrl}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ quantity: 5 }),
    });
    expect(res.status).toBe(400);
  });

  it("creates an item and returns it with a generated qr_code", async () => {
    const res = await fetch(`${baseUrl}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        name: "API Test Widget",
        sku: "ATW-1",
        quantity: 10,
        reorder_at: 2,
        location: "Test Shelf",
        category: "Test Category",
        notes: "created by tests/api/items.test.ts",
        cost: 1.5,
        price: 4.99,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.name).toBe("API Test Widget");
    expect(typeof body.item.qr_code).toBe("string");
    expect(body.item.qr_code.startsWith("bb_")).toBe(true);
    createdIds.push(body.item.id);
  });

  it("fetches the created item by id", async () => {
    const id = createdIds[0];
    const res = await fetch(`${baseUrl}/api/items/${id}`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.id).toBe(id);
  });

  it("a different account cannot see this item", async () => {
    const id = createdIds[0];
    const res = await fetch(`${baseUrl}/api/items/${id}`, {
      headers: { Cookie: otherSessionCookie },
    });
    expect(res.status).toBe(404);
  });

  it("a different account's item list does not include this item", async () => {
    const res = await fetch(`${baseUrl}/api/items?search=API%20Test%20Widget`, {
      headers: { Cookie: otherSessionCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.some((i: any) => i.id === createdIds[0])).toBe(false);
  });

  it("updates the item", async () => {
    const id = createdIds[0];
    const res = await fetch(`${baseUrl}/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        name: "API Test Widget",
        sku: "ATW-1",
        quantity: 3,
        reorder_at: 2,
        location: "Test Shelf",
        category: "Test Category",
        notes: null,
        cost: 1.5,
        price: 4.99,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.quantity).toBe(3);
  });

  it("a different account cannot update this item", async () => {
    const id = createdIds[0];
    const res = await fetch(`${baseUrl}/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: otherSessionCookie },
      body: JSON.stringify({
        name: "Hijacked",
        sku: null,
        quantity: 1,
        reorder_at: null,
        location: null,
        category: null,
        notes: null,
        cost: null,
        price: null,
      }),
    });
    expect(res.status).toBe(404);

    const verifyRes = await fetch(`${baseUrl}/api/items/${id}`, {
      headers: { Cookie: sessionCookie },
    });
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json();
    expect(verifyBody.item.name).toBe("API Test Widget");
    expect(verifyBody.item.quantity).toBe(3);
  });

  it("a different account's DELETE attempt does not remove this item", async () => {
    const id = createdIds[0];
    // The DELETE route does not distinguish "not found" from "not owned" —
    // deleteItem() scopes its delete to `.eq("owner_id", ownerId)`, so a
    // cross-account delete simply matches zero rows and the route still
    // unconditionally responds 200 { ok: true }. The real assertion is that
    // the item survives, not the status code.
    const res = await fetch(`${baseUrl}/api/items/${id}`, {
      method: "DELETE",
      headers: { Cookie: otherSessionCookie },
    });
    expect(res.status).toBe(200);

    const verifyRes = await fetch(`${baseUrl}/api/items/${id}`, {
      headers: { Cookie: sessionCookie },
    });
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json();
    expect(verifyBody.item.id).toBe(id);
  });

  it("a different account cannot upload a photo to this item", async () => {
    const id = createdIds[0];
    const formData = new FormData();
    // The route's ownership check (getItem(userId, params.id)) runs before the
    // multipart body is parsed at all, so the file's byte content is irrelevant
    // here — the request should be rejected before any image processing.
    const imageBlob = new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" });
    formData.append("photo", imageBlob, "test.png");

    const res = await fetch(`${baseUrl}/api/items/${id}/photo`, {
      method: "POST",
      headers: { Cookie: otherSessionCookie },
      body: formData,
    });
    expect(res.status).toBe(404);
  });

  it("a different account cannot fetch this item's photo", async () => {
    const id = createdIds[0];
    const res = await fetch(`${baseUrl}/api/items/${id}/photo`, {
      headers: { Cookie: otherSessionCookie },
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when updating a nonexistent item", async () => {
    const res = await fetch(`${baseUrl}/api/items/00000000-0000-0000-0000-000000000000`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        name: "Nope",
        sku: null,
        quantity: 1,
        reorder_at: null,
        location: null,
        category: null,
        notes: null,
        cost: null,
        price: null,
      }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 409 when creating a duplicate qr_code for the same account", async () => {
    const existing = await fetch(`${baseUrl}/api/items/${createdIds[0]}`, {
      headers: { Cookie: sessionCookie },
    }).then((r) => r.json());

    const res = await fetch(`${baseUrl}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        name: "Duplicate Code Item",
        sku: null,
        quantity: 1,
        reorder_at: null,
        location: null,
        category: null,
        notes: null,
        cost: null,
        price: null,
        qr_code: existing.item.qr_code,
      }),
    });
    expect(res.status).toBe(409);
  });

  it("a different account CAN use the same qr_code without conflict", async () => {
    const existing = await fetch(`${baseUrl}/api/items/${createdIds[0]}`, {
      headers: { Cookie: sessionCookie },
    }).then((r) => r.json());

    const res = await fetch(`${baseUrl}/api/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: otherSessionCookie },
      body: JSON.stringify({
        name: "Other Account's Item",
        sku: null,
        quantity: 1,
        reorder_at: null,
        location: null,
        category: null,
        notes: null,
        cost: null,
        price: null,
        qr_code: existing.item.qr_code,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    // Clean up immediately since this item belongs to the second account, not
    // the one `afterAll`'s createdIds loop cleans up.
    await fetch(`${baseUrl}/api/items/${body.item.id}`, {
      method: "DELETE",
      headers: { Cookie: otherSessionCookie },
    });
  });

  it("looks up the item by its qr_code", async () => {
    const existing = await fetch(`${baseUrl}/api/items/${createdIds[0]}`, {
      headers: { Cookie: sessionCookie },
    }).then((r) => r.json());

    const res = await fetch(
      `${baseUrl}/api/items/lookup-by-code?code=${encodeURIComponent(existing.item.qr_code)}`,
      { headers: { Cookie: sessionCookie } }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.id).toBe(createdIds[0]);
  });

  it("returns null for an unrecognized code", async () => {
    const res = await fetch(`${baseUrl}/api/items/lookup-by-code?code=bb_doesnotexist12`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item).toBeNull();
  });

  it("returns matching autocomplete suggestions for location", async () => {
    const res = await fetch(`${baseUrl}/api/items/autocomplete?field=location&q=Test`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.values).toContain("Test Shelf");
  });

  it("a different account's autocomplete does not see this location", async () => {
    const res = await fetch(`${baseUrl}/api/items/autocomplete?field=location&q=Test`, {
      headers: { Cookie: otherSessionCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.values).not.toContain("Test Shelf");
  });

  it("rejects an invalid autocomplete field", async () => {
    const res = await fetch(`${baseUrl}/api/items/autocomplete?field=bogus&q=Test`, {
      headers: { Cookie: sessionCookie },
    });
    expect(res.status).toBe(400);
  });

  it("deletes the item and it is then not found", async () => {
    const id = createdIds[0];
    const deleteRes = await fetch(`${baseUrl}/api/items/${id}`, {
      method: "DELETE",
      headers: { Cookie: sessionCookie },
    });
    expect(deleteRes.status).toBe(200);

    const getRes = await fetch(`${baseUrl}/api/items/${id}`, {
      headers: { Cookie: sessionCookie },
    });
    expect(getRes.status).toBe(404);

    createdIds.length = 0;
  }, 20_000);
});
