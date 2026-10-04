import { APP_VERSION_META } from "@/brand";
import { sharedContentSnapshot } from "./sharedContent";
import type { Project } from "./types";

/**
 * 부팅 정규화 건너뛰기 표식(`project.meta.bootNormalization`).
 *
 * 왜(2026-09-30 실측, 44MB 프로젝트): 로드 뒤 `normalizeCurrentProject` 는 정규화기 16개를 돌리고 전후 내용 요약을 낸다.
 * 이미 같은 빌드가 정규화를 끝낸 문서에서도 매번 첫 요약 약 4.8s(따뜻하면 0.4s) + 정규화기 약 1.1s 를 치렀다.
 * 정규화기는 «빌드 코드 + 공용 라이브러리 판본»의 함수이므로 둘이 같으면 결과도 같다 — 그 짝을 문서에 새겨 두고
 * 다음 로드에서 짝이 맞으면 건너뛴다.
 *
 * 안전 규칙:
 * - 표식이 없거나 짝이 다르면(옛 파일·미마이그 사본·새 빌드·새 공용 판본) 예전처럼 전부 정규화한다. 그 뒤 표식을 새긴다.
 * - 정규화기 코드를 바꾸면서 커밋이 안 바뀌는 자리(개발 서버·수정된 트리·커밋 미상)에서는 건너뛰지도, 새기지도 않는다.
 * - 공용 라이브러리를 아직 못 받았으면(`bundled`) 건너뛰지도, 새기지도 않는다 — 나중 판본과 짝이 안 맞을 표식을 남기지 않는다.
 * - 커밋이 같아도 정규화기를 손댔다면 이 숫자를 올린다.
 */
export const NORMALIZER_VERSION = 1;

export interface BootNormalizationMarker {
  readonly v: number;
  readonly lib: string;
}

/** 지금 빌드·공용 판본의 짝. 건너뛰기를 믿을 수 없는 환경이면 null. */
export function currentBootNormalizationMarker(): BootNormalizationMarker | null {
  const { commit, dirty } = APP_VERSION_META;
  if (dirty || !commit || commit === "unknown") return null;
  const revision = sharedContentSnapshot().revision;
  if (!revision || revision === "bundled") return null;
  return { v: NORMALIZER_VERSION, lib: `${revision}|${commit}` };
}

export function readBootNormalization(project: Project): BootNormalizationMarker | null {
  const value = (project.meta as { bootNormalization?: unknown } | undefined)?.bootNormalization;
  if (typeof value !== "object" || value === null) return null;
  const { v, lib } = value as { v?: unknown; lib?: unknown };
  return typeof v === "number" && typeof lib === "string" ? { v, lib } : null;
}

export function bootNormalizationMatches(project: Project, marker: BootNormalizationMarker | null): boolean {
  if (marker === null) return false;
  const stored = readBootNormalization(project);
  return stored !== null && stored.v === marker.v && stored.lib === marker.lib;
}

export function stampBootNormalization(project: Project, marker: BootNormalizationMarker): void {
  (project.meta as { bootNormalization?: BootNormalizationMarker }).bootNormalization = { v: marker.v, lib: marker.lib };
}
