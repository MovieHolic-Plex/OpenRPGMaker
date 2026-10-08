// publish — 사람이 받은 컨셉(판정 해시 == 현재 그림)만 스토어에 올린다.
// --target staging(기본, 테일스케일 스테이징) | prod(운영, 명시해야 한다) | http://… (임시 로컬 서버).
// 토큰: OPRN_STORE_TOKEN, 없으면 storeCli 로그인 파일(~/.config/oprn-store/cli.json)의 그 주소 항목. 운영자 계정이어야 한다.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { GameConcept } from "../../../concepts/format";
import { acceptedCandidates, imagePath, paths, readJson, roundRobinByTag, sha256File, writeJsonAtomic } from "./data";

const TARGETS: Record<string, string> = { staging: "http://mdc-server:18320", prod: "https://store.openrpgmaker.com" };

function tokenFor(base: string): string {
  if (process.env.OPRN_STORE_TOKEN) return process.env.OPRN_STORE_TOKEN;
  const tokens = readJson<Record<string, string>>(join(homedir(), ".config", "oprn-store", "cli.json"), {});
  const token = tokens[base];
  if (!token) throw new Error(`${base} 토큰이 없습니다. OPRN_STORE_TOKEN 을 주거나 storeCli.ts login --base ${base} 로 먼저 로그인하세요.`);
  return token;
}

async function api(base: string, token: string, path: string, init: { method: string; json?: unknown; body?: Uint8Array; headers?: Record<string, string> }): Promise<unknown> {
  const response = await fetch(base + path, {
    method: init.method,
    headers: { authorization: `Bearer ${token}`, ...(init.json !== undefined ? { "content-type": "application/json" } : {}), ...init.headers },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body ? Buffer.from(init.body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method} ${path} → ${response.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export async function publish(argv: string[]): Promise<number> {
  const targetArg = argv.includes("--target") ? argv[argv.indexOf("--target") + 1]! : "staging";
  if (targetArg === "prod" && !argv.includes("--yes-prod")) throw new Error("운영 게시는 --target prod --yes-prod 를 함께 줘야 합니다.");
  const base = (TARGETS[targetArg] ?? targetArg).replace(/\/+$/, "");
  const token = tokenFor(base);
  const ordered = roundRobinByTag(acceptedCandidates());
  const published = readJson<Record<string, Record<string, string>>>(paths.published, {});
  const done = published[base] ?? {};
  let count = 0;
  for (const [index, concept] of ordered.entries()) {
    const full = imagePath(concept.slug, "full");
    const card = imagePath(concept.slug, "card");
    const fullSha = sha256File(full);
    const cardSha = sha256File(card);
    const body: GameConcept = { ...concept, thumb: { full: fullSha, card: cardSha } };
    // 그림·글·순서 어느 것이 바뀌어도 다시 올린다(전엔 큰 그림 해시만 봐서 글 수정이 조용히 빠졌다).
    const fingerprint = createHash("sha256").update(JSON.stringify({ body, rank: index })).digest("hex");
    if (done[concept.slug] === fingerprint && !argv.includes("--force")) continue;
    const { missing } = await api(base, token, "/api/v1/blobs/check", { method: "POST", json: { sha256s: [fullSha, cardSha] } }) as { missing: string[] };
    for (const [sha, path] of [[fullSha, full], [cardSha, card]] as const) {
      if (!missing.includes(sha)) continue;
      await api(base, token, "/api/v1/blobs", { method: "POST", body: readFileSync(path), headers: { "x-sha256": sha, "content-type": "application/octet-stream" } });
    }
    await api(base, token, "/api/v1/admin/concepts", { method: "POST", json: { concept: body, rank: index } });
    done[concept.slug] = fingerprint;
    published[base] = done;
    writeJsonAtomic(paths.published, published);
    count += 1;
  }
  console.log(`[publish] ${base} 에 ${count}개 올림 (받은 것 ${ordered.length}개)`);
  return 0;
}
