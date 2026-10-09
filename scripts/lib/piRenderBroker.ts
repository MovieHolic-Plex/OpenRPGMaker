import { randomUUID } from "node:crypto";
import type { Project } from "../../src/project/types";
import { slimProjectForWire, type PiAgentEvent } from "../../src/ai/piAgent/protocol";
import type { CinematicStillResult } from "../../src/editor/openingImageGeneration";

type Reply = { renderId?: unknown; png?: unknown; issue?: unknown; still?: unknown };
const pending = new Map<string, (reply: Reply) => void>();
const generations = new Set<string>();
// 끊긴 소켓 뒤 재전달이 이미 받은 응답을 409 로 되돌리지 않게 최근 id 를 기억한다(piCheckpointBroker 와 같다).
const resolved = new Set<string>();
/** One-use, unguessable capability. Invalid payloads cannot consume another pending reply. */
export function resolvePiRender(reply: Reply): boolean {
  if (!reply || typeof reply.renderId !== "string") return false;
  const resolve = pending.get(reply.renderId);
  if (!resolve) return resolved.has(reply.renderId);
  if (generations.has(reply.renderId)) {
    if (typeof reply.issue !== "string" && !validStill(reply.still)) return false;
  } else if (typeof reply.issue !== "string") {
    if (typeof reply.png !== "string" || reply.png.length > 4_000_000 || !/^iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(reply.png)) return false;
    const bytes = Buffer.from(reply.png as string, "base64");
    if (bytes.length < 24 || bytes.toString("ascii", 12, 16) !== "IHDR") return false;
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    if (!width || !height || width > 512 || height > 512) return false;
  }
  pending.delete(reply.renderId);
  generations.delete(reply.renderId);
  resolved.add(reply.renderId);
  if (resolved.size > 256) resolved.delete(resolved.values().next().value!);
  resolve(reply);
  return true;
}

function validStill(value: unknown): value is Extract<CinematicStillResult, { ok: true }> {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v.ok === true && typeof v.resourceId === 'string' && /^[\w-]{1,160}$/.test(v.resourceId)
    && typeof v.name === 'string' && v.name.length <= 1000 && typeof v.prompt === 'string' && v.prompt.length <= 40_000
    && typeof v.dataUrl === 'string' && v.dataUrl.length <= 24_000_000
    && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(v.dataUrl);
}

/** Uses the browser's selected image provider/auth and its real reference reader. */
export function requestPiOpeningGeneration(project: Project, base: Project, args: Record<string, unknown>,
  emit: (event: PiAgentEvent) => void, signal: AbortSignal): Promise<CinematicStillResult> {
  signal.throwIfAborted();
  const renderId = randomUUID(), wire = slimProjectForWire(base, project);
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); pending.delete(renderId); generations.delete(renderId); signal.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new Error('오프닝 그림 생성 중단/시간 초과: 생성 미완료')); };
    const timer = setTimeout(abort, 300_000);
    signal.addEventListener('abort', abort, { once: true });
    generations.add(renderId);
    pending.set(renderId, reply => { cleanup(); if (typeof reply.issue === 'string') resolve({ ok: false, code: 'image-generation-failed', summary: reply.issue }); else resolve(reply.still as CinematicStillResult); });
    try { emit({ type: 'render_request', renderId, toolName: 'generate_opening_image', data: args, project: wire.project, unchangedKeys: wire.unchangedKeys, ...(wire.unchangedTilesetIds.length ? { unchangedTilesetIds: wire.unchangedTilesetIds } : {}) }); }
    catch (error) { cleanup(); reject(error); }
  });
}
export function requestPiRender(project: Project, base: Project, toolName: string, data: unknown,
  emit: (event: PiAgentEvent) => void, signal: AbortSignal, timeoutMs = 45_000): Promise<string> {
  signal.throwIfAborted();
  const renderId = randomUUID(), wire = slimProjectForWire(base, project);
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); pending.delete(renderId); signal.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(new Error("맵 이미지 요청 중단/시간 초과: 시각 검토 미완료")); };
    const timer = setTimeout(abort, timeoutMs);
    signal.addEventListener("abort", abort, { once: true });
    pending.set(renderId, reply => { cleanup(); if (typeof reply.issue === "string") reject(new Error(reply.issue)); else resolve(reply.png as string); });
    try { emit({ type: "render_request", renderId, toolName, data, project: wire.project, unchangedKeys: wire.unchangedKeys, ...(wire.unchangedTilesetIds.length ? { unchangedTilesetIds: wire.unchangedTilesetIds } : {}) }); }
    catch (error) { cleanup(); reject(error); }
  });
}
