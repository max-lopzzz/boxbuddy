// tests/api/items.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "node:child_process";
import net from "node:net";

const hasEnv = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.APP_PASSCODE
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
      // Next dev returns a normal 200 once the page has compiled. Treat any
      // non-5xx response as "server is up" (a compiling page can 404 briefly).
      if (res.status < 500) return;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms`);
}

describe.skipIf(!hasEnv)("items API routes (integration)", () => {
  let serverProcess: ChildProcess;
  let baseUrl: string;
  let sessionCookie: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const port = await getFreePort();
    baseUrl = `http://localhost:${port}`;
    serverProcess = spawn("node_modules/.bin/next", ["dev", "-p", String(port)], {
      cwd: process.cwd(),
      stdio: "pipe",
      detached: true, // own process group, so we can kill Next's spawned workers too
    });
    await waitForServer(baseUrl, 60_000);

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: process.env.APP_PASSCODE }),
    });
    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/bb_session=([^;]+)/);
    if (!match) throw new Error("Login did not return a session cookie");
    sessionCookie = `bb_session=${match[1]}`;
  }, 90_000);

  afterAll(async () => {
    // Clean up any items this suite created, even if a test failed partway through.
    for (const id of createdIds) {
      await fetch(`${baseUrl}/api/items/${id}`, {
        method: "DELETE",
        headers: { Cookie: sessionCookie },
      }).catch(() => {});
    }
    if (serverProcess && serverProcess.pid) {
      // `next dev` spawns its own child processes (webpack workers, etc.).
      // Killing just the parent PID can leave those orphaned, so kill the
      // whole process group we detached it into above.
      try {
        process.kill(-serverProcess.pid, "SIGTERM");
      } catch {
        serverProcess.kill("SIGTERM");
      }
    }
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

  it("returns 409 when creating a duplicate qr_code", async () => {
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

    // Already deleted — don't try to clean it up again in afterAll.
    createdIds.length = 0;
  }, 20_000);
});
