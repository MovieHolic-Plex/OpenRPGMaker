// editor/tools/objectGenTool.ts
// generate_missing_object — 지금 맵 칩셋에 없는 기물 하나를 공방(object-gen 실행기)으로 그려 달라고 요청한다(2026-10-21).
// 위키: openwiki/editor-ai-tools.md 「없는 기물 그리기」, openwiki/editor-workshop.md, openwiki/harnesses/map-objects.md.
//
// 도구는 그리지 않는다 — 요청 카드만 돌려준다(Pi 워커에는 화면·IndexedDB 가 없고, 그림 한 판은 4~8분 걸린다).
// 편집기 카드(aiObjectGenCard.ts)가 사용자 자기 AI 계정으로 후보를 그리고, 사용자가 고르거나 사용자가 켠 「알아서 고르기」가
// 검수 통과 후보를 그 맵 칩셋 끝에 굽는다(공방 칸, 이 게임에만 — 스토어·공용 DB 로는 못 나간다). 놓기는 후속 턴의 조수가 한다.
//
// 거르는 것(도구가 직접 거부한다 — 프롬프트만 믿지 않는다):
// - 이미 있는 기물: 이름이 맞는 칩셋 물체·손 도트 실내 가구가 있으면 그 id 를 돌려주며 거부(notThese 로 「봤는데 다르다」를 밝혀야 통과).
// - 사람·동물 캐릭터: 사람은 그리지 않는다(캐릭터 칩은 따로).
// - 지형·바닥·벽 칸: 칸 타일은 이 도구가 아니다(ask_missing_tiles).
// - 16px 이 아닌 칩셋: 공방 격자·굽기가 16px 칸 기준이다.
// - 건물(집·가게·탑…): 건물 외형은 손 도트 건물 킷 영역이다(object-gen 이 아니다).
//
// 크기(칸 수)는 도구가 정한다(2026-10-22): 조수가 준 칸 수를 크기 사전(object-gen footprint.py — 손 도트 실내 v5·버들항 소품 킷 실측)의
// 그 종류 범위로 고치고, 발밑 줄(막힘)과 위로 솟은 줄(캐릭터 위에 그려짐)로 나눈다. 이유는 요청·카드·참고 그림 지시문에 실린다.
import { decideFootprint, FOOTPRINT_GUIDE } from "@/harnesses/_core/workshop/footprint";
import { ATLAS_BIOME_INTERIOR_ID } from "@/project/defaults/atlasBiomeInterior";
import type { Project, TilesetDef } from "@/project/types";
import {
  DEFAULT_RISE, OBJECT_GEN_KINDS, objectGenLimits, type ObjectGenHarness, type ObjectGenKind, type ObjectGenRequest,
} from "@/editor/workshop/objectRequest";
import { LIST_HAND_INTERIOR_PARTS_TOOL } from "./handInteriorTools";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const TILE = 16;

/** 제목 끝 낱말이 사람·동물이면 캐릭터 요청이다(「상인 좌판」처럼 사람 낱말이 앞에 오는 물건은 통과). */
const PERSON_HEAD = /^(사람|캐릭터|주민|행인|npc|병사|경비병?|상인|아이|소녀|소년|노인|할머니|할아버지|남자|여자|기사|마법사|왕|공주|선원|어부|농부|점원|손님|고양이|개|강아지|말|새|몬스터|person|people|character|villager|guard|merchant|npc|cat|dog|horse|monster)$/iu;
/** 제목 끝 낱말이 지형·바닥·벽 칸이면 칸 타일 요청이다(깔개·러그 같은 바닥 무늬 물건은 flat 으로 통과). */
const TERRAIN_HEAD = /^(바닥|돌바닥|마루|벽|벽면|외벽|땅|흙|잔디|풀밭|물|바다|강|호수|길|도로|보도|타일|지형|모래|절벽|천장|지붕|floor|wall|ground|grass|water|road|path|terrain|tile|tiles|ceiling|roof|cliff)$/iu;

/** 3/4 관문 조언 배지가 쓸 종류(object-gate rules.ts 의 종류 중 기물에 해당하는 것). */
const GATE_KINDS = ["tall_furniture", "low_furniture", "seat", "frame", "container", "round_body", "column", "box", "structure", "figure", "organic", "flat", "wall_mounted", "other"] as const;

/**
 * 맵 배경(나라·시대) 한 줄 — 칩셋으로 정한다. 공방 검수가 「1배에서 그 배경의 그 물건으로 읽히나」를 본다.
 * 2026-10-21 VQA: 일본 거리(jp_city)에 부탁한 공중전화 부스가 영국식 빨간 부스로 나왔는데 검수가 화풍만 보고 통과시켰다.
 */
