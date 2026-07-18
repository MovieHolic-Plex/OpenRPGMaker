import type { Dir } from "../../src/project/types";
import type { TimePhase } from "../../src/project/gameTime";
import type { Point } from "./blueprint";

export type VillagerRoutine = {
  readonly phase: TimePhase;
  readonly at: Point;
  readonly facing: Dir;
  readonly activity: string;
};

export type VillagerBlueprint = {
  readonly id: string;
  readonly name: string;
  readonly at: Point;
  readonly spriteId: string;
  readonly characterIndex: number;
  readonly movement: "fixed" | "random";
  readonly line: string;
  readonly routine: readonly VillagerRoutine[];
};

const routine = (
  morning: Point,
  morningActivity: string,
  day: Point,
  dayActivity: string,
  evening: Point,
  eveningActivity: string,
): readonly VillagerRoutine[] => [
  { phase: "morning", at: morning, facing: "down", activity: morningActivity },
  { phase: "day", at: day, facing: "left", activity: dayActivity },
  { phase: "evening", at: evening, facing: "up", activity: eveningActivity },
];

export const VILLAGERS = [
  {
    id: "ev_reference_villager_baker", name: "제빵사 모아", at: { x: 42, y: 23 }, spriteId: "tex_easyrpg_charset_people1", characterIndex: 0, movement: "fixed",
    line: "아침엔 여관 화덕, 낮엔 장터. 빵 냄새를 따라오면 길을 잃지 않아.",
    routine: routine({ x: 42, y: 13 }, "baking", { x: 42, y: 23 }, "market-service", { x: 31, y: 29 }, "commons-supper"),
  },
  {
    id: "ev_reference_villager_carpenter", name: "목수 르온", at: { x: 47, y: 26 }, spriteId: "tex_easyrpg_charset_people2", characterIndex: 2, movement: "fixed",
    line: "다리 난간을 손보고 장터 좌판도 고쳐. 나무는 쓰인 곳마다 표정이 다르지.",
    routine: routine({ x: 56, y: 13 }, "woodworking", { x: 47, y: 26 }, "stall-repair", { x: 50, y: 18 }, "tool-delivery"),
  },
  {
    id: "ev_reference_villager_gardener", name: "정원사 리아", at: { x: 15, y: 26 }, spriteId: "tex_easyrpg_charset_people3", characterIndex: 4, movement: "random",
    line: "집마다 꽃을 똑같이 심지 않아. 사는 사람의 습관대로 자라게 두는 편이 좋아.",
    routine: routine({ x: 14, y: 26 }, "watering", { x: 18, y: 24 }, "gardening", { x: 28, y: 29 }, "seed-trading"),
  },
  {
    id: "ev_reference_villager_ferryman", name: "뱃사공 단", at: { x: 8, y: 27 }, spriteId: "tex_easyrpg_charset_people4", characterIndex: 1, movement: "fixed",
    line: "서쪽 길은 개울을 건너 들판으로 이어져. 비가 와도 이 다리는 닫지 않아.",
    routine: routine({ x: 1, y: 27 }, "west-gate-watch", { x: 8, y: 27 }, "bridge-watch", { x: 10, y: 29 }, "ferry-mending"),
  },
  {
    id: "ev_reference_villager_innkeeper", name: "여관주인 세나", at: { x: 41, y: 25 }, spriteId: "tex_easyrpg_charset_people5", characterIndex: 5, movement: "fixed",
    line: "북쪽 길손은 이층 방을 쓰고, 남쪽 목동은 시장이 끝나면 늦은 저녁을 먹어.",
    routine: routine({ x: 42, y: 13 }, "room-keeping", { x: 41, y: 25 }, "inn-service", { x: 44, y: 12 }, "guest-welcome"),
  },
  {
    id: "ev_reference_villager_child", name: "아이 누리", at: { x: 31, y: 28 }, spriteId: "tex_easyrpg_charset_actor2", characterIndex: 3, movement: "random",
    line: "광장 흙길은 우리 놀이터야. 우물 둘레를 세 바퀴 돌면 소원이 이루어진대.",
    routine: routine({ x: 17, y: 27 }, "chores", { x: 31, y: 28 }, "playground", { x: 14, y: 26 }, "homework"),
  },
  {
    id: "ev_reference_villager_elder", name: "촌장 오르", at: { x: 30, y: 28 }, spriteId: "tex_easyrpg_charset_people1", characterIndex: 7, movement: "fixed",
    line: "길 네 갈래를 모두 열어 둔 건 이곳이 끝이 아니라 오가는 마을이기 때문이지.",
    routine: routine({ x: 29, y: 28 }, "well-check", { x: 30, y: 28 }, "village-council", { x: 33, y: 31 }, "notice-reading"),
  },
  {
    id: "ev_reference_villager_forester", name: "숲지기 아라", at: { x: 49, y: 35 }, spriteId: "tex_easyrpg_charset_people2", characterIndex: 6, movement: "random",
    line: "큰나무 사이엔 어린나무를 남겼어. 숲 가장자리가 한 줄이면 바람을 못 막거든.",
    routine: routine({ x: 60, y: 35 }, "forest-patrol", { x: 49, y: 35 }, "sapling-care", { x: 47, y: 49 }, "firewood-count"),
  },
  {
    id: "ev_reference_villager_potter", name: "도예가 미오", at: { x: 20, y: 10 }, spriteId: "tex_easyrpg_charset_people3", characterIndex: 1, movement: "fixed",
    line: "북쪽 집 앞 항아리는 말리는 중이야. 시장 상자와 섞으면 금방 금이 가.",
    routine: routine({ x: 25, y: 11 }, "kiln-lighting", { x: 20, y: 10 }, "pottery", { x: 40, y: 27 }, "ware-selling"),
  },
  {
    id: "ev_reference_villager_guard", name: "동문지기 벤", at: { x: 61, y: 31 }, spriteId: "tex_easyrpg_charset_people4", characterIndex: 4, movement: "fixed",
    line: "동쪽 길은 장거리 상단이 드나들어. 시계집 불빛이 보이면 마을에 다 온 거야.",
    routine: routine({ x: 55, y: 31 }, "clock-check", { x: 61, y: 31 }, "east-gate-watch", { x: 50, y: 30 }, "sign-check"),
  },
  {
    id: "ev_reference_villager_shepherd", name: "목동 다미", at: { x: 36, y: 52 }, spriteId: "tex_easyrpg_charset_actor3", characterIndex: 2, movement: "random",
    line: "남쪽 길로 양을 몰고 나가. 저녁엔 긴 집 사람들이 울타리를 함께 닫아 줘.",
    routine: routine({ x: 35, y: 54 }, "sheep-tending", { x: 36, y: 52 }, "south-road-round", { x: 30, y: 47 }, "laundry-help"),
  },
  {
    id: "ev_reference_villager_courier", name: "전령 이든", at: { x: 32, y: 2 }, spriteId: "tex_easyrpg_charset_actor4", characterIndex: 0, movement: "random",
    line: "북문, 시장, 동문을 차례로 돌아. 지름길보다 사람을 만나는 길이 더 빠를 때가 있어.",
    routine: routine({ x: 32, y: 2 }, "north-gate-mail", { x: 44, y: 25 }, "market-delivery", { x: 58, y: 31 }, "courier-round"),
  },
] as const satisfies readonly VillagerBlueprint[];
