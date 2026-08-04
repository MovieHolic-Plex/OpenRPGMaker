// 이벤트 명령 스키마 — 명령 하나를 "선언"하면 폼·요약문·분기 구조가 파생된다.
//
// 지금까지 명령 하나는 최소 두 곳에 따로 기술돼 있었다:
//   1) commandBody*.ts — 편집 폼을 손으로 그림 (15파일 / 약 12,000줄)
//   2) commandSummary.ts — 목록 요약문을 kind 분기로 또 기술 (67분기)
// 두 곳이 어긋나면 "폼에서 고쳤는데 목록 표시가 그대로"인 버그가 난다.
// 스키마는 이 둘의 단일 진실 소스다.

import type { CommandFamily } from "@/project/commandGuaranteeRegistry";
import type { CommandKind } from "@/project/commandKindRegistry";
import type { FieldMap } from "./fieldTypes";

/** 명령이 품는 분기 슬롯 하나. */
export type BranchSpec = {
  /** 명령 객체에서 Command[] 를 담고 있는 키. 예: "victoryBranch" */
  readonly key: string;
  /** 캔버스에 표시할 이름. 예: "승리" */
  readonly label: string;
  /** 분기 라벨 색조. 생략 시 카테고리 색. */
  readonly tone?: "ok" | "danger" | "warn" | "neutral";
};

/** 요약문 생성에 필요한 조회기. 프로젝트 전역 상태에 직접 의존하지 않게 주입한다. */
export type SummaryLookup = {
  /** 스위치 id → 표시 이름. */
  readonly switchName: (id: string) => string;
  /** 변수 id → 표시 이름. */
  readonly variableName: (id: string) => string;
  /** 레코드 id → 표시 이름 (아이템·주인공·맵 …). */
  readonly recordName: (id: string) => string;
};

export type CommandSchema = {
  readonly kind: CommandKind;
  readonly family: CommandFamily;
  /** 팔레트·인스펙터 제목에 쓰는 한글 라벨. */
  readonly label: string;
  readonly fields: FieldMap;
  /**
   * 이 명령이 만들어내는 분기. 값에 따라 달라질 수 있다
   * (battleProcessing 은 branchOnResult 가 켜져야 3분기가 생긴다).
   */
  readonly branches?: (cmd: Record<string, unknown>) => readonly BranchSpec[];
  /** 명령 목록에 보이는 한 줄 요약. */
  readonly summary: (cmd: Record<string, unknown>, lookup: SummaryLookup) => string;
};

const REGISTRY = new Map<CommandKind, CommandSchema>();

/** 스키마를 등록한다. 같은 kind 를 두 번 등록하면 개발 중 실수이므로 던진다. */
export function defineCommand(schema: CommandSchema): CommandSchema {
  if (REGISTRY.has(schema.kind)) {
    throw new Error(`중복 스키마 등록: ${schema.kind}`);
  }
  REGISTRY.set(schema.kind, schema);
  return schema;
}

export function commandSchemaFor(kind: string): CommandSchema | undefined {
  return REGISTRY.get(kind as CommandKind);
}

export function hasCommandSchema(kind: string): boolean {
  return REGISTRY.has(kind as CommandKind);
}

/** 등록된 모든 스키마 (등록 순서). */
export function allCommandSchemas(): readonly CommandSchema[] {
  return [...REGISTRY.values()];
}

/** 테스트 격리용. 프로덕션 경로에서는 쓰지 않는다. */
export function resetCommandSchemas(): void {
  REGISTRY.clear();
}

/** 분기를 품은 명령인지 (현재 값 기준). */
export function schemaBranchesOf(cmd: { kind: string }): readonly BranchSpec[] {
  const schema = commandSchemaFor(cmd.kind);
  if (!schema?.branches) return [];
  return schema.branches(cmd as Record<string, unknown>);
}
