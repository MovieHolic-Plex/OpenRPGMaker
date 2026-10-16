// 몬스터 센터 회복 연출 레시피 — 새 엔진 기능이 아니라 기존 이벤트 명령(대사·선택지·이동 루트·소리·파티클·화면 번쩍·애니메이션·대기)의 조립이다.
//
// 3세대 포켓몬 센터의 흐름을 그대로 따른다:
//   「동료들을 맡기시겠어요?」 예/아니오 → 「그럼 잠시 맡을게요」 → 간호사가 허리를 숙임 → 파티 수만큼 볼이 기계에 줄지어 놓임(칸마다 똑 소리 + 반짝임)
//   → 회복 음악(ME) + 화면이 세 번 하얗게 번쩍임 → 전원 회복(recoverAll) → 「기다리셨습니다! 건강해졌어요」 → 마지막 센터 기록(checkpointSave) → 「또 오세요」.
// 새 그림은 없다 — 번들 효과음·파티클 프리셋(heal/sparkle)·전투 애니메이션만 쓴다.
// world.ts(몬스터 캠페인 센터)와 place_monster_center(조수 도구)가 같은 레시피를 쓴다. 한 곳에서 고치면 둘 다 바뀐다.
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import type { Command, M2CommandFields } from "@/project/types";

/** 파티가 가질 수 있는 최대 칸. 볼 줄은 이 칸 수까지 partySize 분기로 늘어난다. */
export const MONSTER_CENTER_MAX_PARTY = 6;
/** 번쩍임 횟수 — 원작처럼 세 번. */
const FLASH_COUNT = 3;

export interface MonsterCenterAudio {
  /** 볼이 기계에 놓일 때 칸마다. */
  readonly ballSe: string;
  /** 번쩍임마다. */
  readonly pulseSe: string;
  /** 회복이 끝났을 때. */
  readonly doneSe: string;
  /** 회복 음악(ME, 한 번 울리고 BGM 은 이어진다). */
  readonly me: string;
}

/** 번들 효과음(EasyRPG RTP). 몬스터 캠페인은 자기 ME 를 audio.me 로 덮어쓴다. */
export const DEFAULT_MONSTER_CENTER_AUDIO: MonsterCenterAudio = {
  ballSe: "easyrpg-sound-item2",
  pulseSe: "easyrpg-sound-chime1",
  doneSe: "easyrpg-sound-chime2",
  me: "easyrpg-sound-recovery5",
};

export interface MonsterCenterRecipeOptions {
  /** 화자 이름(대사 앞). 기본 「센터 직원」. */
  readonly speaker?: string;
  /** 첫 인사. null 이면 인사를 넣지 않는다(호출부가 NPC 첫 대사로 이미 냈을 때). */
  readonly greeting?: string | null;
  /** 「마지막으로 들른 센터」 표시 이름. 생략하면 checkpointSave 를 넣지 않는다(체크포인트 없는 센터). */
  readonly checkpointLabel?: string;
  /**
   * 볼이 놓이는 칸 — 파티 1번 칸부터 순서대로. 모자라면 마지막 칸에서 되풀이 반짝인다(기계 한 칸에 볼이 쌓이는 모양).
   * 생략하면 간호사(이 이벤트) 자리에서 반짝인다.
   */
  readonly machineCells?: readonly { readonly x: number; readonly y: number }[];
  /** 프로젝트에 이 전투 애니메이션이 있으면 볼이 놓일 때 함께 재생한다(없으면 파티클만). */
  readonly ballAnimationId?: string;
  readonly audio?: Partial<MonsterCenterAudio>;
}

const text = (body: string, speaker?: string): Command => ({ kind: "text", body, ...(speaker ? { speaker } : {}) });
const wait = (ms: number): Command => ({ kind: "wait", ms });
const se = (resourceId: string): Command => ({ kind: "playAudio", resourceId, channel: "se", loop: false });

function m2(title: string, fields: M2CommandFields): Command {
  const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
  if (!entry) throw new Error(`M2 command not found: ${title}`);
  return { kind: "m2Command", commandId: entry.id, fields };
}

/**
 * 간호사가 꾸벅 인사한다 — 타일을 옮기지 않는 제자리 폴짝(이벤트 자신, 끝날 때까지 기다린다).
 * jump 는 dx=dy=0 이면 「바라보는 쪽으로 두 칸」이라 간호사가 손님을 넘어 걸어 나간다(2026-10-16 QA) — dropIn 이 제자리 리프트다.
 */
