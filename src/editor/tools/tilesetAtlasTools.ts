// editor/tools/tilesetAtlasTools.ts
// 타일셋 아틀라스 저작(생성/속성/오토타일 그룹/애니메이션 스트립/그래프트).
// 2026-08-27 커버리지 감사(.omo/evidence/ai-editor-reach-20260827/coverage-audit.md)에서
// 에디터 UI 는 쓰는데 어떤 툴도 쓰지 못하던 저작 필드를 담당한다. 배열은 등록 seam 이며
// 개별 툴은 아래에 채워진다 — 등록 지점을 미리 고정해 병렬 작업이 toolRegistry.ts 에서 충돌하지 않게 한다.
import type { ToolDefinition } from "./types";

export const TILESET_ATLAS_TOOLS: readonly ToolDefinition[] = [];
