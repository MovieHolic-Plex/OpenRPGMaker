// 조수 v2 빌더 증명 사례 — 빌더마다 몇 개씩. before = 시작 상태를 만드는 v1 도구 호출(선택).
import type { PlaceSpec } from "../../../src/ai/v2/types.ts";
export interface BuilderCase { readonly id: string; readonly spec: PlaceSpec; readonly startTileset?: string; readonly before?: readonly { tool: string; args: Record<string, unknown> }[] }
export const BUILDER_CASES: BuilderCase[] = [];
