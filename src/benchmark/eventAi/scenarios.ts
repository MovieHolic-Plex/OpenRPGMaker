// benchmark/eventAi/scenarios.ts
// 이벤트 에디터 AI 도크가 실제로 받는 요청들. 프로브(scripts/event-ai-live-probe.mts)와
// 계약 테스트가 같은 목록을 쓴다 — "허접하다"를 재현 가능한 시나리오로 고정한다.
//
// 시나리오는 도크의 예시 버튼(PROMPT_EXAMPLES / EDIT_EXAMPLES)에 실제로 박혀 있는 문장을
// 우선 포함한다. 앱이 스스로 권하는 문장이 실패하면 그건 곧 제품 결함이다.

import { isPassableLanding } from "@/project/collision";
import { commandBranches } from "@/editor/tools/commandTraversal";
import type { Command, Project } from "@/project/types";

export interface ProbeExpectation {
  readonly label: string;
  readonly check: (after: readonly Command[], project: Project) => boolean;
}

export interface ProbeScenario {
  readonly id: string;
  readonly title: string;
  // create = 빈 페이지에 새로 만들기 / edit = 기존 목록 고치기 / delete = 지우기 / reorder = 순서 바꾸기
  readonly intent: "create" | "edit" | "delete" | "reorder";
  readonly prompt: string;
  readonly before: readonly Command[];
  readonly selection?: readonly number[];
  readonly selectionLabel?: string;
  readonly seed?: (project: Project) => void;
  readonly expectations: readonly ProbeExpectation[];
}

/** 중첩까지 모두 훑는다 — fork/choices 안에 들어간 명령도 "있다"로 세야 한다. */
export function flattenCommands(commands: readonly Command[]): Command[] {
  const flat: Command[] = [];
  for (const command of commands) {
    flat.push(command);
    for (const branch of commandBranches(command)) flat.push(...flattenCommands(branch.commands));
  }
  return flat;
}

export function hasKind(commands: readonly Command[], kind: Command["kind"]): boolean {
  return flattenCommands(commands).some((command) => command.kind === kind);
}

function countKind(commands: readonly Command[], kind: Command["kind"]): number {
  return flattenCommands(commands).filter((command) => command.kind === kind).length;
}

function textBodies(commands: readonly Command[]): string[] {
  return flattenCommands(commands)
    .filter((command): command is Extract<Command, { kind: "text" }> => command.kind === "text")
    .map((command) => command.body);
}

const CHEST_BEFORE: readonly Command[] = [
  { kind: "text", body: "낡은 상자다. 뚜껑이 살짝 들려 있다." },
  { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 2 },
  { kind: "text", body: "회복약 2개를 얻었다!" },
];

const NPC_BEFORE_FIRST_BODY =
  "어서 오게, 나그네. 우리 마을은 요즘 조용하다네. 강 건너 폐광에서 이상한 소리가 들린다는 소문이 있지만 별일 아닐 걸세.";

const NPC_BEFORE: readonly Command[] = [
  { kind: "text", speaker: "촌장", body: NPC_BEFORE_FIRST_BODY },
  { kind: "text", speaker: "촌장", body: "쉬어 가려면 여관을 쓰게." },
];

