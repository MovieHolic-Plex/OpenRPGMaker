// 실내 공간 검사는 짓기를 막지 않는다 — 2026-11-11 map-vqa 깔기 24판: 실내 요청 10가지의 첫 make_place 거절이 모두 공간 검사였다
// («under-furnished … at least 0.18»). 손으로 지은 견본 방 87개의 59% 가 같은 문턱에 못 미친다(openwiki/assistant-v2.md 같은 날 절).
// 깔 수 있는 배치는 깔고, 성긴 방은 결과의 알림으로 남긴다. 깔개로 놓은 요청 물건은 놓인 것이다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { ToolContext } from "@/editor/tools/types";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";

const SLOW = 120_000;
type Reply = { ok?: boolean; summary?: string; warnings?: string[]; mapIds?: string[] };

/** 그 판에서 «under-furnished» 로 거절된 첫 호출 그대로(창고 45칸에 선 물건 3개 = 칸당 0.07). */
const WEAPON_SHOP = {"type": "interior", "name": "무기 가게", "mapId": "", "layout": {"map": {"w": 17, "h": 16}, "landmark": {"id": "counter 3x1", "x": 7, "y": 9, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "계산대", "wall": ""}, "outer_wall": {"material": "stone", "path": [[0, 0], [16, 0], [16, 15], [0, 15], [0, 0]]}, "walls": [{"id": "back", "material": "stone", "thickness": 1, "stub": false, "path": [[0, 6], [16, 6]], "purpose": "판매실과 창고 구분"}], "doors": [{"wall": "back", "x": 12, "y": 6, "width": 1, "piece": "", "purpose": "창고 출입"}], "rooms": [{"id": "storage", "at": [3, 4], "floor": "boards", "purpose": "무기 재고 창고", "role": "side", "landmark": "sword rack", "stairs": "none", "repeat": false, "jo": 0}, {"id": "shop", "at": [3, 11], "floor": "plank", "purpose": "무기 판매와 진열", "role": "main", "landmark": "counter 3x1", "stairs": "none", "repeat": false, "jo": 0}], "wall_items": [{"id": "sword rack", "x": 2, "y": 3, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "재고 검", "wall": "outer"}, {"id": "weapon rack", "x": 5, "y": 1, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "무기 보관", "wall": "outer"}, {"id": "shield", "x": 8, "y": 1, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "방패 보관", "wall": "outer"}, {"id": "weapon rack", "x": 2, "y": 7, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "무기 진열", "wall": "back"}, {"id": "shield rack", "x": 5, "y": 7, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "방패 진열", "wall": "back"}], "rails": [], "regions": [], "openings": [], "entrance": {"x": 8, "y": 15}, "carpets": [], "daises": [], "floor_zones": [], "objects": [{"id": "weapon crate", "x": 4, "y": 4, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "재고 상자"}, {"id": "barrel", "x": 7, "y": 4, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "창고 통"}, {"id": "display 2x1", "x": 2, "y": 10, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "무기 진열대"}, {"id": "armor stand", "x": 14, "y": 10, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "갑옷 진열"}, {"id": "weapon barrel", "x": 2, "y": 13, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "무기 진열"}, {"id": "display 2x1", "x": 12, "y": 12, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "상품 진열대"}], "required": [{"ask": "계산대", "ids": ["counter 3x1"], "missing": ""}, {"ask": "진열대", "ids": ["display 2x1"], "missing": ""}]}};
/** 깔개(rug red)를 carpets 로 깔고 required 에 적은 알현실 — «붉은 융단이 놓이지 않았다» 와 0.14 < 0.18 로 거절됐다. */
const THRONE_ROOM = {"type": "interior", "name": "알현실", "mapId": "", "layout": {"map": {"w": 13, "h": 11}, "landmark": {"id": "throne", "x": 5, "y": 3, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "붉은 융단 끝 왕좌", "wall": ""}, "outer_wall": {"material": "marblewall", "path": [[0, 0], [12, 0], [12, 10], [0, 10], [0, 0]]}, "walls": [], "doors": [], "rooms": [{"id": "hall", "at": [6, 7], "floor": "marble", "purpose": "왕의 알현실", "role": "main", "landmark": "throne", "stairs": "none", "repeat": false, "jo": 0}], "wall_items": [{"id": "banner red", "x": 3, "y": 1, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "왕실 깃발", "wall": "outer"}, {"id": "banner red", "x": 9, "y": 1, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "왕실 깃발", "wall": "outer"}], "rails": [], "regions": [], "openings": [], "entrance": {"x": 6, "y": 10}, "carpets": [{"id": "rug red", "x": 5, "y": 5, "w": 3, "h": 5}], "daises": [], "floor_zones": [], "objects": [{"id": "brazier", "x": 3, "y": 3, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "왕좌 화로"}, {"id": "brazier", "x": 9, "y": 3, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "왕좌 화로"}, {"id": "column marble", "x": 3, "y": 6, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "기둥"}, {"id": "column marble", "x": 9, "y": 6, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "기둥"}, {"id": "statue", "x": 1, "y": 4, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "조각상"}, {"id": "statue", "x": 11, "y": 4, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "조각상"}, {"id": "tall vase red", "x": 1, "y": 8, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "장식"}, {"id": "tall vase red", "x": 11, "y": 8, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "장식"}, {"id": "royal chest", "x": 2, "y": 7, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "왕실 상자"}, {"id": "royal chest", "x": 10, "y": 7, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "왕실 상자"}], "required": [{"ask": "왕좌", "ids": ["throne"], "missing": ""}, {"ask": "붉은 융단", "ids": ["rug red"], "missing": ""}]}};

