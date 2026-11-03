import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function unusedPort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  assert(address && typeof address === "object");
  const port = address.port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function startApp(port, databasePath) {
  const logs = [];
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "production",
        LIFE_ENGLISH_DB_PATH: databasePath,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next.js exited before becoming ready.\n${logs.join("")}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return { child, baseUrl, logs };
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  child.kill("SIGKILL");
  throw new Error(`Next.js did not become ready.\n${logs.join("")}`);
}

async function stopApp(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

test("renders the app and restores learning data after a server restart", async () => {
  const testDirectory = mkdtempSync(join(tmpdir(), "life-english-test-"));
  const databasePath = join(testDirectory, "life-english.sqlite");
  const port = await unusedPort();
  let running = await startApp(port, databasePath);

  try {
    const pageResponse = await fetch(running.baseUrl, {
      headers: { accept: "text/html" },
    });
    assert.equal(pageResponse.status, 200);
    assert.match(pageResponse.headers.get("content-type") ?? "", /^text\/html\b/i);
    assert.match(await pageResponse.text(), developmentPreviewMeta);

    const name = `测试账号-${process.pid}-${Date.now()}`;
    const password = "test-password-2026";
    const registerResponse = await fetch(`${running.baseUrl}/api/account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        password,
        level: "intermediate",
      }),
    });
    assert.equal(registerResponse.status, 201);
    const registered = await registerResponse.json();
    assert.equal(registered.created, true);
    assert.equal(typeof registered.token, "string");

    const saveResponse = await fetch(`${running.baseUrl}/api/account`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${registered.token}`,
      },
      body: JSON.stringify({
        initialData: {
          ...registered.data,
          xp: 57,
          routeDays: { foundation: 0, intermediate: 3, advanced: 0 },
          savedPhrases: ["Could I have a room with a quieter view?"],
        },
      }),
    });
    assert.equal(saveResponse.status, 200);

    await stopApp(running.child);
    running = await startApp(port, databasePath);

    const loginResponse = await fetch(`${running.baseUrl}/api/account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    });
    assert.equal(loginResponse.status, 200);
    const loggedIn = await loginResponse.json();
    assert.equal(loggedIn.created, false);
    assert.equal(loggedIn.data.xp, 57);
    assert.equal(loggedIn.data.routeDays.intermediate, 3);
    assert.deepEqual(
      loggedIn.data.savedPhrases,
      ["Could I have a room with a quieter view?"],
    );

    const wrongPasswordResponse = await fetch(`${running.baseUrl}/api/account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password: "incorrect-password" }),
    });
    assert.equal(wrongPasswordResponse.status, 401);
  } finally {
    await stopApp(running.child);
    rmSync(testDirectory, { recursive: true, force: true });
  }
});
