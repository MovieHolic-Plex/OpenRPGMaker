// test/commandContracts/harness.ts
// G1 계약 테스트 하네스 (스펙 docs/specs/2026-07-07-event-command-runtime-guarantee-spec.md §4).
//
// test/interpreter.test.ts 의 기존 부트 패턴(빈 세션 + createInterpreter + drain 루프)을
// 재사용 가능한 형태로 추출했다. 기존 테스트 파일은 그대로 두고, 하네스는 같은 공개 API
// (createInterpreter / createBlankProject / serialize / deserialize)만 사용한다.
//
// - 기본 실행 환경: createBlankProject() + 시작 맵에 계약 테스트용 이벤트 1개(CONTRACT_EVENT_ID).
// - pause 발생 시 answers 스크립트를 순서대로 소비하고, 소진되면 undefined 로 자동 진행
//   (text dismiss / choices 기본 0번 선택과 동일한 의미).
// - console.warn 은 vi.spyOn 으로 캡처하고 반드시 복원한다.
// - finished 판정: 명령 리스트 끝에 감시용 setFlag 센티널을 붙여, 센티널이 실행됐는지로
//   "끝까지 도달"을 판정한다(transfer / End Event Processing 등 조기 종료와 구분).
import { vi } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import type { StepResult } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { Command, GameEvent, Project } from "@/project/types";
import type { PlaySessionLike } from "@/player/types";

/** 계약 테스트용 이벤트 id. setSelfSwitch 등 이벤트 컨텍스트 기준. */
export const CONTRACT_EVENT_ID = "ev_contract";

// finished 판정용 센티널 플래그. 결과 반환 전에 세션에서 제거한다.
const FINISHED_SENTINEL_FLAG = "__contract_finished__";

/** pause(step) 자동 응답 값. resume(value) 에 그대로 전달된다. */
export type ContractAnswer = number | boolean | string | undefined;

export interface ContractRunOptions {
  /** 기본: createBlankProject() 기반 + 맵 1개 + 이벤트 1개. 필요 시 콜백으로 가공. */
  mutateProject?: (project: Project) => void;
  /** 세션 초기값 (골드/아이템/스위치/변수/파티). 기본: 빈 세션. */
  mutateSession?: (session: PlaySessionLike) => void;
  /** pause(step) 발생 시 자동 응답 스크립트. 예: text→dismiss, choices→인덱스 선택. */
  answers?: readonly ContractAnswer[];
  /** 최대 스텝 수 안전핀. 기본 500 — 초과 시 테스트 실패(무한루프 검출). */
  maxSteps?: number;
  /**
   * 실행 이벤트 컨텍스트(setSelfSwitch/selfSwitch 조건 기준).
   * 기본 CONTRACT_EVENT_ID. null 이면 "이벤트 컨텍스트 없음"으로 실행한다.
   */
  currentEventId?: string | null;
}

export interface ContractRunResult {
  readonly session: PlaySessionLike;      // 최종 세션 상태 (단언 대상)
  readonly pauses: readonly StepResult[]; // 발생한 pause 스텝 전부 (text/choices/wait...)
  readonly warnings: readonly string[];   // console.warn 캡처 ([interpreter] 폴백 검증용)
  readonly finished: boolean;             // 명령 리스트 끝까지 도달했는가
}

// interpreter.test.ts 의 mkSession 패턴과 동일한 "빈 세션". PlaySessionLike 필수 필드만 채운다.
export function createContractSession(project?: Project): PlaySessionLike {
  return {
    flags: {},
    switches: {},
    variables: {},
    timers: {},
    gold: 0,
    inventory: {},
    partyActorIds: [],
    actorExperience: {},
    actorLevels: {},
    actorEquipment: {},
    actorVitals: {},
    currentMapId: project?.startMapId ?? "m1",
    x: project?.startPos.x ?? 0,
    y: project?.startPos.y ?? 0,
    audio: {},
    pictures: {},
  };
}

// 계약 테스트용 기본 프로젝트: 빈 프로젝트 + 시작 맵에 commands 를 가진 이벤트 1개.
export function buildContractProject(commands: readonly Command[]): Project {
  const project = createBlankProject();
  const event: GameEvent = {
    id: CONTRACT_EVENT_ID,
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands: [...commands],
  };
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("[commandContracts] blank project 에 시작 맵이 없습니다");
  map.events = [...map.events, event];
  return project;
}

export function runCommandContract(
  commands: readonly Command[],
  options?: ContractRunOptions
): ContractRunResult {
  const program: Command[] = [
    ...commands,
    { kind: "setFlag", flag: FINISHED_SENTINEL_FLAG, value: true },
  ];
  const project = buildContractProject(program);
  options?.mutateProject?.(project);
  const session = createContractSession(project);
  options?.mutateSession?.(session);

  const maxSteps = options?.maxSteps ?? 500;
  const answers = [...(options?.answers ?? [])];
  const currentEventId =
    options?.currentEventId === null ? undefined : options?.currentEventId ?? CONTRACT_EVENT_ID;

  const pauses: StepResult[] = [];
  const warnings: string[] = [];
  const warnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    warnings.push(args.map((arg) => String(arg)).join(" "));
  });
  try {
    const interpreter = createInterpreter(program, session, project, { currentEventId });
    let step = interpreter.start();
    let steps = 0;
    while (step.kind !== "done") {
      pauses.push(step);
      steps += 1;
      if (steps > maxSteps) {
        throw new Error(
          `[commandContracts] maxSteps(${maxSteps}) 초과 — 무한루프 의심 (마지막 pause: ${step.kind})`
        );
      }
      step = interpreter.resume(answers.length > 0 ? answers.shift() : undefined);
    }
  } finally {
    warnSpy.mockRestore();
  }

  const finished = session.flags[FINISHED_SENTINEL_FLAG] === true;
  delete session.flags[FINISHED_SENTINEL_FLAG];
  return { session, pauses, warnings, finished };
}

// 왕복 동일성 케이스용: 명령을 프로젝트에 실어 serialize→deserialize 를 통과시킨 뒤 돌려준다.
// deserialize 는 shape 검증에 더해 참조 검증(switch/variable/actor/skill id 존재)을 수행하므로,
// 명령이 blank project 에 없는 id 를 참조하면 mutateProject 로 해당 정의를 등록해야 한다.
export function roundtripCommands(
  commands: readonly Command[],
  mutateProject?: (project: Project) => void
): Command[] {
  const project = buildContractProject(commands);
  mutateProject?.(project);
  const restored = deserialize(serialize(project));
  const restoredEvent = restored.maps[restored.startMapId]?.events.find(
    (event) => event.id === CONTRACT_EVENT_ID
  );
  if (!restoredEvent) throw new Error("[commandContracts] 왕복 후 계약 이벤트가 사라졌습니다");
  return restoredEvent.commands;
}
