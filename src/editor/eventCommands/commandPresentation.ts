import { commandKindLabel } from "@/editor/panels/eventEditor/options";
import { COMMAND_KINDS, type CommandKind } from "@/project/commandKindRegistry";
import {
  COMMAND_GUARANTEES,
  type CommandFamily,
  type CommandSupport,
} from "@/project/commandGuaranteeRegistry";
import type { M2CommandPickerPage } from "@/project/eventCommands/m2PickerLayout";
import {
  M2_PICKER_BATTLE_GROUP,
  M2_PICKER_FLOW_GROUP,
  M2_PICKER_GROWTH_GROUP,
  M2_PICKER_PARTY_GROUP,
  M2_PICKER_SOUND_GROUP,
  M2_PICKER_SPEAK_GROUP,
  M2_PICKER_TRADE_GROUP,
} from "@/project/eventCommands/m2PickerLayout";

export type CommandPresentationDescriptor = Readonly<{
  kind: CommandKind;
  label: string;
  group: CommandFamily;
  page: M2CommandPickerPage;
  support: CommandSupport;
  stability: (typeof COMMAND_GUARANTEES)[CommandKind]["stability"];
  executionOwner: (typeof COMMAND_GUARANTEES)[CommandKind]["executionOwner"];
  selectable: boolean;
  alternateRoute?: string;
}>;

const FAMILY_LABELS: Readonly<Record<CommandFamily, string>> = {
  // 탭 1 가족도 카탈로그 행과 같은 저작면 어휘를 쓴다.
  dialogue: M2_PICKER_SPEAK_GROUP,
  controlFlow: M2_PICKER_FLOW_GROUP,
  state: M2_PICKER_FLOW_GROUP,
  time: M2_PICKER_FLOW_GROUP,
  map: "맵/이동",
  // 탭 2 그룹은 m2 카탈로그 행과 같은 어휘를 쓴다 — 한 작업면이 헤딩 여럿으로 쪼개지지 않게.
  battle: M2_PICKER_BATTLE_GROUP,
  actor: M2_PICKER_GROWTH_GROUP,
  economy: M2_PICKER_TRADE_GROUP,
  social: M2_PICKER_GROWTH_GROUP,
  // 필드 몬스터 등장/제거는 전투 준비다 — 파티 명부가 아니다.
  monster: M2_PICKER_BATTLE_GROUP,
  follower: M2_PICKER_PARTY_GROUP,
  atmosphere: "화면/연출",
  media: "미디어",
  commerce: M2_PICKER_TRADE_GROUP,
  system: "시스템/고급",
  compatibility: "호환/고급",
};

function alternateRouteFor(kind: CommandKind): string | undefined {
  const surfaces = COMMAND_GUARANTEES[kind].authoringSurfaces;
  if (surfaces.includes("quick")) return "빠른 저작";
  if (surfaces.includes("nested")) return "명령 목록 삽입";
  if (surfaces.includes("ai")) return "AI 저작 도구";
  return undefined;
}

/**
 * 페이지 매핑은 가족 전수를 명시한다. time/compatibility 를 시스템 탭으로 물려보내는
 * 기본값 4 는 없다 — 시간/생활은 탭 1 저작면이고, 시스템 탭은 시스템·도구만 단는다.
 */
const PAGE_BY_FAMILY: Readonly<Record<CommandFamily, M2CommandPickerPage>> = {
  dialogue: 1,
  controlFlow: 1,
  state: 1,
  time: 1,
  economy: 1,
  commerce: 1,
  actor: 2,
  battle: 2,
  monster: 2,
  follower: 2,
  social: 2,
  map: 3,
  atmosphere: 3,
  media: 3,
  system: 4,
  compatibility: 4,
};

function pageForFamily(family: CommandFamily): M2CommandPickerPage {
  return PAGE_BY_FAMILY[family];
}

export const COMMAND_PRESENTATION_DESCRIPTORS: readonly CommandPresentationDescriptor[] = Object.freeze(
  COMMAND_KINDS.map((kind) => {
    const guarantee = COMMAND_GUARANTEES[kind];
    return {
      kind,
      label: commandKindLabel(kind),
      group: guarantee.family,
      page: pageForFamily(guarantee.family),
      support: guarantee.supportByContext.map,
      stability: guarantee.stability,
      executionOwner: guarantee.executionOwner,
      selectable: guarantee.authoringSurfaces.includes("mainPicker") && guarantee.supportByContext.map === "full",
      alternateRoute: alternateRouteFor(kind),
    };
  })
);

export function commandPresentationDescriptor(kind: CommandKind): CommandPresentationDescriptor {
  const descriptor = COMMAND_PRESENTATION_DESCRIPTORS.find((entry) => entry.kind === kind);
  if (!descriptor) throw new Error(`Missing command presentation descriptor: ${kind}`);
  return descriptor;
}

export function commandPresentationGroupLabel(family: CommandFamily): string {
  return FAMILY_LABELS[family];
}
