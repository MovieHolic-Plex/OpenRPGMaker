import type { ChatRequest } from "@/ai/llmClient";
import { composeSystemPrompt } from "@/ai/systemPromptEnvelope";
import { describeChipsetTile, tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import { asPlacementFacing, asPlacementZone, PLACEMENT_FACINGS, PLACEMENT_ZONES } from "@/project/placementSurface";
import type { SectionStructureKitDef, TilesetDef, StructureKitAiMeta, TileGroupRole, StructureGrowthAxis, PlacementSurfaceCondition } from "@/project/types";
import { randomUuid } from "@/util/id";
const AI_ROLES: readonly TileGroupRole[] = ["building", "castle", "fence", "roof", "terrain", "water", "wall", "prop"];
const GROWTH_AXES: readonly StructureGrowthAxis[] = ["horizontal", "vertical", "both"];
export function buildAiMetaDraftPrompt(
  kit: SectionStructureKitDef,
  tileset: TilesetDef,
  existingNames: readonly string[],
): string {
  const used = collectUsedTiles(kit);
  const legend = [...used]
    .sort((a, b) => a - b)
    .map((tile) => {
      // describeChipsetTile 의 label/aiLabel 은 AI 내부용 영문("Wood door top")이라 한글 단서가
      // 없다 — tileDisplayLabelForIndex 의 한글 표시명("116 나무 문 상")을 앞에 붙여야 실제로
      // "사람이 읽는 라벨"이 된다. aiLabel 은 배치 힌트(예: "146 바로 위")로 그대로 덧붙인다.
      const readable = tileDisplayLabelForIndex(tile);
      const described = describeChipsetTile(tile);
      return `  ${readable}${described.aiLabel ? ` (${described.aiLabel})` : ""}`;
    })
    .join("\n");

  const matrix = kit.rows
    .map((row) => row.tiles.map((tile) => (tile === TILE.EMPTY ? "." : String(tile))).join(" "))
    .join("\n");

  return [
    `타일셋: ${tileset.name}`,
    `구조물 이름: ${kit.name ?? "구조물"}`,
    `크기: ${kit.width}×${kit.height}`,
    "",
    "타일 행렬(하층):",
    matrix,
    "",
    "타일 뜻:",
    legend,
    "",
    `이미 쓰는 이름(중복 피할 것): ${existingNames.join(", ") || "없음"}`,
    "",
    "이 구조물의 description(무엇인지), placementRules(어디에 어떻게 놓는지),",
    `tags(검색어 배열), role(${AI_ROLES.join("|")}), repeatability(repeat|fixed),`,
    `growthAxis(${GROWTH_AXES.join("|")}), layerHome(lower|upper|perCell), themes(어울리는 테마 배열)를`,
    "JSON 한 덩어리로만 답하라. repeatability 는 가로로 이어 찍어도 되면 repeat, 한 채로 완결이면 fixed.",
    "growthAxis 는 **무한히 이어붙여도 그림이 성립하는 방향**이다 — 벽은 높이로 쌓으면 vertical,",
    "울타리·성벽은 horizontal, 바닥 무늬처럼 사방으로 이어지면 both. 집·우물같이 한 채로 끝나는 것은 생략해라.",
    "layerHome 은 바닥에 깔리면 lower, 사람 위로 덮이는 지붕·나뭇잎은 upper, 섞여 있으면 perCell.",
    "",
    "추가로 placement 배열을 낼 수 있다 — 이것은 산문이 아니라 **편집기가 실제로 검사하는 조건**이다.",
    `각 항목은 {zone, facing, strength}. zone ∈ ${PLACEMENT_ZONES.join("|")},`,
    `facing ∈ ${PLACEMENT_FACINGS.join("|")}(zone=againstWall 에서만 의미), strength ∈ hard|soft.`,
    "확실하지 않으면 placement 를 아예 빼라 — 틀린 hard 조건은 시공을 막아 버린다.",
  ].join("\n");
}

/** 초안 응답 → 메타. origin 은 언제나 "ai" 다 — 사람이 수락해야 "user" 가 된다. */
export function parseAiMetaDraft(text: string, allocateId: () => string = randomUuid): StructureKitAiMeta | null {
  let parsed: unknown;
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const description = typeof record.description === "string" ? record.description : "";
  const placementRules = typeof record.placementRules === "string" ? record.placementRules : "";
  // 공백뿐인 문자열은 "내용 있음"으로 치지 않는다 — 그렇지 않으면 모델이 빈 프롬프트를
  // 돌려줘도 이 함수가 non-null 을 반환해 session.draft 를 덮어써, 사람이 요청 전에
  // 이미 입력해 두었던 값(반복·분류 포함)을 조용히 지워 버린다.
  if (!description.trim() && !placementRules.trim()) return null;

  const role = AI_ROLES.find((candidate) => candidate === record.role);
  const repeatability = record.repeatability === "repeat" || record.repeatability === "fixed"
    ? record.repeatability
    : undefined;
  const growthAxis = GROWTH_AXES.find((candidate) => candidate === record.growthAxis);
  const layerHome = record.layerHome === "lower" || record.layerHome === "upper" || record.layerHome === "perCell"
    ? record.layerHome
    : undefined;
  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === "string")
    : undefined;
  const themes = Array.isArray(record.themes)
    ? record.themes.filter((theme): theme is string => typeof theme === "string" && theme.trim().length > 0)
    : undefined;
  const placement = parseAiPlacementConditions(record.placement, allocateId);

  return {
    description,
    placementRules,
    ...(placement.length > 0 ? { placement } : {}),
    ...(tags && tags.length > 0 ? { tags } : {}),
    ...(themes && themes.length > 0 ? { themes } : {}),
    ...(role ? { role } : {}),
    ...(!growthAxis && repeatability ? { repeatability } : {}),
    ...(growthAxis ? { growthAxis } : {}),
    ...(layerHome ? { layerHome } : {}),
    origin: "ai",
  };
}

