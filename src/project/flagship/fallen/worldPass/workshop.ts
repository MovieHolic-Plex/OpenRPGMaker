/**
 * 재료 조합 공방 — 「재료들 모아서 아이템 조합하는 상점 이런 것도 만들고」(사용자 2026-11-04).
 * 숲에서 줍는 드롭(늑대 송곳니·가죽, 거미 비단·독 주머니, 푸른 불씨)은 지금까지 팔거나 로한의 창에만 썼다.
 * 남쪽 거리의 잠긴 집 하나를 「니나의 공방」으로 열고, 장인 니나가 엔진의 제작 명령(craftRecipe)으로 재료를 쓸모 있는 물건으로 바꾼다.
 * 제작법은 system.craftRecipes 에 둔다 — 같은 제작법이 가방 메뉴 「조합」(두 재료 1개씩)에도 그대로 쓰인다.
 * 실내는 손 도트 실내 v5(build_hand_interior_room) — 약재 작업실 + 작은 대장 작업장 + 재료 창고.
 */
import type { CraftRecipe } from "@/project/craftRecipes";
import type { Command, Condition, GameEvent, Project } from "@/project/types";
import {
  type Cell, type Exec, type Option, all, chipGraphic, choices, fork, gotoLabel, has, label, mustMap, narrate, page, putEvent, say, se, varCond,
} from "./common";

export const FS_WORKSHOP_ID = "fs_workshop";
const NINA = "공방 장인 니나";
const RESULT = "var_fs_craft_ok";

type Recipe = CraftRecipe & { readonly pitch: string };

/** 재료는 모두 1막 숲 드롭(battleItems.ts 드롭 표) — 평범한 플레이에서 숲을 한 바퀴 돌면 모인다. */
export const FS_WORKSHOP_RECIPES: readonly Recipe[] = [
  { id: "fs_craft_fire_flask", name: "불씨 병", ingredients: [{ itemId: "item_fs_wisp_ember", count: 1 }, { itemId: "item_fs_spider_silk", count: 1 }],
    outputItemId: "item_fs_fire_flask", outputCount: 2, goldCost: 10, pitch: "푸른 불씨 하나에 거미 비단 하나.\n비단으로 감싸 병에 넣으면 불씨 병 둘이다." },
  { id: "fs_craft_antidote", name: "해독초", ingredients: [{ itemId: "item_fs_venom_sac", count: 1 }],
    outputItemId: "item_antidote", outputCount: 2, goldCost: 0, pitch: "독 주머니 하나면 해독초 둘.\n독을 알아야 독을 푼다." },
  { id: "fs_craft_potion", name: "회복약", ingredients: [{ itemId: "item_fs_wolf_hide", count: 1 }, { itemId: "item_fs_spider_silk", count: 1 }],
    outputItemId: "item_potion", outputCount: 2, goldCost: 20, pitch: "늑대 가죽 하나에 거미 비단 하나.\n가죽 기름으로 약을 달이면 회복약 둘." },
  { id: "fs_craft_tonic", name: "투지 강장제", ingredients: [{ itemId: "item_fs_wolf_fang", count: 2 }, { itemId: "item_fs_wisp_ember", count: 1 }],
    outputItemId: "item_fs_tonic", outputCount: 1, goldCost: 30, pitch: "늑대 송곳니 둘에 푸른 불씨 하나.\n갈아서 달이면 투지 강장제." },
  { id: "fs_craft_star_scent", name: "별빛 향 주머니", ingredients: [{ itemId: "item_fs_spider_silk", count: 2 }, { itemId: "item_fs_wisp_ember", count: 1 }],
    outputItemId: "item_fs_star_scent", outputCount: 1, goldCost: 40, pitch: "거미 비단 둘에 푸른 불씨 하나.\n짐승 코를 무디게 하는 향 주머니." },
];

const itemName = (project: Project, id: string): string => project.database.items.find((i) => i.id === id)?.name ?? id;

function recipeOption(project: Project, r: Recipe): Option {
  const need = r.ingredients.map((g) => `${itemName(project, g.itemId)}${g.count > 1 ? ` ${g.count}` : ""}`).join("·");
  const enough = all(...r.ingredients.map((g) => has(g.itemId)));
  const out = `${itemName(project, r.outputItemId)}${(r.outputCount ?? 1) > 1 ? ` ${r.outputCount}개` : ""}`;
  return {
    text: `${out} ← ${need}${r.goldCost ? ` + ${r.goldCost}G` : ""}`,
    enableWhen: enough,
    disabledText: `${need}${r.goldCost ? ` · ${r.goldCost}G` : ""} 가 모자라다`,
    branch: [
      say(NINA, r.pitch),
      { kind: "craftRecipe", recipeId: r.id, resultVariableId: RESULT } satisfies Command,
      fork(varCond(RESULT, "==", 1), [se("cc0-se-osx-tools-02"), narrate(`「${out}」을 받았다.`)], [say(NINA, `${need}${r.goldCost ? `에 ${r.goldCost}G` : ""}가 다 있어야 해.\n모자라면 숲에서 더 모아 와.`)]),
      gotoLabel("fs_craft_menu"),
    ],
  };
}

