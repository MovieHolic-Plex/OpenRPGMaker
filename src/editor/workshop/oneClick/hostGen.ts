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
  /** char-gen mode "photo": 사진(data URL, JPG·PNG·WEBP). 사진은 호스트 작업 폴더에만 있고 묶음에는 들어가지 않는다. */
  readonly photo?: string;
}

/** 사진으로 만든 후보 하나(호스트 state "picking") — 사람이 고른다. */
export interface HostPhotoCandidate {
  readonly rank: number;
  readonly head: string;
  readonly body: string;
  readonly fit: number;
  /** 조립 오류 검사 통과(검사를 안 했으면 null) */
  readonly passed: boolean | null;
  readonly errors: number | null;
  /** 눈 순위(1 = 가장 낫다) */
  readonly eyes: number | null;
  /** 네 방향 걷기 GIF(data URL) */
  readonly gif: string;
}

export interface HostGenStatus {
  readonly ok: boolean;
  readonly state: "running" | "picking" | "done" | "failed" | "cancelled" | "missing";
  readonly stage?: string;
  readonly engine?: string;
  readonly progress?: number;
  readonly elapsedMs?: number;
  /** 호스트가 어림한 전체 시간(실측 기준) — 남은 시간 표시용 */
  readonly expectMs?: number;
  readonly attempts?: number;
  readonly detail?: string | null;
  readonly reviewing?: boolean;
  readonly error?: string | null;
  readonly picked?: string | null;
  readonly review?: string | null;
  readonly made?: number | null;
  readonly asked?: number | null;
  readonly pack?: { readonly manifest: StorePackManifest; readonly blobs: Readonly<Record<string, string>> };
  readonly photoCandidates?: readonly HostPhotoCandidate[];
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

/** 사진 후보 중 하나를 고른다 — 호스트가 그 칩만 묶고 작업은 다시 running → done. */
export async function pickHostGen(jobId: string, rank: number, title: string): Promise<void> {
  const result = await call<{ ok: boolean; error?: string }>("POST", "/workshop/gen/pick", { jobId, rank, title });
  if (!result.ok) throw new Error(result.error ?? "후보를 고르지 못했어요.");
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

// ── 3/4 관문(object-gate) — scripts/lib/workshopGate.mjs 의 브라우저 쪽 ─────────────────────────────

/** 호스트 관문 결과. final = 영수증 PASS, 또는 REFER 를 적대 검사가 통과시킨 것만 pass. */
export interface HostGateResult {
  readonly final: "pass" | "fail";
  readonly verdict: "pass" | "refer" | "fail";
  readonly reasons: readonly string[];
  /** 다시 그릴 때 줄 고칠 점(판정자 근거 글 포함). 통과면 빈 글. */
  readonly fix?: string;
  readonly pixelSha256: string;
  readonly profileHash: string;
  readonly kind: string;
  readonly refer: { readonly verdict: "pass" | "fail"; readonly sure: boolean; readonly reasons: readonly string[]; readonly judge: string } | null;
  readonly calls: number;
  readonly ms: number;
}

/** 관문을 이 호스트에서 돌릴 수 없을 때(설치에 판정기·bun·claude 가 없음) — 부르는 쪽은 그 후보를 넣지 않는다. */
export class HostGateUnavailable extends Error {}

/**
 * 후보 PNG 하나를 호스트 관문에 넣고 끝날 때까지 기다린다(보통 20초~2분). signal 로 그만두면 호스트 작업도 끈다.
 */
export async function runHostGate(input: { readonly png: string; readonly kind: string; readonly name: string; readonly label?: string; readonly chipset?: string }, signal?: AbortSignal): Promise<HostGateResult> {
  let started: { ok: boolean; jobId?: string; error?: string; unavailable?: boolean };
  try {
    started = await call("POST", "/workshop/gate", input);
  } catch (error) {
    throw new HostGateUnavailable(error instanceof Error ? error.message : String(error));
  }
  if (!started.ok || !started.jobId) {
    if (started.unavailable) throw new HostGateUnavailable(started.error ?? "그림 확인기를 쓸 수 없어요.");
    throw new Error(started.error ?? "그림 확인을 시작하지 못했어요.");
  }
  const jobId = started.jobId;
  const onAbort = () => { void call("POST", "/workshop/gate/cancel", { jobId }).catch(() => undefined); };
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    for (let wait = 1500; ; wait = Math.min(4000, wait + 500)) {
      if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
      await new Promise((done) => setTimeout(done, wait));
      if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
      const status = await call<{ ok: boolean; state: string; result?: HostGateResult; error?: string | null }>("GET", `/workshop/gate?jobId=${encodeURIComponent(jobId)}`);
      if (status.state === "running") continue;
      if (status.state === "done" && status.result) return status.result;
      throw new Error(status.error ?? "그림 확인이 끝나지 않았어요.");
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}