function turn(task: string) {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project } as never, emit: () => {}, record: () => {}, sideChat: async () => JSON.stringify({ score: 7, majors: [] }), checkpoint: async () => {} } as unknown as PiAssistantV2Env;
  const tools = createV2Tools(env, new V2Session());
  const call = async (name: string, args: unknown): Promise<Reply> => {
    const res = await tools.find((t) => t.name === name)!.execute(`c-${name}`, args);
    return JSON.parse((res.content as { type: string; text?: string }[]).find((c) => c.type === "text")!.text!) as Reply;
  };
  return { ctx, call };
}

describe("실내 공간 검사 — 알리되 막지 않는다", () => {
  it("성긴 창고가 있는 무기 가게 배치는 깔리고, 성긴 방은 방 크기에 맞는 문턱과 함께 알림으로 남는다", async () => {
    const t = turn("무기 가게 실내 맵을 만들어 줘. 계산대와 진열대가 있어야 해.");
    const made = await t.call("make_place", WEAPON_SHOP);
    expect(made.ok, made.summary).toBe(true);
    expect(made.summary).toContain("laid your layout exactly");
    const map = t.ctx.project.maps[made.mapIds![0]!]!;
    expect([map.width, map.height]).toEqual([17, 16]);
    const open = (made.warnings ?? []).filter((w) => w.startsWith("open (the room is laid"));
    expect(open.some((w) => w.includes('room "storage" is under-furnished') && w.includes("at least 0.12"))).toBe(true);
    expect(open.some((w) => w.includes('room "shop" is under-furnished') && w.includes("at least 0.08"))).toBe(true);
    expect(JSON.stringify(made.warnings)).not.toContain("0.18");
  }, SLOW);

  it("깔개로 깐 «붉은 융단» 은 요청한 물건으로 센다 — 알현실이 한 번에 깔린다", async () => {
    const t = turn("왕의 알현실을 만들어 줘. 붉은 융단 끝에 왕좌가 있어야 해.");
    const made = await t.call("make_place", THRONE_ROOM);
    expect(made.ok, made.summary).toBe(true);
    expect(JSON.stringify(made)).not.toContain("but they are not placed");
  }, SLOW);
});
