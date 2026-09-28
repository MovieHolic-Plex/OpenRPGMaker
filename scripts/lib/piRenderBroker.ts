import { randomUUID } from "node:crypto";
import type { Project } from "../../src/project/types";
import { slimProjectForWire, type PiAgentEvent } from "../../src/ai/piAgent/protocol";

type Reply = { renderId?: unknown; png?: unknown; issue?: unknown };
const pending = new Map<string, (reply: Reply) => void>();
// 끊긴 소켓 뒤 재전달이 이미 받은 응답을 409 로 되돌리지 않게 최근 id 를 기억한다(piCheckpointBroker 와 같다).
const resolved = new Set<string>();
/** One-use, unguessable capability. Invalid payloads cannot consume another pending reply. */
export function resolvePiRender(reply: Reply): boolean {
  if (!reply || typeof reply.renderId !== "string") return false;
  const resolve = pending.get(reply.renderId);
  if (!resolve) return resolved.has(reply.renderId);
  if (typeof reply.issue !== "string" && (typeof reply.png !== "string" || reply.png.length > 4_000_000 || !/^iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(reply.png))) return false;
  if (typeof reply.issue !== "string") {
    const bytes = Buffer.from(reply.png as string, "base64");
    if (bytes.length < 24 || bytes.toString("ascii", 12, 16) !== "IHDR") return false;
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    if (!width || !height || width > 512 || height > 512) return false;
  }
  pending.delete(reply.renderId);
  resolved.add(reply.renderId);
  if (resolved.size > 256) resolved.delete(resolved.values().next().value!);
  resolve(reply);
  return true;
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
