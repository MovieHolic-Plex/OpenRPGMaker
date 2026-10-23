// 던전 키트 어댑터 능력표(2026-10-15) — 칩셋마다 「어떤 던전 종류를 지을 수 있나」를 한곳에 적는다.
// 규칙: 어댑터가 못 지으면 **거절**하고 가장 가까운 지원 종류를 권한다. 다른 칩셋 조각으로 말없이 바꿔 칠하지 않는다.
// 이 표가 도구 설명·라우팅·거절 문구·위키의 정본이다(손으로 문서에 옮기지 말 것).
import type { TilesetDef } from "@/project/types";
import { MONSTER_KITS, isMonsterSheet } from "./monster/monsterAdapter";
import type { DungeonType } from "./types";
import { DUNGEON_TYPES } from "./types";

export type AdapterId = "beodeul" | "monster" | "gothic" | "joseon" | "wizarding" | "pirate" | "prehistoric" | "desert-east" | "none";

export interface AdapterCaps {
  readonly id: AdapterId;
  readonly label: string;
  /** ready = 이 어댑터가 실제로 던전을 짓는다. stub = 아직 못 짓는다(능력표만). */
  readonly status: "ready" | "stub";
  readonly families: readonly string[];
  /** 지을 수 있는 종류 → 한 줄 설명(변형은 `type:variant`). stub 은 비어 있다. */
  readonly supports: Readonly<Record<string, string>>;
  /** 못 짓는 종류 → 이유(거절 문구에 쓴다). 없으면 일반 문구. */
  readonly reasons: Readonly<Partial<Record<DungeonType, string>>>;
  /** stub: 칩셋에 이미 있는 던전 관련 조각(다음 어댑터가 쓸 재료) */
  readonly found?: readonly string[];
  /** stub: 어댑터를 만들려면 모자란 그림 */
  readonly missingArt?: readonly string[];
}

const NOT_YET = "이 칩셋에는 던전 어댑터가 아직 없다";

