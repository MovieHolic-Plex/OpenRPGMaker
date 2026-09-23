// 모델 없는 게임 QA 검사기의 공용 타입.
//
// 이 검사기는 오프라인 QA 도구다 — 조수 실행 경로의 게이트가 아니다(조수에는 게이트를 더 붙이지 않는다).
// 프로젝트 데이터만 읽고, 자동 플레이는 헤드리스 런타임(runSceneTest)을 그대로 돌린다.

export type FindingSeverity = "blocker" | "warning" | "info";

/** 명령 하나가 놓인 자리. 경로는 사람이 읽고 에디터에서 찾아갈 수 있는 모양으로 남긴다. */
export interface CommandWhere {
  readonly mapId?: string;
  readonly mapName?: string;
  readonly eventId?: string;
  readonly eventName?: string;
  /** 이벤트 페이지 번호(0부터). 페이지 없는 옛 이벤트는 -1. */
  readonly pageIndex?: number;
  readonly commonEventId?: string;
  /** 예: `commands[3].options[0].branch[1]` */
  readonly path?: string;
  readonly x?: number;
  readonly y?: number;
}

export interface Finding {
  readonly severity: FindingSeverity;
  /** 안정적인 기계용 코드(테스트·비교용). */
  readonly code: string;
  /** 사람이 읽는 한국어 설명. */
  readonly message: string;
  readonly where?: CommandWhere;
}

export interface AutoPlayStepTrace {
  readonly goal: string;
  readonly ok: boolean;
  readonly detail: string;
  readonly where?: CommandWhere;
  readonly mapId?: string;
  readonly x?: number;
  readonly y?: number;
  /** 실패했지만 다음 목표로 계속 간 단계(예: 파티에 null 이 들어간 동료 합류). */
  readonly soft?: boolean;
}

export interface AutoPlayRun {
  readonly label: string;
  readonly ok: boolean;
  /** 끝까지 갔으면 도달한 엔딩 id(또는 `ending` 명령 제목). */
  readonly endingReached?: string;
  readonly steps: readonly AutoPlayStepTrace[];
  /** 처음 실패한 목표. */
  readonly failure?: AutoPlayStepTrace;
  readonly sceneSteps: number;
  readonly runs: number;
  readonly ms: number;
  readonly partyAtEnd?: readonly (string | null)[];
}

export interface AutoPlayReport {
  readonly targets: readonly { readonly label: string; readonly where: CommandWhere }[];
  readonly plan: readonly string[];
  readonly runs: readonly AutoPlayRun[];
  readonly skipped?: string;
}

export interface MapSummary {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly events: number;
  readonly tilesetId: string;
  readonly reachable: boolean;
  readonly inbound: number;
  readonly climate?: string;
}

export interface GameCheckReport {
  readonly version: 1;
  readonly title: string;
  readonly startMapId: string;
  readonly generatedAt: string;
  readonly ms: number;
  readonly counts: Readonly<Record<FindingSeverity, number>>;
  readonly findings: readonly Finding[];
  readonly maps: readonly MapSummary[];
  readonly autoPlay?: AutoPlayReport;
}

export interface GameCheckOptions {
  /** 기획(브리프) 문장 — 기후·동료·던전 같은 부합 힌트를 경고로 낸다. 생략하면 project.gameDesignBrief. */
  readonly briefText?: string;
  /** 자동 플레이를 건너뛴다(정적 검사만). */
  readonly skipAutoPlay?: boolean;
  /** 저장본 원본 JSON. 주면 로더가 조용히 고친 명령(생성기가 잘못 쓴 흔적)을 경고로 낸다. */
  readonly rawProject?: unknown;
  /** 자동 플레이 전체 상한(ms). */
  readonly autoPlayBudgetMs?: number;
}

export function whereText(where: CommandWhere | undefined): string {
  if (!where) return "";
  const parts: string[] = [];
  if (where.mapId) parts.push(where.mapName ? `${where.mapName}(${where.mapId})` : where.mapId);
  if (where.commonEventId) parts.push(`공통 이벤트 ${where.commonEventId}`);
  if (where.eventId) parts.push(`이벤트 ${where.eventName ? `${where.eventName}(${where.eventId})` : where.eventId}`);
  if (where.pageIndex !== undefined && where.pageIndex >= 0) parts.push(`페이지 ${where.pageIndex + 1}`);
  if (where.path) parts.push(where.path);
  if (where.x !== undefined && where.y !== undefined) parts.push(`(${where.x},${where.y})`);
  return parts.join(" · ");
}