const bow = (): Command => ({
  kind: "moveEvent", eventId: "",
  route: { moves: [{ kind: "dropIn", heightPx: 6, durationMs: 300 }], repeat: false, wait: true },
});

/** 볼 하나가 놓이는 연출 — 소리 + 반짝임(+ 있으면 애니메이션). */
function placeBall(slot: number, audio: MonsterCenterAudio, cell: { x: number; y: number } | undefined, animationId: string | undefined): Command {
  const target = cell ? { x: cell.x, y: cell.y } : { eventId: "" };
  const glints: Command[] = [
    m2("Particle Effect", cell
      ? { preset: "sparkle", target: "tile", x: cell.x, y: cell.y, durationMs: 900, wait: false }
      : { preset: "sparkle", target: "this-event", durationMs: 900, wait: false }),
    ...(animationId ? [{ kind: "showAnimation", target, animationId, wait: false } as Command] : []),
  ];
  return {
    kind: "fork",
    condition: { kind: "partySize", op: ">=", value: slot + 1 },
    then: [se(audio.ballSe), ...glints, wait(340)],
  };
}

/** 기계가 켜지는 한 번 — 놓인 볼마다 치유 파티클 + 하얀 섬광 + 소리, 그리고 숨 고르기. */
function pulse(audio: MonsterCenterAudio, cells: readonly ({ x: number; y: number } | undefined)[]): Command[] {
  const glow: Command[] = cells.map((cell, slot): Command => ({
    kind: "fork",
    condition: { kind: "partySize", op: ">=", value: slot + 1 },
    then: [m2("Particle Effect", cell
      ? { preset: "heal", target: "tile", x: cell.x, y: cell.y, durationMs: 700, wait: false }
      : { preset: "heal", target: "this-event", durationMs: 700, wait: false })],
  }));
  return [se(audio.pulseSe), ...glow, m2("Flash Screen", { color: "white", durationMs: 150, value: "flash" }), wait(420)];
}

/**
 * 센터 회복 이벤트 명령 목록. NPC 이벤트(간호사)의 한 페이지 commands 로 그대로 넣는다.
 * 조사한 이벤트 자신이 간호사다(moveEvent/파티클의 기본 대상 = 이 이벤트).
 */
export function monsterCenterCommands(options: MonsterCenterRecipeOptions = {}): Command[] {
  const speaker = options.speaker ?? "센터 직원";
  const audio: MonsterCenterAudio = { ...DEFAULT_MONSTER_CENTER_AUDIO, ...options.audio };
  const cells = options.machineCells ?? [];
  const slotCells = Array.from({ length: MONSTER_CENTER_MAX_PARTY }, (_, slot) => (cells.length ? cells[Math.min(slot, cells.length - 1)] : undefined));
  const greeting = options.greeting === undefined ? "몬스터 센터에 어서 오세요! 동료들을 건강하게 해 드릴까요?" : options.greeting;

  const ritual: Command[] = [
    text("그럼 동료들을 잠시 맡을게요.", speaker),
    bow(),
    ...Array.from({ length: MONSTER_CENTER_MAX_PARTY }, (_, slot) => placeBall(slot, audio, slotCells[slot], options.ballAnimationId)),
    wait(700),
    // 회복 음악은 번쩍임과 함께 시작한다 — 볼이 다 놓인 뒤 기계가 켜지는 순간.
    { kind: "playAudio", resourceId: audio.me, channel: "me", loop: false },
    ...Array.from({ length: FLASH_COUNT }, () => pulse(audio, slotCells)).flat(),
    // 화면이 번쩍이는 사이 몬스터 전원이 회복된다 — 체력·상태·기술 횟수.
    { kind: "recoverAll" },
    se(audio.doneSe),
    wait(450),
    bow(),
    text("기다리셨습니다! 동료들이 모두 건강해졌어요.", speaker),
    ...(options.checkpointLabel ? [{ kind: "checkpointSave", label: options.checkpointLabel } as Command] : []),
    text("또 힘들면 언제든 들러 주세요. 안녕히 가세요!", speaker),
  ];

  return [
    ...(greeting ? [text(greeting, speaker)] : []),
    {
      kind: "choices",
      prompt: "동료들을 맡길까요?",
      options: [
        { text: "맡긴다", branch: ritual },
        { text: "괜찮아요", branch: [text("그렇군요. 필요하면 언제든 말씀하세요.", speaker)] },
      ],
      cancelBehavior: "branch",
      cancelBranch: [text("그렇군요. 필요하면 언제든 말씀하세요.", speaker)],
    },
  ];
}