export const ADAPTERS: readonly AdapterCaps[] = [
  {
    id: "beodeul", label: "버들항(beodeul_city, oprn-atlas)", status: "ready", families: ["oprn-atlas"],
    supports: {
      catacomb: "이끼 낀 회색 석벽 지하묘지·납골당(방+통로 나무)", castle: "성·요새(대전·병영·감옥·옥좌의 방)", labyrinth: "폭 3 통로 미궁(두꺼운 벽)",
      sewer: "하수도·수로(물 막힘, 보행로·다리)", cave: "자연 동굴(불규칙 방+호수)", temple: "고대 유적·폐허 신전(좌우 대칭 열주 홀, 덩굴)",
      mine: "광산 갱도(긴 갱도+채굴장·선로·광차)", volcano: "화산 동굴(용암 못·용암 줄기·다리)",
      ice: "설산·얼음 동굴(눈 바닥·걷는 빙판 호수·얼음 바위)", forest: "숲 던전(나무 벽 사이 숲길·빈터·연못·고목)", swamp: "늪지대(늪물 사이 둔덕·널판 길)",
      pyramid: "사막 피라미드·왕묘(사암 회랑·석관 묘실·모래 함정)", tower: "마법탑(서고·마법진, floors+direction up 이면 층을 쌓는다)", otherworld: "마계·이세계(허공에 뜬 땅·돌다리·타락한 수정)",
    },
    reasons: {},
    missingArt: ["선로 타일(가로·세로·모서리·T)", "갱목 지지대(벽 걸이 1×2·바닥 기둥 1×2)", "광석 박힌 벽/바닥", "현무암·재 바닥 변형·현무암 벽 앞면 3h/2h·용암 식은 껍질 가장자리", "갈색 테두리 동굴 천장 오토타일(지금은 회색 석벽 띠)", "테마 그림(dungeon-themes 하네스 굽기 대기)"],
  },
  {
    id: "monster", label: "몬스터 수집 키트(monster_overworld + monster_dungeon, oprn-monster)", status: "ready", families: ["oprn-monster", "oprn-monster-emerald"],
    supports: {
      cave: "마른 갈색 동굴(포켓몬 길 동굴 — monster_overworld cave_wall, 물 없음)",
      "cave:wet": "바다 동굴(젖은 바위 벽 + 물웅덩이 + 바위섬 둑길 — monster_dungeon se_*)",
      volcano: "화산 동굴(화산암 벽 + 용암 + 식은 껍질 다리 — monster_dungeon lv_*)",
      ice: "얼음 동굴(얼음 벽 + 눈 바닥 + 미끄럼 판 — monster_dungeon ic_*)",
      labyrinth: "유적 미궁(얇은 칸막이 미로 — monster_dungeon ru_pb)",
      temple: "유적 신전(열주 홀 + 제단 — monster_dungeon ru_pb·ru_pillar·ru_altar)",
    },
    reasons: {
      catacomb: "몬스터 키트에는 지하묘지 벽·관·감방 그림이 없다(유적 돌담뿐)", castle: "몬스터 키트에는 성 지하 벽·판석 그림이 없다",
      sewer: "몬스터 키트에는 하수도 수로·배수 그림이 없다(바다 물웅덩이는 동굴 전용)", mine: "몬스터 키트에는 선로·갱목·광석 그림이 없다",
    },
    missingArt: ["catacomb/castle/sewer/mine 일체", "마른 동굴 안 물·용암 조각(cave 에 물을 쓰려면 wet 변형)", "유적 신전 안쪽 방 칸막이(지금은 방 둘레 돌담 한 줄)", "화산 제단·보스 연출 조각", "얼음 판 퍼즐 문 조각"],
  },
  {
    id: "gothic", label: "고딕 저택·묘지(gothic_manor, oprn-gothic)", status: "stub", families: ["oprn-gothic"], supports: {},
    reasons: {}, found: ["gm-bld-crypt(지하실 건물)", "gm-tomb-*·gm-grave-*(묘비·무덤 9종)"], missingArt: ["지하 벽 앞면·천장 오토타일", "석관·벽감·감방 실내 조각", "횃불·쇠사슬 벽 걸이"],
  },
  {
    id: "joseon", label: "조선(joseon_baram, oprn-joseon)", status: "stub", families: ["oprn-joseon"], supports: {},
    reasons: {}, found: ["jb-gnf_cave_dark/white/moss(동굴 입구 키트)", "jb-fld_cave_a~c(사냥터 동굴 입구)", "jb_fld_rock32_autotile(바위 오토타일)"], missingArt: ["동굴 벽 앞면·천장", "동굴 바닥 변형", "계단·사다리"],
  },
  {
    id: "wizarding", label: "마법 학교(wizarding_world, oprn-wizard)", status: "stub", families: ["oprn-wizard"], supports: {},
    reasons: {}, found: ["성채 공용 벽·바닥·문", "12공간 기물"], missingArt: ["지하 동굴·지하 감옥 벽 오토타일", "계단 오르내림 조각"],
  },
  {
    id: "pirate", label: "열대 군도·해적 항구(pirate_isles, oprn-pirate)", status: "stub", families: ["oprn-pirate"], supports: {},
    reasons: {}, found: ["pi-floor-cave(동굴 바닥)", "pi-wall-face-cave(동굴 벽 앞면)", "pi-at-wall-cave(동굴 벽 오토타일)", "pi-cave-entrance(동굴 입구)"], missingArt: ["동굴 천장 띠", "호수·물웅덩이 오토타일", "석순·소품"],
  },
  {
    id: "prehistoric", label: "선사 원시 세계(prehistoric, oprn-prehistoric)", status: "stub", families: ["oprn-prehistoric"], supports: {},
    reasons: {}, found: ["ph-cave-mouth(동굴 입구 3종)", "ph-lava-spire(용암 뾰족돌)"], missingArt: ["동굴 벽·바닥·천장 일체", "용암 오토타일"],
  },
  {
    id: "desert-east", label: "사막·동양풍(desert_east, oprn-desert-east)", status: "stub", families: ["oprn-desert-east"], supports: {},
    reasons: {}, found: ["de-wall-tomb(무덤 벽)"], missingArt: ["지하 무덤 바닥·벽·천장 일체"],
  },
  {
    id: "none", label: "그 밖의 칩셋(현대·일본·캠퍼스·SF·전국·하늘섬·설원·업로드 등)", status: "stub", families: [], supports: {},
    reasons: {}, found: [], missingArt: ["던전 조각 일체(벽 앞면·천장·바닥·계단) — 이 칩셋은 던전 장르용이 아니다"],
  },
];

export const adapterCaps = (id: AdapterId): AdapterCaps => ADAPTERS.find((a) => a.id === id)!;

/** 가장 가까운 종류 순서(못 짓는 종류를 대신 권할 때). */
const CLOSEST: Readonly<Record<DungeonType, readonly string[]>> = {
  catacomb: ["castle", "temple", "labyrinth", "cave"], castle: ["catacomb", "temple", "labyrinth", "cave"],
  labyrinth: ["temple", "catacomb", "castle", "cave"], sewer: ["catacomb", "cave:wet", "cave"], cave: ["cave:wet", "volcano", "ice"],
  temple: ["catacomb", "castle", "labyrinth", "cave"], mine: ["cave", "catacomb", "castle"], volcano: ["cave", "cave:wet"], ice: ["cave", "cave:wet"],
  forest: ["cave", "temple"], swamp: ["cave:wet", "cave", "sewer"], pyramid: ["temple", "catacomb", "labyrinth"], tower: ["castle", "temple", "labyrinth"], otherworld: ["volcano", "cave", "labyrinth"],
};

