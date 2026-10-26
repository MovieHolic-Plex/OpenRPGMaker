// editor/tools/stillPackGuard.ts
// 조수 쓰기 도구가 그림 파일이 없는 스틸 팩 그림(oprn-pack-still-*, 설치 전·CDN 미설정)을 새로 참조하면 거부한다.
// 타이틀·오프닝 레이어는 unsuitableOpeningStillMessage 가 먼저 막지만, 엔딩 그림·게임오버·그림 표시 명령처럼
// 리소스 id 를 받는 칸은 수십 곳이라 실행기에서 한 번 더 본다. 이미 있던 참조·편집기 직접 편집은 건드리지 않는다.
// 팩이 다 쓸 수 있으면(설치됨 또는 CDN) 훑지도 않는다.
import { allOpeningStillsAvailable, isOpeningStillAvailable, unavailableOpeningStillMessage } from "@/assets/installedStillPack";
import type { Project } from "@/project/types";
import { ToolError } from "./types";

const PACK_PREFIX = "oprn-pack-still-";

function collectPackStillRefs(value: unknown, out: Set<string>, depth = 0): void {
  if (depth > 64) return;
  if (typeof value === "string") {
    if (value.startsWith(PACK_PREFIX)) out.add(value);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (ArrayBuffer.isView(value)) return;
  if (Array.isArray(value)) {
    // 타일 버퍼 같은 숫자 배열은 첫 칸만 보고 건너뛴다.
    if (value.length > 0 && typeof value[0] === "number") return;
    for (const child of value) collectPackStillRefs(child, out, depth + 1);
    return;
  }
  for (const child of Object.values(value)) collectPackStillRefs(child, out, depth + 1);
}

/** 새로 생긴 참조 가운데 쓸 수 없는 팩 스틸이 있으면 ToolError. */
export function rejectUnavailablePackStills(before: Project, draft: Project): void {
  if (allOpeningStillsAvailable()) return;
  const after = new Set<string>();
  collectPackStillRefs(draft, after);
  if (after.size === 0) return;
  const previous = new Set<string>();
  collectPackStillRefs(before, previous);
  for (const id of after) {
    if (previous.has(id) || isOpeningStillAvailable(id)) continue;
    throw new ToolError(unavailableOpeningStillMessage(id, "그림") ?? id, { code: "resource-not-found" });
  }
}
