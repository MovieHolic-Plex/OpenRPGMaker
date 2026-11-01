#!/usr/bin/env bun
// Read an existing OMP CLI credential without starting a second login.
// This file is intentionally a tiny Bun-only boundary: @oh-my-pi/pi-ai stores
// credentials in SQLite through bun:sqlite, while the editor companion's auth
// owner remains a Node process.
//
// 2026-11-02: 예전에는 지원 제공자를 `google-antigravity`·`openai-codex` 둘로 못 박았다.
// 그래서 사용자가 OMP(pi) 에서 이미 로그인해 둔 제공자(zai·devin 등)가 있어도 OPRN 은
// 그 사실을 볼 수 없었고, 화면에는 "고를 수 있는 제공자 둘" 만 남았다.
// 이제 **저장소에 있는 그대로** 읽는다 — 어떤 제공자를 화면에 올릴지는 레지스트리
// (src/ai/ohMyPiProviders.ts)가 정하고, 이 프로브는 "그 제공자의 자격이 이 PC 에 있나" 만 답한다.
//
// 출력 계약(호출자 scripts/lib/aiAuthRuntime.ts 의 probeOmpAuth 가 읽는다):
//   { available: true, credentials: {...} | null }   정상 조회(없으면 null)
//   { available: false }                              OMP DB 를 못 읽음(호출자는 자기 캐시를 유지)
//   { available: true, kind: "apiKey", credentials: null }  API 키 자격만 있음(구독 로그인 아님)

import { existsSync } from "node:fs";
import { getAgentDbPath } from "@oh-my-pi/pi-utils/dirs";
import { SqliteAuthCredentialStore } from "@oh-my-pi/pi-ai/auth-storage";

const provider = String(process.argv[2] ?? "").trim();

function write(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

if (!provider) {
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
    // OAuth 자격이 있으면 그대로 넘긴다(기존 경로).
    const oauth = store.getOAuth(provider);
    if (oauth) {
      write({ available: true, credentials: oauth });
      process.exit(0);
    }
    // API 키 자격만 있는 제공자(zai·devin 처럼 "로그인"이 곧 키 발급인 경우)는
    // OAuth 자격이 아니다 — 호출자가 종류를 구분할 수 있게 사실만 알린다.
    // 비밀은 절대 싣지 않는다(자격 본문·키 값 모두 브라우저로 나가지 않는 계약).
    const storedKey = typeof store.getApiKey === "function" ? store.getApiKey(provider) : undefined;
    if (storedKey) {
      write({ available: true, credentials: null, kind: "apiKey" });
      process.exit(0);
    }
    write({ available: true, credentials: null });
  } finally {
    store.close();
  }
} catch {
  // The Node caller treats an unavailable probe as a reason to keep its own
  // credential cache. Never print database errors or credential material.
  write({ available: false });
}