export function adapterSupports(adapter: AdapterCaps, type: DungeonType): boolean {
  return type in adapter.supports || Object.keys(adapter.supports).some((k) => k.startsWith(`${type}:`));
}

export function supportedTypes(adapter: AdapterCaps): DungeonType[] {
  return DUNGEON_TYPES.filter((t) => adapterSupports(adapter, t));
}

/** 못 짓는 종류의 가장 가까운 지원 종류(`type` 또는 `type:variant`), 없으면 null. */
export function closestSupported(adapter: AdapterCaps, type: DungeonType): string | null {
  for (const cand of CLOSEST[type]) { const base = cand.split(":")[0] as DungeonType; if (cand in adapter.supports || (!cand.includes(":") && adapterSupports(adapter, base))) return cand; }
  return null;
}

/** 거절 문구 — 도구·어댑터가 같은 문장을 쓴다. */
export function refusalMessage(adapter: AdapterCaps, type: DungeonType): string {
  const label = adapter.label;
  if (adapter.status === "stub") {
    const found = adapter.found?.length ? ` 이미 있는 재료: ${adapter.found.join(", ")}.` : "";
    const need = adapter.missingArt?.length ? ` 어댑터에 모자란 그림: ${adapter.missingArt.join(", ")}.` : "";
    const ready = ADAPTERS.filter((a) => a.status === "ready").map((a) => `${a.label}: ${supportedTypes(a).join("·")}`).join(" / ");
    return `이 칩셋은 ${type} 을 못 짓는다 — 「${label}」 ${NOT_YET}.${found}${need} 던전을 지을 수 있는 칩셋: ${ready}. 다른 칩셋으로 짓는 것은 사용자 승인(ask_tileset_change)이 필요하다.`;
  }
  const why = adapter.reasons[type] ?? `「${label}」 에 ${type} 그림이 없다`;
  const near = closestSupported(adapter, type);
  const list = supportedTypes(adapter).map((t) => (monsterVariantsText(adapter, t))).join(" · ");
  return `이 칩셋은 ${type} 을 못 짓는다 — ${why}. ${near ? `가장 가까운 지원 종류: ${near.replace(":", " + variant ")}. ` : ""}이 칩셋이 짓는 종류: ${list}. 다른 칩셋으로 바꿔 칠하지 않는다(그림체가 달라진다). 다른 칩셋으로 짓는 것은 사용자 승인(ask_tileset_change)이 필요하다.`;
}

function monsterVariantsText(adapter: AdapterCaps, type: DungeonType): string {
  const variants = Object.keys(adapter.supports).filter((k) => k.startsWith(`${type}:`)).map((k) => k.slice(type.length + 1));
  return variants.length ? `${type}(+${variants.join("/")})` : type;
}

/** 칩셋 → 어댑터. 몬스터 시트는 그룹으로 알아본다(에메랄드 재채색 포함), 버들항은 id. */
export function adapterIdForTileset(ts: TilesetDef | undefined): AdapterId {
  if (!ts) return "none";
  if (ts.id === "beodeul_city") return "beodeul";
  if (isMonsterSheet(ts, "dungeon") || isMonsterSheet(ts, "overworld") || ts.family === "oprn-monster" || ts.family === "oprn-monster-emerald") return "monster";
  const byFamily: Record<string, AdapterId> = { "oprn-gothic": "gothic", "oprn-joseon": "joseon", "oprn-wizard": "wizarding", "oprn-pirate": "pirate", "oprn-prehistoric": "prehistoric", "oprn-desert-east": "desert-east" };
  return (ts.family && byFamily[ts.family]) || "none";
}

/** 몬스터 어댑터가 쓰는 조각표 개수(능력표와 어긋나지 않았는지 검사용). */
export const MONSTER_KIT_KEYS = Object.keys(MONSTER_KITS);

/** 도구 설명에 붙이는 한 덩어리 표. */
export function capabilityTableText(): string {
  return ADAPTERS.map((a) => {
    if (a.status === "stub") return `${a.label}: 아직 못 짓는다(어댑터 없음 — 거절)`;
    return `${a.label}: ${Object.entries(a.supports).map(([k, v]) => `${k}=${v}`).join(" · ")}${Object.keys(a.reasons).length ? ` / 못 지음: ${Object.keys(a.reasons).join("·")}` : ""}`;
  }).join("\n");
}