export function objectSetting(tileset: TilesetDef, mapName: string): string {
  const id = tileset.id;
  const where = mapName ? ` · 맵 「${mapName}」` : "";
  const table: readonly [RegExp, string][] = [
    [/^jp_city|^modern_city|^sengoku/u, id.startsWith("sengoku") ? "전국·에도 시대 일본" : "현대 일본 도시(주택가·상점가·역) — 일본에서 실제로 보는 모양"],
    [/^joseon/u, "조선 시대 한국(바람의나라풍)"],
    [/^murim/u, "중국 무협(문파·객잔)"],
    [/^modern_campus/u, "현대 한국·일본 학교"],
    [/^wizarding/u, "서양 마법 학교(고딕 성채)"],
    [/^gothic/u, "고딕 저택·묘지(서양 호러)"],
    [/^sf_|^steampunk/u, id.startsWith("sf_") ? "SF 우주 정거장·네온 거리" : "스팀펑크 서양 도시"],
    [/^desert_east/u, "사막·중동풍 동양"],
    [/^snow_north/u, "북방 설원(북유럽풍)"],
    [/^pirate/u, "열대 군도·해적 항구"],
    [/^sky_island/u, "하늘섬 판타지"],
    [/^prehistoric/u, "선사 시대"],
    [/^monster_|^emerald_|^scarloxy/u, "몬스터 수집 RPG 의 현대 시골 마을"],
    [/^atlas_biome_interior/u, "서양 판타지 중세 마을의 집 안(SFC JRPG)"],
  ];
  const hit = table.find(([pattern]) => pattern.test(id));
  return `${hit ? hit[1] : "서양 판타지 중세 항구 마을(SFC JRPG, 로마·지중해풍)"}${where}`;
}

const words = (text: string): string[] => text.trim().split(/[\s·,/()]+/u).filter(Boolean);
const squash = (text: string): string => text.replace(/[\s·,/()]+/gu, "").toLowerCase();

type Existing = { readonly id: string; readonly name: string; readonly how: string };

/** 이름이 맞는 이미 있는 기물 — 칩셋 구조 킷(어떤 출처든)과 손 도트 실내 가구. 이름 전체 또는 끝 낱말(2글자 이상)이 들어 있으면 맞다. */
function existingMatches(project: Project, tileset: TilesetDef, title: string): Existing[] {
  const full = squash(title);
  const head = words(title).at(-1) ?? "";
  const needles = [full, ...(head.length >= 2 && squash(head) !== full ? [squash(head)] : [])].filter((needle) => needle.length >= 2);
  if (!needles.length) return [];
  const hit = (text: string): boolean => needles.some((needle) => squash(text).includes(needle));
  const out: Existing[] = [];
  for (const kit of tileset.structureKits ?? []) {
    if (kit.width > 8 || kit.height > 8) continue; // 건물·구역 킷은 기물이 아니다
    if (hit(kit.name ?? "") || hit(kit.id)) {
      out.push({ id: kit.id, name: kit.name ?? kit.id, how: kit.learnedFrom === "workshop" || kit.learnedFrom === "pack-preset" ? "stamp_tileset_object" : "stamp_object(kit:id) 또는 stamp_tileset_object" });
    }
  }
  if (tileset.id === ATLAS_BIOME_INTERIOR_ID) {
    for (const needle of new Set([title.trim(), head])) {
      if (!needle) continue;
      try {
        const listed = LIST_HAND_INTERIOR_PARTS_TOOL.run(project, { query: needle, limit: 12 });
        const objects = (listed.data as { objects?: { id: string; ko?: string; hit?: string }[] } | undefined)?.objects ?? [];
        for (const object of objects) {
          if (object.hit && object.hit.split("/")[0] !== object.hit.split("/")[1]) continue;
          if (!hit(object.ko ?? "") && !hit(object.id)) continue;
          if (!out.some((row) => row.id === object.id)) out.push({ id: object.id, name: object.ko ?? object.id, how: "build_hand_interior_room objects[].id (이미 있는 방이면 같은 방을 다시 지으며 더한다)" });
        }
      } catch { /* 부품 사전을 못 읽어도 칩셋 킷 검사는 남는다 */ }
    }
  }
  return out.slice(0, 8);
}

function intArg(value: unknown, name: string, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ToolError(`${name} 는 ${min}~${max} 정수여야 한다: ${String(value)}`, { code: "invalid-args" });
  }
  return value;
}

