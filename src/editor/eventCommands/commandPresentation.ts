import { commandKindLabel } from "@/editor/panels/eventEditor/options";
import { COMMAND_KINDS, type CommandKind } from "@/project/commandKindRegistry";
import {
  COMMAND_GUARANTEES,
  type CommandFamily,
  type CommandSupport,
} from "@/project/commandGuaranteeRegistry";
import type { M2CommandPickerPage } from "@/project/eventCommands/m2PickerLayout";

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
  dialogue: "대화/입력",
  controlFlow: "조건/흐름",
  state: "스위치/변수",
  time: "시간/생활",
  map: "맵/이동",
  battle: "전투",
  actor: "배우/파티",
  economy: "아이템/경제",
  social: "관계/소셜",
  monster: "몬스터",
  follower: "동료",
  atmosphere: "화면/연출",
  media: "미디어",
  commerce: "상점/시설",
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

function pageForFamily(family: CommandFamily): M2CommandPickerPage {
  if (["dialogue", "controlFlow", "state", "economy", "commerce"].includes(family)) return 1;
  if (["actor", "battle", "monster", "follower", "social"].includes(family)) return 2;
  if (["map", "atmosphere", "media"].includes(family)) return 3;
  return 4;
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
