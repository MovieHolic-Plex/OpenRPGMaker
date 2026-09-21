#!/usr/bin/env bun
// Read an existing OMP CLI OAuth credential without starting a second login.
// This file is intentionally a tiny Bun-only boundary: @oh-my-pi/pi-ai stores
// credentials in SQLite through bun:sqlite, while the editor companion's auth
// owner remains a Node process.

import { existsSync } from "node:fs";
import { getAgentDbPath } from "@oh-my-pi/pi-utils/dirs";
import { SqliteAuthCredentialStore } from "@oh-my-pi/pi-ai/auth-storage";

const provider = String(process.argv[2] ?? "").trim();
const supported = new Set(["google-antigravity", "openai-codex"]);

function write(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

if (!supported.has(provider)) {
  write({ available: true, credentials: null });
  process.exit(0);
}

const dbPath = getAgentDbPath();
if (!existsSync(dbPath)) {
  write({ available: true, credentials: null });
  process.exit(0);
}

try {
  const store = await SqliteAuthCredentialStore.open(dbPath);
  try {
    const credentials = store.getOAuth(provider);
    write({ available: true, credentials: credentials ?? null });
  } finally {
    store.close();
  }
} catch {
  // The Node caller treats an unavailable probe as a reason to keep its own
  // credential cache. Never print database errors or credential material.
  write({ available: false });
}