export function buildWorkshop(project: Project, exec: Exec): void {
  const built = exec(project, "build_hand_interior_room", {
    mapId: FS_WORKSHOP_ID, name: "아스텔 · 니나의 공방", ceiling: "wood",
    layout: { rooms: [{ kind: "alchemy", w: 7, h: 6 }, { kind: "forge", w: 6, h: 5 }, { kind: "storeroom", w: 5, h: 5 }], seed: 9, variant: 0, styleVariant: "A" },
  });
  const room = mustMap(project, FS_WORKSHOP_ID);
  room.bgm = { mode: "custom", resourceId: "cc0-bgm-rtp-caf-001" };
  const exitsRaw = (built as { exits?: { x: number; y: number; width?: number }[] } | undefined)?.exits ?? [];
  const exit = exitsRaw[0];
  if (!exit) throw new Error("[fallen-world] 공방 실내 출구가 없다");
  const exitCell = { x: exit.x + Math.floor(((exit.width ?? 1) - 1) / 2), y: exit.y };
  project.system.craftRecipes = [...(project.system.craftRecipes ?? []).filter((r) => !FS_WORKSHOP_RECIPES.some((w) => w.id === r.id)),
    ...FS_WORKSHOP_RECIPES.map(({ pitch: _p, ...r }) => r)];
  if (!project.variables.some((v) => v.id === RESULT)) project.variables.push({ id: RESULT, name: "공방: 방금 조합 성공(1)" });
  const menu: Command[] = [
    label("fs_craft_menu"),
    say(NINA, "뭘 만들까? 재료는 네 가방에서 꺼낸다."),
    choices([...FS_WORKSHOP_RECIPES.map((r) => recipeOption(project, r)), { text: "그만둔다", branch: [say(NINA, "숲에서 주운 건 버리지 말고 가져와.")] }],
      [say(NINA, "숲에서 주운 건 버리지 말고 가져와.")]),
  ];
  putEvent(room, "ev_fs_workshop_nina", NINA, { x: exitCell.x, y: exitCell.y - 4 }, [
    page("ev_fs_workshop_nina_first", "첫 만남", [], [
      say(NINA, "어서 와. 여긴 재료 공방이야.\n숲에서 주운 송곳니·가죽·비단·불씨를 가져오면 쓸 물건으로 바꿔 줘."),
      say(NINA, "가방 메뉴 「조합」에서도 두 가지는 직접 섞을 수 있어.\n셋 넘게 드는 건 내 손이 필요하고."),
      { kind: "setSelfSwitch", key: "A", value: true } satisfies Command,
      ...menu,
    ], { graphic: chipGraphic("tex_easyrpg_charset_people5", 1), trigger: { kind: "action" } }),
    page("ev_fs_workshop_nina_again", "다시", [{ kind: "selfSwitch", key: "A", value: true } satisfies Condition], menu,
      { graphic: chipGraphic("tex_easyrpg_charset_people5", 1), trigger: { kind: "action" } }),
  ]);
  room.events.push({ id: EXIT_MARK, name: "공방 출구 자리", x: exitCell.x, y: exitCell.y, trigger: { kind: "action" }, commands: [], pages: [] } satisfies GameEvent);
}

const EXIT_MARK = "ev_fs_workshop_exit_mark";

/** buildWorkshop 이 남긴 실내 출구 칸(표식은 여기서 걷는다). */
export function workshopExit(project: Project): Cell {
  const room = mustMap(project, FS_WORKSHOP_ID);
  const mark = room.events.find((e) => e.id === EXIT_MARK);
  if (!mark) throw new Error("[fallen-world] 공방 출구 표식이 없다 — buildWorkshop 을 먼저 부른다");
  room.events = room.events.filter((e) => e !== mark);
  return { x: mark.x, y: mark.y };
}

/** 왕도 문 → 공방 입구(fallenTownInteriors 와 같은 부딪힘 문: 바깥 트리거는 문 칸, 나오면 문 앞). */
export function linkWorkshopDoor(project: Project, exec: Exec, hubId: string, door: Cell, exitCell: Cell): void {
  exec(project, "create_transfer_pair", { a: { mapId: hubId, x: door.x, y: door.y + 1, doorAt: door }, b: { mapId: FS_WORKSHOP_ID, x: exitCell.x, y: exitCell.y } });
}
