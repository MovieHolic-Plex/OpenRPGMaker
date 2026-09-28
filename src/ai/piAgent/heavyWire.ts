// 브라우저 → 호스트 Pi 실행 요청의 무거운 키 해시 전송.
//
// 요청마다 프로젝트 전체를 싣던 것을, 타일셋·DB·에셋은 SHA-256 해시로만 보내고 호스트가 처음 보는 내용만 받게 바꾼다
// (호스트 캐시: scripts/lib/piRunRelay.mjs). 2026-09-27 실측: 새 몬스터 수집 프로젝트 첫 요청 151MB 중 150MB 가 이 셋이었다.
// 브라우저는 보낸 해시를 기억한다 — 같은 호스트에 같은 내용이면 두 번째 요청부터 몸통이 수 MB 로 준다.
// 호스트가 캐시를 잃었으면(재시작·축출) 409 heavy-missing 을 돌려주고, 그 해시의 내용만 다시 보낸다.

import type { Project } from "@/project/types";
import { stringifyAssets, stringifySharedDictionary } from "@/project/io/sharedDictionaryJson";
import { jsonContentDigest, trustSharedProjectEntries, withTrustedSharedEntries } from "@/project/persistence/core/contentDigest";

export const PI_HEAVY_PROJECT_KEYS = ["tilesets", "database", "assets"] as const;
export type PiHeavyProjectKey = (typeof PI_HEAVY_PROJECT_KEYS)[number];

/** 이 크기보다 작은 키는 해시로 바꾸지 않는다 — 해시 계산·왕복이 몸통보다 비싸다. */
const MIN_HEAVY_BYTES = 256 * 1024;

export interface HeavyWireBody {
  readonly [key: string]: unknown;
  readonly project: Project;
  readonly heavy?: Partial<Record<PiHeavyProjectKey, string>>;
  readonly heavyBlobs?: Record<string, string>;
}

export interface HeavyWirePlan {
  /** 무거운 키를 비운 요청 몸통의 뼈대. */
  readonly body: HeavyWireBody;
  /** 해시 → JSON. 호스트가 모른다고 하면 여기서 꺼내 보낸다. */
  readonly blobs: ReadonlyMap<string, string>;
}

/** 호스트(오리진)별로 이미 보낸 해시. 호스트가 잃었으면 409 로 알려 준다 — 이 표는 추측일 뿐 권위가 아니다. */
const sentByOrigin = new Map<string, Set<string>>();

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 요청을 해시 전송으로 바꾼다. crypto.subtle 이 없는 환경(비보안 컨텍스트)이면 그대로 둔다 — 예전 전송과 같다.
 * 같은 객체를 두 번 해시하지 않게 WeakMap 에 기억한다(체크포인트가 무거운 키 객체를 그대로 물려준다).
 */
const hashMemo = new WeakMap<object, { hash: string; json: string }>();
/**
 * 키마다 마지막으로 만든 글·해시와 그 내용 요약. 사전 객체는 적용마다 새로 만들어져(스토어 복제) 위 기억이 빗나가도,
 * 내용 요약(`jsonContentDigest`: 노드 기억 — 공유 항목은 대조도 건너뛴다)이 같으면 글도 해시도 다시 만들지 않는다.
 * 요약이 같다 ⇔ 키 순서만 다를 수 있는 같은 내용이다. 스토어 사전은 키 순서를 지키므로 글도 같다 — 다르면 호스트는 해시로
 * 캐시를 찾을 뿐이라, 순서만 다른 옛 글을 되살려도 내용은 같다.
 * 키마다 하나만 쥔다 — 글이 수십 MB 라 여러 개를 쥐면 메모리가 커진다(계획의 blobs 가 어차피 같은 글을 쥔다).
 */
const lastByKey = new Map<PiHeavyProjectKey, { readonly digest: string; readonly json: string; readonly hash: string }>();

/**
 * 무거운 키의 JSON. 타일셋·업로드 자산은 항목 글을 기억해 조립한다 — 글자까지 `JSON.stringify` 와 같다(sharedDictionaryJson).
 * 왜(2026-09-28 실측, 149MB 새 프로젝트): 턴마다 사전 객체가 새것이라 hashMemo 가 빗나가 타일셋·자산 전체를 다시 직렬화했다(약 1s).
 */
function heavyJson(key: PiHeavyProjectKey, value: object): string {
  if (key === "tilesets") return stringifySharedDictionary(value) ?? "null";
  if (key === "assets") return stringifyAssets(value) ?? "null";
  return JSON.stringify(value);
}

async function heavyEntry(key: PiHeavyProjectKey, value: object): Promise<{ hash: string; json: string } | null> {
  // 타일셋·업로드 자산 항목은 제자리에서 고치지 않는다(projectClone 계약) — 공유 항목을 믿고 요약한다.
  const digest = withTrustedSharedEntries(() => {
    const token = jsonContentDigest(value);
    if (key === "tilesets") trustSharedProjectEntries({ tilesets: value });
    if (key === "assets") trustSharedProjectEntries({ assets: value });
    return token;
  });
  const last = lastByKey.get(key);
  if (digest !== undefined && last && last.digest === digest) return { hash: last.hash, json: last.json };
  const json = heavyJson(key, value);
  if (json.length < MIN_HEAVY_BYTES) return null;
  const hash = await sha256Hex(json);
  if (digest !== undefined) lastByKey.set(key, { digest, json, hash });
  return { hash, json };
}

export async function planHeavyWire<T extends { project: Project }>(request: T): Promise<HeavyWirePlan | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const project = { ...request.project } as Record<string, unknown>;
  const heavy: Partial<Record<PiHeavyProjectKey, string>> = {};
  const blobs = new Map<string, string>();
  for (const key of PI_HEAVY_PROJECT_KEYS) {
    const value = project[key];
    if (!value || typeof value !== "object") continue;
    let entry = hashMemo.get(value);
    if (!entry) {
      const made = await heavyEntry(key, value);
      if (!made) continue;
      entry = made;
      hashMemo.set(value, entry);
    }
    heavy[key] = entry.hash;
    blobs.set(entry.hash, entry.json);
    project[key] = key === "database" ? {} : {};
  }
  if (Object.keys(heavy).length === 0) return null;
  return { body: { ...request, project: project as unknown as Project, heavy }, blobs };
}

/** 이 호스트가 아직 모를 법한 해시의 내용만 싣는다. */
export function withHeavyBlobs(plan: HeavyWirePlan, origin: string, force?: readonly string[]): HeavyWireBody {
  const sent = sentByOrigin.get(origin) ?? new Set<string>();
  const heavyBlobs: Record<string, string> = {};
  for (const [hash, json] of plan.blobs) {
    if (force ? force.includes(hash) : !sent.has(hash)) heavyBlobs[hash] = json;
  }
  return Object.keys(heavyBlobs).length ? { ...plan.body, heavyBlobs } : plan.body;
}

/** 호스트가 받아 준 해시를 기억한다. */
export function markHeavySent(origin: string, plan: HeavyWirePlan): void {
  const sent = sentByOrigin.get(origin) ?? new Set<string>();
  for (const hash of plan.blobs.keys()) sent.add(hash);
  sentByOrigin.set(origin, sent);
}

/** 호스트가 잃었다고 한 해시를 잊는다. */
export function forgetHeavySent(origin: string, hashes: readonly string[]): void {
  const sent = sentByOrigin.get(origin);
  if (!sent) return;
  for (const hash of hashes) sent.delete(hash);
}

/** 테스트 전용. */
export function resetHeavyWireForTests(): void {
  sentByOrigin.clear();
  lastByKey.clear();
}
