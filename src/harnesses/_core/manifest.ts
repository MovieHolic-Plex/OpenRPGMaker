/**
 * 하네스 매니페스트 — 하네스 하나가 무엇을 만들고, 어느 맥락에서만 쓰이며, 어떻게 시작하는지.
 *
 * 하네스는 `src/harnesses/<id>/` 폴더 하나다. 매니페스트(`harness.ts`)는 가볍게 유지한다 —
 * 레지스트리와 목록 생성기(`npm run harness -- list`)가 모든 매니페스트를 한꺼번에 읽는다.
 * 무거운 단계 코드는 `cli.ts` 와 그 아래에 두고, 실행할 때만 불러온다.
 */
import type { GenrePackId } from "../../project/genrePackId";

export type HarnessScope = {
  /** 이 장르 프로젝트에서만 쓰인다. 없으면 장르와 무관. */
  genre?: GenrePackId;
};

export type HarnessStage = {
  id: string;
  title: string;
  summary: string;
};

/** 하네스에 들어오는 길. 아직 없는 길은 false 로 정직하게 적는다. */
export type HarnessEntrypoints = {
  /** `npm run harness -- <id> <단계>` */
  cli: boolean;
  /** 에디터 화면 */
  editorUi: boolean;
  /** 에디터 AI 조수 도구 */
  assistantTool: boolean;
};

export type HarnessManifest = {
  /** 폴더 이름과 같은 kebab-case id */
  id: string;
  title: string;
  summary: string;
  scope: HarnessScope;
  /** 에이전트가 이 하네스를 써야 하는 상황 (AGENTS.md·INDEX 에 그대로 나간다) */
  triggers: string[];
  /** 저장소 루트 기준 시드 파일 경로. 하네스는 여기서 시작한다. */
  seed: string;
  /** 저장소 루트 기준 문서 경로 */
  doc: string;
  stages: HarnessStage[];
  entrypoints: HarnessEntrypoints;
  /**
   * 에디터 「공방」 실행기 지연 로더. editorUi 가 true 인 하네스만 둔다.
   * 매니페스트는 가볍게 — 실행기 코드는 부를 때만 import 한다.
   */
  workshop?: () => Promise<import("./workshop/types").WorkshopRunner>;
};

const ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function defineHarness(manifest: HarnessManifest): HarnessManifest {
  if (!ID_PATTERN.test(manifest.id)) throw new Error(`하네스 id 는 kebab-case 여야 한다: ${manifest.id}`);
  if (manifest.stages.length === 0) throw new Error(`하네스 ${manifest.id} 에 단계가 없다`);
  const stageIds = new Set<string>();
  for (const stage of manifest.stages) {
    if (stageIds.has(stage.id)) throw new Error(`하네스 ${manifest.id} 단계 id 중복: ${stage.id}`);
    stageIds.add(stage.id);
  }
  return manifest;
}

/** 장르 범위가 있는 하네스는 그 장르 프로젝트에서만 노출한다. */
export function harnessAppliesTo(manifest: HarnessManifest, genre: GenrePackId | null | undefined): boolean {
  return manifest.scope.genre === undefined || manifest.scope.genre === genre;
}
