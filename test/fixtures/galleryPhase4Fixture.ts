import { runTool } from "@/editor/tools";
import { createBlankProject, DEFAULT_ITEM_ID } from "@/project/defaults";
import type { Project } from "@/project/types";

export const GALLERY_ORDER_SWITCH = "sw_gallery_order_clear";
export const GALLERY_EXIT_SWITCH = "sw_gallery_exit_open";
export const GALLERY_ENDING_ID = "ending_gallery_escape";
export const GALLERY_ITEM_ID = DEFAULT_ITEM_ID;

function assertTool(ok: boolean, summary: string): void {
  if (!ok) throw new Error(summary);
}

export function createGalleryPhase4Fixture(): Project {
  const project = createBlankProject();
  const ctx = { project };
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("gallery map missing");
  map.name = "갤러리 방";
  project.startPos = { x: 1, y: 1 };

  const hotspots = [
    { at: { x: 2, y: 2 }, name: "금 간 액자", lines: ["그림 속 눈이 이쪽을 본다."] },
    { at: { x: 3, y: 2 }, name: "긴 의자", lines: ["앉은 자국만 선명하다."] },
    { at: { x: 4, y: 2 }, name: "붉은 리본", lines: ["누군가 묶어 둔 리본이다."], itemId: GALLERY_ITEM_ID, once: true },
    { at: { x: 5, y: 2 }, name: "빈 받침대", lines: ["작품명 표찰이 긁혀 있다."] },
    { at: { x: 6, y: 2 }, name: "검은 화병", lines: ["안쪽에서 차가운 냄새가 난다."] },
    { at: { x: 2, y: 4 }, name: "낡은 팸플릿", lines: ["전시 순서가 일부 찢겨 나갔다."] },
    { at: { x: 3, y: 4 }, name: "커튼", lines: ["뒤에는 벽뿐이다."] },
    { at: { x: 4, y: 4 }, name: "바닥 얼룩", lines: ["닦아도 지워지지 않은 흔적이다."] },
    { at: { x: 5, y: 4 }, name: "손잡이 없는 문", lines: ["안쪽에서 잠긴 것 같다."] },
    { at: { x: 6, y: 4 }, name: "작은 거울", lines: ["내 뒤에 아무도 없다."] },
    { at: { x: 2, y: 6 }, name: "전시 번호 3", lines: ["숫자 3만 붉게 칠해져 있다."] },
    { at: { x: 3, y: 6 }, name: "마른 꽃", lines: ["건드리자 꽃잎이 바스러진다."] },
  ];
  const placed = runTool(ctx, "place_examine_hotspots", { mapId: map.id, hotspots });
  assertTool(placed.ok, placed.summary);

  const sequence = runTool(ctx, "compile_puzzle", {
    mapId: map.id,
    puzzleId: "gallery_order",
    kind: "switch-sequence",
    nodes: [
      { at: { x: 8, y: 2 }, name: "푸른 그림" },
      { at: { x: 9, y: 2 }, name: "흰 그림" },
      { at: { x: 10, y: 2 }, name: "붉은 그림" },
    ],
    order: [1, 0, 2],
    onSolve: { setSwitch: GALLERY_ORDER_SWITCH, message: "어딘가에서 걸쇠가 풀렸다." },
  });
  assertTool(sequence.ok, sequence.summary);

  const gate = runTool(ctx, "compile_puzzle", {
    mapId: map.id,
    puzzleId: "gallery_exit",
    kind: "item-gate",
    at: { x: 10, y: 5 },
    name: "리본 홈",
    requiredItemId: GALLERY_ITEM_ID,
    consumeItem: true,
    lockedMessage: "홈이 비어 있다.",
    unlockedMessage: "리본이 홈에 빨려 들어갔다.",
    onSolve: { setSwitch: GALLERY_EXIT_SWITCH, message: "출구의 잠금이 풀렸다." },
  });
  assertTool(gate.ok, gate.summary);

  const ending = runTool(ctx, "define_ending", {
    id: GALLERY_ENDING_ID,
    name: "갤러리 탈출",
    priority: 5,
    conditions: [{ kind: "switch", switchId: GALLERY_EXIT_SWITCH, value: true }],
  });
  assertTool(ending.ok, ending.summary);
  return ctx.project;
}