export const PROBE_SCENARIOS: readonly ProbeScenario[] = [
  {
    id: "create-chest",
    title: "빈 페이지 · 보물상자(도크 예시 그대로)",
    intent: "create",
    prompt: "열면 회복약 2개를 주고 이 이벤트 기억 A를 켠다. 이미 열었으면 «비어 있다»고 말한다.",
    before: [],
    expectations: [
      { label: "셀프 스위치 분기가 있다", check: (after) => hasKind(after, "fork") && flattenCommands(after).some((command) => command.kind === "fork" && command.condition.kind === "selfSwitch") },
      { label: "회복약을 2개 준다", check: (after) => flattenCommands(after).some((command) => command.kind === "changeItem" && command.itemId === "item_potion" && command.amount === 2) },
      { label: "기억 A를 켠다", check: (after) => flattenCommands(after).some((command) => command.kind === "setSelfSwitch" && command.key === "A" && command.value) },
      { label: "이미 열었을 때 대사가 있다", check: (after) => textBodies(after).some((body) => body.includes("비어")) },
    ],
  },
  {
    id: "create-npc",
    title: "빈 페이지 · 말 거는 NPC(도크 예시 그대로)",
    intent: "create",
    prompt: "인사하고 마을 소문을 한 줄 말한 뒤, 계속 물어볼지 «네/아니오»로 묻는다.",
    before: [],
    expectations: [
      { label: "대사가 2줄 이상", check: (after) => textBodies(after).length >= 2 },
      { label: "선택지가 있다", check: (after) => hasKind(after, "choices") },
      { label: "선택지 분기 중 하나에 내용이 있다", check: (after) => flattenCommands(after).some((command) => command.kind === "choices" && command.options.some((option) => option.branch.length > 0)) },
    ],
  },
  {
    id: "create-door",
    title: "빈 페이지 · 문 통과(도크 예시 그대로)",
    intent: "create",
    prompt: "«문이 열렸다»고 말한 다음 여관 안으로 장소를 옮긴다.",
    before: [],
    seed: (project) => {
      const source = project.maps[Object.keys(project.maps)[0]];
      project.maps.map_inn = { ...structuredClone(source), name: "여관", events: [] };
    },
    expectations: [
      { label: "대사가 있다", check: (after) => textBodies(after).length >= 1 },
      { label: "장소 이동이 있다", check: (after) => hasKind(after, "transfer") },
      { label: "이동 대상이 여관 맵이다", check: (after) => flattenCommands(after).some((command) => command.kind === "transfer" && command.mapId === "map_inn") },
      {
        label: "이동 좌표가 런타임 착지 가능한 칸이다",
        check: (after, project) => flattenCommands(after).every((command) => {
          if (command.kind !== "transfer") return true;
          const map = project.maps[command.mapId];
          return Boolean(map && isPassableLanding(project, map, command.x, command.y));
        }),
      },
    ],
  },
  {
    id: "edit-once",
    title: "기존 목록 · 한 번만 실행되게(도크 예시 그대로)",
    intent: "edit",
    prompt: "이미 한 번 실행했으면 다시 실행되지 않게 고쳐 줘.",
    before: CHEST_BEFORE,
    expectations: [
      { label: "셀프 스위치 분기가 생겼다", check: (after) => flattenCommands(after).some((command) => command.kind === "fork" && command.condition.kind === "selfSwitch") },
      { label: "셀프 스위치를 켠다", check: (after) => hasKind(after, "setSelfSwitch") },
      { label: "기존 아이템 지급이 남아 있다", check: (after) => flattenCommands(after).some((command) => command.kind === "changeItem" && command.itemId === "item_potion") },
      { label: "기존 대사를 지우지 않았다", check: (after) => textBodies(after).some((body) => body.includes("낡은 상자")) },
    ],
  },
  {
    id: "edit-shorten",
    title: "기존 목록 · 대사 다듬기(도크 예시 그대로)",
    intent: "edit",
    prompt: "대사를 더 짧고 자연스럽게 다듬어 줘. 내용은 그대로.",
    before: NPC_BEFORE,
    expectations: [
      { label: "대사 수가 유지된다", check: (after) => textBodies(after).length === 2 },
      { label: "첫 대사가 실제로 짧아졌다", check: (after) => (textBodies(after)[0]?.length ?? 9999) < NPC_BEFORE_FIRST_BODY.length },
      { label: "화자를 잃지 않았다", check: (after) => flattenCommands(after).filter((command) => command.kind === "text" && command.speaker === "촌장").length === 2 },
      { label: "명령 종류가 대사뿐이다", check: (after) => flattenCommands(after).every((command) => command.kind === "text") },
    ],
  },
  {
    id: "edit-condition",
    title: "기존 목록 · 조건 붙이기(도크 예시 그대로)",
    intent: "edit",
    prompt: "보상을 주기 전에 조건 검사를 붙여 줘.",
    before: CHEST_BEFORE,
    seed: (project) => {
      project.switches[0] = { id: "sw_0001", name: "촌장의 부탁 받음" };
    },
    expectations: [
      { label: "분기가 생겼다", check: (after) => hasKind(after, "fork") },
      { label: "분기 조건이 실존 스위치·변수·아이템을 본다", check: (after) => flattenCommands(after).some((command) => command.kind === "fork" && (command.condition.kind !== "switch" || command.condition.switchId === "sw_0001")) },
      { label: "아이템 지급이 분기 안으로 들어갔다", check: (after) => flattenCommands(after).some((command) => command.kind === "fork" && flattenCommands(command.then).some((inner) => inner.kind === "changeItem")) },
    ],
  },
  {
    id: "delete-reward",
    title: "기존 목록 · 아이템 지급만 지우기",
    intent: "delete",
    prompt: "회복약을 주는 부분만 지워 줘. 대사는 그대로 둬.",
    before: CHEST_BEFORE,
    expectations: [
      { label: "아이템 지급이 사라졌다", check: (after) => !hasKind(after, "changeItem") },
      { label: "대사 2줄이 남아 있다", check: (after) => textBodies(after).length === 2 },
    ],
  },
  {
    id: "reorder-text-first",
    title: "기존 목록 · 순서 바꾸기",
    intent: "reorder",
    prompt: "«회복약 2개를 얻었다!» 대사를 아이템 지급보다 먼저 나오게 순서를 바꿔 줘.",
    before: CHEST_BEFORE,
    expectations: [
      { label: "명령 3개가 유지된다", check: (after) => flattenCommands(after).length === 3 },
      { label: "얻었다 대사가 아이템 지급보다 앞이다", check: (after) => {
        const flat = flattenCommands(after);
        const gain = flat.findIndex((command) => command.kind === "text" && command.body.includes("얻었다"));
        const item = flat.findIndex((command) => command.kind === "changeItem");
        return gain >= 0 && item >= 0 && gain < item;
      } },
    ],
  },
  {
    id: "create-choice-gold",
    title: "빈 페이지 · 선택지 + 골드",
    intent: "create",
    prompt: "«도와줄까?»라고 묻고 네를 고르면 100골드를 주고, 아니오면 «다음에 보자»고만 말한다.",
    before: [],
    expectations: [
      { label: "선택지가 있다", check: (after) => hasKind(after, "choices") },
      { label: "골드를 100 준다", check: (after) => flattenCommands(after).some((command) => command.kind === "changeGold" && command.amount === 100 && command.op === "+=") },
      { label: "골드 지급이 선택 분기 안에 있다", check: (after) => flattenCommands(after).some((command) => command.kind === "choices" && command.options.some((option) => flattenCommands(option.branch).some((inner) => inner.kind === "changeGold"))) },
      { label: "거절 분기에 대사가 있다", check: (after) => flattenCommands(after).some((command) => command.kind === "choices" && command.options.some((option) => flattenCommands(option.branch).some((inner) => inner.kind === "text" && inner.body.includes("다음에")))) },
    ],
  },
  {
    id: "create-shop",
    title: "빈 페이지 · 상점 열기",
    intent: "create",
    prompt: "«무엇을 사려나»라고 말한 뒤 회복약과 마력약을 파는 상점을 연다.",
    before: [],
    expectations: [
      { label: "상점이 있다", check: (after) => hasKind(after, "shop") },
      { label: "상점 품목이 회복약·마력약이다", check: (after) => flattenCommands(after).some((command) => command.kind === "shop" && command.itemIds.includes("item_potion") && command.itemIds.includes("item_ether")) },
      { label: "대사가 상점보다 먼저다", check: (after) => {
        const flat = flattenCommands(after);
        const text = flat.findIndex((command) => command.kind === "text");
        const shop = flat.findIndex((command) => command.kind === "shop");
        return text >= 0 && shop > text;
      } },
    ],
  },
  {
    id: "create-battle",
    title: "빈 페이지 · 전투 + 승패 분기",
    intent: "create",
    prompt: "도적이 덤빈다고 말한 뒤 전투를 시작하고, 이기면 «도적을 물리쳤다»고 말한다.",
    before: [],
    expectations: [
      { label: "전투 명령이 있다", check: (after) => hasKind(after, "battleProcessing") },
      { label: "트룹 id 가 실존한다", check: (after) => flattenCommands(after).every((command) => command.kind !== "battleProcessing" || command.troopId.startsWith("troop_")) },
      { label: "승리 대사가 있다", check: (after) => textBodies(after).some((body) => body.includes("물리쳤")) },
    ],
  },
  {
    id: "create-inn",
    title: "빈 페이지 · 여관(가격 확인)",
    intent: "create",
    prompt: "50골드를 받고 재워 주는 여관 주인. 돈이 부족하면 «돈이 없구먼»이라고 말한다.",
    before: [],
    expectations: [
      { label: "여관 명령이 있다", check: (after) => hasKind(after, "inn") },
      { label: "가격이 50이다", check: (after) => flattenCommands(after).some((command) => command.kind === "inn" && command.price === 50) },
      { label: "부족 안내가 있다", check: (after) => textBodies(after).some((body) => body.includes("돈이 없")) },
    ],
  },
] as const;

export const PROBE_SCENARIO_COUNT = PROBE_SCENARIOS.length;
export { countKind };