/**
 * 모델이 낸 배치 조건 파싱 — 아는 값만 통과시키고 나머지는 조용히 버린다.
 * 모르는 zone 을 억지로 매핑하지 않는 이유: 틀린 hard 조건은 시공을 **막으므로**,
 * "조건이 없다"보다 "엉뚱한 조건이 걸렸다"가 훨씬 나쁘다.
 */
function parseAiPlacementConditions(value: unknown, allocateId: () => string): PlacementSurfaceCondition[] {
  if (!Array.isArray(value)) return [];
  const parsed: PlacementSurfaceCondition[] = [];
  for (const entry of value.slice(0, 4)) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const zone = asPlacementZone(record.zone);
    if (!zone) continue;
    const facing = zone === "againstWall" ? asPlacementFacing(record.facing) : undefined;
    parsed.push({
      id: `pc_${allocateId()}`,
      strength: record.strength === "soft" ? "soft" : "hard",
      zone,
      ...(facing && facing !== "any" ? { facing } : {}),
    });
  }
  return parsed;
}

export function collectUsedTiles(kit: SectionStructureKitDef): Set<number> {
  const used = new Set<number>();
  for (const row of kit.rows) {
    for (const tile of row.tiles) if (tile !== TILE.EMPTY) used.add(tile);
    for (const tile of row.upperTiles ?? []) if (tile !== TILE.EMPTY) used.add(tile);
  }
  return used;
}

export function buildStructureKitAiRequest(kit: SectionStructureKitDef, tileset: TilesetDef, existingNames: readonly string[], memorySection?: string): ChatRequest {
  return {
      messages: [
        {
          role: "system",
          // 공용 봉투 경유. includePolicy 는 끈다 — 산출물이 JSON 한 덩어리라 마무리 톤 규칙이 방해된다.
          // 성향은 켠다: 구조물 이름·배치 설명의 어투가 사람 취향을 따라야 한다.
          content: composeSystemPrompt({
            surface: "structure-kit",
            body:
              "너는 2D 타일 RPG 편집기의 구조물 어휘 사서다."
              + " 주어진 타일 행렬을 보고 이 구조물이 무엇이고 어디에 놓아야 하는지 기술한다."
              + " JSON 한 덩어리로만 답하고 다른 말은 붙이지 않는다.",
            includeMemory: true,
            memorySection,
          }),
        },
        { role: "user", content: buildAiMetaDraftPrompt(kit, tileset, existingNames) },
      ],
  };
}
