import type { FlagshipDemoBuildResult, FlagshipDemoId } from "@/project/flagship/types";

/**
 * 단일 HTML 플레이어(vite.standalone.config.ts)용 `@/project/flagship` 대역.
 *
 * 스탠드얼론은 inlineDynamicImports 라 exportEntry 의 `?demo=` 동적 import 도 한 파일에 들어간다. 진짜 모듈은
 * 대표 데모를 짓느라 에디터 도구 레지스트리·장소 스냅숏(약 28MB)을 끌고 와 standalone.js 가 100MB 를 넘겼고,
 * 비밀 검사 상한(64MiB, scripts/lib/playerArtifactInventory.mjs)에 걸려 `npm run build` 가 멈췄다(2026-10-20).
 * 단일 HTML 은 자기 게임을 품고 열리므로 내장 데모를 실을 이유가 없다 — 데모는 player.html(?demo=) 경로다.
 */
export function createFlagshipDemoProject(id: FlagshipDemoId): FlagshipDemoBuildResult {
  throw new Error(`단일 HTML 플레이어에는 내장 데모게임이 없습니다: ${String(id)}`);
}
