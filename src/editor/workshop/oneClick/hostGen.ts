// src/editor/workshop/oneClick/hostGen.ts
/**
 * 캐릭터(char-gen)·지형(tile-gen)을 호스트(동반 서비스)에서 돌린다 — scripts/lib/workshopGen.mjs 의 브라우저 쪽.
 * 모델은 사용자 컴퓨터의 에이전트 CLI(조수 엔진 설정에서 고른 것, 없으면 깔린 첫 CLI). 키는 어디에도 없다.
 */
import type { StorePackManifest } from "@/assetStore/format";

export type HostGenerator = "char-gen" | "tile-gen";

export interface HostGenStart {
  readonly generator: HostGenerator;
  readonly text: string;
  readonly count?: number;
  readonly mode?: string;
  readonly tileset?: { readonly png: string; readonly refs: readonly (readonly [number, number])[] };
}

export interface HostGenStatus {
  readonly ok: boolean;
  readonly state: "running" | "done" | "failed" | "cancelled" | "missing";
  readonly stage?: string;
  readonly engine?: string;
  readonly progress?: number;
  readonly elapsedMs?: number;
  readonly attempts?: number;
  readonly detail?: string | null;
  readonly reviewing?: boolean;
  readonly error?: string | null;
  readonly picked?: string | null;
  readonly review?: string | null;
  readonly made?: number | null;
  readonly asked?: number | null;
  readonly pack?: { readonly manifest: StorePackManifest; readonly blobs: Readonly<Record<string, string>> };
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const [{ fetchCompanion }, { companionRequestBaseUrl }] = await Promise.all([import("@/ai/companionConnection"), import("@/ai/llmClient")]);
  const response = await fetchCompanion(`${companionRequestBaseUrl().replace(/\/$/, "")}${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let payload: unknown;
  try { payload = JSON.parse(text); } catch { throw new Error(`호스트 응답을 읽지 못했어요(HTTP ${response.status})`); }
  if (!response.ok && (payload as { error?: string })?.error) throw new Error((payload as { error: string }).error);
  return payload as T;
}

/** 사용자가 조수 엔진으로 고른 로컬 CLI(있으면) — 같은 CLI·모델로 그린다. */
async function engineChoice(): Promise<{ cli?: string; model?: string }> {
  const { loadAssistantEngine } = await import("@/ai/localCliEngine");
  const engine = loadAssistantEngine();
  if (!engine) return {};
  return { cli: engine.cli, ...(engine.deepModel ?? engine.routineModel ? { model: engine.deepModel ?? engine.routineModel } : {}) };
}

export async function startHostGen(input: HostGenStart): Promise<string> {
  const result = await call<{ ok: boolean; jobId?: string; error?: string }>("POST", "/workshop/gen", { ...input, ...(await engineChoice()) });
  if (!result.ok || !result.jobId) throw new Error(result.error ?? "호스트가 작업을 받지 못했어요.");
  return result.jobId;
}

export function hostGenStatus(jobId: string): Promise<HostGenStatus> {
  return call<HostGenStatus>("GET", `/workshop/gen?jobId=${encodeURIComponent(jobId)}`);
}

export function cancelHostGen(jobId: string): Promise<unknown> {
  return call("POST", "/workshop/gen/cancel", { jobId });
}

/** 응답의 묶음(base64 blob) → 가져오기와 같은 LocalPack. sha256 을 다시 잰다(genPackImport.readLocalPack 와 같은 규칙). */
export async function packFromHost(pack: NonNullable<HostGenStatus["pack"]>, folder: string): Promise<import("../genPackImport").LocalPack> {
  const { STORE_PACK_SCHEMA, validateManifest } = await import("@/assetStore/format");
  if ((pack.manifest as { schema?: unknown }).schema !== STORE_PACK_SCHEMA) throw new Error("생성기 묶음 형식이 달라요.");
  const checked = validateManifest(pack.manifest);
  if (!checked.ok) throw new Error(`묶음이 올바르지 않아요: ${checked.errors.slice(0, 3).join(" / ")}`);
  const blobs = new Map<string, Uint8Array>();
  for (const [sha, b64] of Object.entries(pack.blobs)) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (digest !== sha) throw new Error("묶음 파일이 깨졌어요. 다시 만들어 주세요.");
    blobs.set(sha, bytes);
  }
  return { manifest: checked.value, blobs, folder };
}
