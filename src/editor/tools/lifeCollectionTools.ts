// editor/tools/lifeCollectionTools.ts
// 생활 수집 저작(어종/낚시터/계절 채집/박물관/수집 도감).
// 2026-08-27 커버리지 감사(.omo/evidence/ai-editor-reach-20260827/coverage-audit.md)에서
// 에디터 UI 는 쓰는데 어떤 툴도 쓰지 못하던 저작 필드를 담당한다. 배열은 등록 seam 이며
// 개별 툴은 아래에 채워진다 — 등록 지점을 미리 고정해 병렬 작업이 toolRegistry.ts 에서 충돌하지 않게 한다.
import type { ToolDefinition } from "./types";

export const LIFE_COLLECTION_TOOLS: readonly ToolDefinition[] = [];
