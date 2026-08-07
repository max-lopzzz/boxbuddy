// tests/helpers/api-server.ts
import { spawn, ChildProcess } from "node:child_process";
import net from "node:net";
import { createServerClient } from "@supabase/ssr";

export function getFreePort(): Promise<number> {
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

export async function spawnNextServer(port: number): Promise<ChildProcess> {
  const baseUrl = `http://localhost:${port}`;
  const serverProcess = spawn("node_modules/.bin/next", ["dev", "-p", String(port)], {
    cwd: process.cwd(),
    stdio: "pipe",
    detached: true,
  });
  await waitForServer(baseUrl, 60_000);
  return serverProcess;
}

export function stopServer(serverProcess: ChildProcess): void {
  if (serverProcess && serverProcess.pid) {
    try {
      process.kill(-serverProcess.pid, "SIGTERM");
    } catch {
      serverProcess.kill("SIGTERM");
    }
  }
}

// Creates a real Supabase Auth session for the given credentials and returns a
// `Cookie:` header string usable against our own Next.js server — without needing
// a real browser. Uses the same @supabase/ssr package the app itself uses, with a
// cookie adapter that just captures what would be set instead of writing anywhere.
export async function loginAndGetCookieHeader(email: string, password: string): Promise<string> {
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