const generateMissingObject: ToolDefinition = {
  name: "generate_missing_object",
  description:
    "지금 맵의 칩셋에 **없는 기물(물건·가구·소품) 하나**를 사용자 AI 계정으로 새로 그려 그 칩셋에 넣자고 요청한다. 화면에 카드가 뜨고, 공방이 그 칩셋의 색·화풍으로 후보 1~3장을 그려 검수한다. "
    + "사용자가 하나를 고르면(또는 사용자가 켜 둔 「알아서 고르기」가 검수 통과 후보를 고르면) 그 칩셋 끝에 공방 칸으로 들어가고, 물체 id(workshop:…)와 놓을 자리가 후속 요청으로 온다 — 그때 stamp_tileset_object 로 놓는다. "
    + "**먼저 있는 것을 찾아라**: list_tileset_objects·list_spatial_designs(kind:object)·list_hand_interior_parts(실내)로 찾아 비슷한 게 있으면 그것을 쓰고 이 도구는 부르지 마라. "
    + "이름이 맞는 기물이 이미 있으면 이 도구가 그 id 를 돌려주며 거부한다(봤는데 정말 다른 물건이면 notThese 에 그 id 를 적어 다시 부른다). "
    + "사람·동물·캐릭터는 그리지 않는다(거부). 바닥·벽·물·길 같은 지형 칸도 이 도구가 아니다(ask_missing_tiles). 건물(집·가게·탑)도 아니다(거부). 16px 칩셋 맵만. "
    + `크기: ${FOOTPRINT_GUIDE} 이 도구가 크기 사전으로 칸 수를 확인·조정하고 이유를 돌려준다(큰 물건 5×4 노점·4×3 분수·3×2 짐마차까지). `
    + "없는 물건이 여럿이면 같은 턴에 물건마다 한 번씩 불러라 — 모두 공방 작업 줄에 함께 서서 동시에 그려진다(하나씩 기다리지 않는다). "
    + "다 부른 뒤에는 더 칠하지 말고 이 턴을 끝내라.",
  mode: "read",
  domains: ["core"],
  fillsCurrentMapId: true,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "놓을 맵(비우면 지금 보는 맵)" },
      title: { type: "string", description: "기물 이름, 짧은 한국어 명사구(예: 나무 벌통, 공중전화 부스, 놋쇠 혼천의). 사람·지형이면 거부된다" },
      description: { type: "string", description: "어떻게 생겼는지 한두 문장(재료·색·특징). 그 맵 배경(나라·시대)에서 실제로 보는 모양으로 쓴다 — 예: 조선 마을의 우물은 돌을 두른 우물이지 서양식 지붕 달린 우물이 아니다. 사용자가 다른 나라 모양을 떠올리게 하는 말을 써도 그 배경의 모양으로 바꿔 쓴다. 1배에서 그 물건임을 알아보게 하는 특징 2~3개를 적는다. 칩셋 화풍에 맞춰 그린다" },
      objectKind: { type: "string", enum: OBJECT_GEN_KINDS as unknown as string[], description: "놓는 방식: floor 바닥에 세움(발밑 막힘) · wall 북쪽 벽 앞 가구 · hang 벽에 거는 것 · flat 밟고 지나가는 바닥 무늬(깔개)" },
      tilesW: { type: "integer", minimum: 1, maximum: 6, description: "가로 칸 수(실내 가구는 4까지). 사람은 1칸 폭. 비우면 크기 사전의 흔한 폭" },
      cellsTall: { type: "integer", minimum: 1, maximum: 6, description: "그림 전체 키(칸) = 발밑 줄 + 위로 솟은 줄. 사람은 2칸 키. 예: 짐마차 3×2, 분수 4×3, 나무 2×3, 노점 5×4, 상자 1×1, 벤치 2×1. 비우면 크기 사전의 흔한 키" },
      tilesH: { type: "integer", minimum: 1, maximum: 4, description: "(선택) 발밑(막히는) 줄 수. 비우면 도구가 종류에 맞게 나눈다(깊은 물건은 발밑을, 키 큰 물건은 위를 늘린다)" },
      rise: { type: "integer", minimum: 0, maximum: 64, description: "(옛 방식, 선택) 발밑 위로 솟는 px. cellsTall 을 쓰면 비운다" },
      gateKind: { type: "string", enum: GATE_KINDS as unknown as string[], description: "3/4 검사 종류(선택): tall_furniture 키 큰 가구·부스 · low_furniture 탁자·침대 · seat 의자 · frame 틀·걸대 · container 입구 있는 그릇(항아리·어항·우물) · round_body 통·북 · column 기둥·석등 · box 상자·궤·벌통 · structure 작은 건물·문 · figure 조각상 · organic 식물·바위 · flat 바닥 무늬 · wall_mounted 벽 걸이 · other" },
      base: {
        type: "object",
        properties: { x: { type: "integer" }, y: { type: "integer" } },
        required: ["x", "y"],
        additionalProperties: false,
        description: "놓을 자리 — 물체가 땅에 닿는 맨 아래 줄의 왼쪽 칸. 사용자가 자리를 말했으면 그 칸",
      },
      need: { type: "string", description: "사용자의 원래 요청을 한 문장으로(후속 요청에 그대로 돌려준다)" },
      notThese: { type: "array", items: { type: "string" }, description: "이미 있는 비슷한 기물을 봤지만 요청과 다른 물건이라 쓰지 않는 id 들(거부 메시지에 나온 id)" },
    },
    required: ["title", "description", "objectKind", "need"],
    additionalProperties: false,
  },
  invalidArgsExample: { title: "나무 벌통", description: "짚으로 엮은 둥근 벌통이 나무 받침대 위에 놓여 있다.", objectKind: "floor", tilesW: 1, tilesH: 1, base: { x: 12, y: 9 }, need: "광장 옆 풀밭에 벌통을 놔 줘." },
  run(project, args): ToolExecResult {
    const map = requireMap(project, String(args.mapId ?? ""));
    const tileset = project.tilesets[map.tilesetId];
    if (!tileset) throw new ToolError(`맵 ${map.id} 의 칩셋 ${map.tilesetId} 이 프로젝트에 없다.`, { code: "not-found", mapId: map.id });
    if (tileset.tileSize !== TILE) {
      throw new ToolError(`공방은 16px 칩셋에만 그려 넣는다(이 맵 칩셋 ${tileset.id} 은 ${tileset.tileSize}px). 있는 기물로 가장 가까운 대안을 쓰고 그렇다고 말하라.`, { code: "unsupported-tileset", mapId: map.id });
    }
    const title = String(args.title ?? "").trim();
    const description = String(args.description ?? "").trim();
    const need = String(args.need ?? "").trim();
    if (!title || !description || !need) throw new ToolError("title·description·need 를 채워라.", { code: "invalid-args" });
    const head = words(title).at(-1) ?? title;
    if (PERSON_HEAD.test(head)) {
      throw new ToolError(`「${title}」은(는) 사람·동물이다 — 이 도구는 캐릭터를 그리지 않는다. 사람은 캐릭터 칩(이벤트 그림)으로 놓는다(place_npc 등).`, { code: "people-not-generated" });
    }
    if (TERRAIN_HEAD.test(head)) {
      throw new ToolError(`「${title}」은(는) 지형·바닥·벽 칸이다 — 이 도구는 기물 하나만 그린다. 칸 타일이 없으면 ask_missing_tiles 로 묻는다.`, { code: "terrain-not-object" });
    }
    const objectKind = (OBJECT_GEN_KINDS as readonly string[]).includes(String(args.objectKind)) ? args.objectKind as ObjectGenKind : null;
    if (!objectKind) throw new ToolError(`objectKind 는 ${OBJECT_GEN_KINDS.join("·")} 중 하나다.`, { code: "invalid-args" });
    const harnessId: ObjectGenHarness = tileset.id === ATLAS_BIOME_INTERIOR_ID ? "interior-props" : "map-objects";
    const limits = objectGenLimits(harnessId);
    const askW = args.tilesW === undefined || args.tilesW === null ? undefined : intArg(args.tilesW, "tilesW", 1, limits.maxW, 1);
    const askFoot = args.tilesH === undefined || args.tilesH === null ? undefined : intArg(args.tilesH, "tilesH", 1, limits.maxH, 1);
    const askRise = args.rise === undefined || args.rise === null ? undefined : intArg(args.rise, "rise", 0, limits.maxRise, 0);
    const askTall = args.cellsTall === undefined || args.cellsTall === null ? undefined
      : intArg(args.cellsTall, "cellsTall", 1, limits.maxTall, 1);
    const tall = askTall ?? (askFoot !== undefined ? askFoot + Math.ceil((askRise ?? DEFAULT_RISE[objectKind]) / TILE) : undefined);
    const decided = decideFootprint(title, description, {
      ...(askW !== undefined ? { w: askW } : {}), ...(tall !== undefined ? { h: tall } : {}), ...(askFoot !== undefined ? { foot: askFoot } : {}),
      maxW: limits.maxW, maxH: limits.maxTall, interior: harnessId === "interior-props",
    });
    if (decided.building) throw new ToolError(`${decided.reason}. 있는 건물 킷(list_tileset_objects·list_spatial_designs)으로 짓는다.`, { code: "building-not-object" });
    const flatKind = objectKind === "flat" || objectKind === "hang";
    // 바닥 무늬·벽 걸이는 발밑/위 구분이 없다 — 그림 전체가 한 덩이(굽기가 통행을 따로 정한다).
    const tilesW = decided.w;
    const tilesH = flatKind ? decided.foot + decided.over : Math.min(limits.maxH, decided.foot);
    const overRows = flatKind ? 0 : decided.foot + decided.over - tilesH;
    // 위 줄 px: 조수가 rise 를 줬고 같은 줄 수면 그 px(정밀), 아니면 결정값.
    const rise = flatKind ? 0 : Math.min(limits.maxRise, askRise !== undefined && Math.ceil(askRise / TILE) === overRows ? askRise : overRows === decided.over ? decided.risePx : overRows * TILE);
    const passage = flatKind ? Array.from({ length: tilesH }, () => ".".repeat(tilesW))
      : [...Array.from({ length: overRows }, () => "*".repeat(tilesW)), ...Array.from({ length: tilesH }, () => "X".repeat(tilesW))];
    const baseArg = args.base as { x?: unknown; y?: unknown } | undefined;
    let base: ObjectGenRequest["base"] = null;
    if (baseArg !== undefined) {
      const x = intArg(baseArg.x, "base.x", 0, map.width - 1, 0), y = intArg(baseArg.y, "base.y", 0, map.height - 1, 0);
      // 위로 솟은 줄까지 맵 안이어야 한다(잘린 나무 꼭대기는 굽기 후에야 보인다).
      if (x + tilesW > map.width || y - (tilesH + overRows - 1) < 0) {
        throw new ToolError(`${tilesW}×${tilesH + overRows}칸 기물(발밑 ${tilesH}줄)이 base (${x},${y}) 에서 맵(${map.width}×${map.height})을 벗어난다.`, { code: "out-of-bounds", mapId: map.id, x, y });
      }
      base = { x, y };
    }
    const notThese = new Set(Array.isArray(args.notThese) ? args.notThese.filter((id): id is string => typeof id === "string") : []);
    const existing = existingMatches(project, tileset, title).filter((row) => !notThese.has(row.id));
    if (existing.length) {
      throw new ToolError(
        `「${title}」과(와) 이름이 맞는 기물이 이 칩셋에 이미 있다 — 새로 그리지 말고 이것을 써라: ${existing.map((row) => `${row.id}(${row.name}) → ${row.how}`).join(" · ")}. `
        + "모두 봤는데 요청과 다른 물건이면 그 id 들을 notThese 에 적어 다시 불러라.",
        { code: "object-exists", mapId: map.id },
      );
    }
    const gateKind = typeof args.gateKind === "string" && (GATE_KINDS as readonly string[]).includes(args.gateKind) ? args.gateKind : undefined;
    const request: ObjectGenRequest = {
      kind: "workshop-object-request", harnessId, tilesetId: tileset.id, tilesetName: tileset.name, mapId: map.id,
      title, description, objectKind, tilesW, tilesH, rise, base, need,
      setting: objectSetting(tileset, map.name ?? ""),
      ...(gateKind ? { gateKind } : {}),
      footprint: { cls: decided.cls, passage, top: decided.top, reason: decided.reason, adjusted: decided.adjusted, ...(decided.reference ? {} : { reference: false }) },
    };
    const sizeLine = `크기 ${tilesW}×${tilesH + overRows}칸 = 발밑 ${tilesH}줄(막힘)${overRows ? ` + 위 ${overRows}줄(캐릭터 위에 그려짐${rise !== overRows * TILE ? `, ${rise}px` : ""})` : ""}`
      + `${decided.adjusted.length ? ` — 조정: ${decided.adjusted.join(", ")}` : ""}. 이유: ${decided.reason}`;
    return {
      summary: `「${title}」 그리기 카드를 띄운다(${sizeLine}; 칩셋 ${tileset.id}, 배경 ${request.setting}). 공방 작업 줄에 서서 다른 요청과 함께 그려진다. 후보를 사용자가 고르면 물체 id 가 후속 요청으로 온다 — 없는 물건이 더 있으면 지금 이어서 부르고, 그 밖에는 더 칠하지 말고 그렸다고 말하지 말고 이 턴을 끝내라.`,
      data: request,
    };
  },
};

export const OBJECT_GEN_TOOLS: readonly ToolDefinition[] = [generateMissingObject];
