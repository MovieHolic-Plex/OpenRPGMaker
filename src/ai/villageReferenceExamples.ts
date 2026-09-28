// 마을 시공에 완성 마을 참고 사례를 붙인다 — 사용자 지적(2026-09-28): 「마을도 미리 만든 프리셋을 거의 참고 안 한다」.
//
// 실측(같은 날, 빈 새 프로젝트):
// - 데이터베이스 마을 설계서(villagePresets) 0개 · 기본 설계서 없음 → presetId 경로는 비어 있다.
// - 완성 마을 참고 사례는 약 70곳(regionReferences + 공유)인데, 목록은 옛 세션의 buildSystemPrompt 에만 있고
//   (130,585자 중 93,952자 뒤 — 예산 밖 고정분), Pi 시스템 프롬프트(3,827자)·의도 노트·author_village 결과에는 0곳이다.
// - 마을 계약 실행은 author_village 외 쓰기를 막고, 읽기 도구는 초기 노출에 get_map_region·find_layout_regions 뿐이다.
// 그래서 모델은 「숲마을 만들어줘」에서 굽이숲·강변 숲마을을 한 번도 보지 않고 기본값(12채·강변촌)으로 짓는다.
//
// 여기서는 요청 문장·칩셋으로 참고 사례 몇 곳을 골라 한 줄씩 요약하고, 첫 사례의 미리보기 그림 경로를 준다.
// 좌표 배열을 복사하지 않는다 — 규모(맵 크기·집 수)와 구성(물·절벽·광장·길)의 기준이다.
import { REGION_REFERENCES, PLACE_REFERENCES } from "@/project/regionReferences";
import { sharedRegionReferences } from "@/project/sharedSpatialReferences";
import { defaultOutdoorTilesetId } from "@/project/defaults/forestHarmony";
import { resolveReferenceImageDataUrl } from "@/project/bundledReferenceImages";
import type { Project } from "@/project/types";

const MAX_EXAMPLES = 3;
/**
 * 모델 입력 그림 — 원본 미리보기(976~2400px·0.3~1.4MB) 대신 긴 변 640px·64색 사본을 쓴다.
 * 사본은 scripts/content/prepare-village-reference-previews.mjs 가 만든다. 헤드리스 Pi 는 캔버스가 없어 실행 중에 못 줄인다.
 */
const MODEL_PREVIEW_DIR = "/assets/village-reference-previews/";
export function villageModelPreview(preview: string): string {
  return MODEL_PREVIEW_DIR + preview.slice(preview.lastIndexOf("/") + 1);
}

export interface VillageReferenceExample {
  readonly id: string;
  readonly name: string;
  readonly size: string;
  readonly tilesetId: string;
  readonly houses: number | null;
  readonly rule: string;
  readonly preview: string | null;
}

type Reference = { id: string; name: string; width: number; height: number; tilesetId: string; rules?: readonly string[]; preview?: string;
  regionKind?: string; placeKind?: string };

/** 요청 낱말 → 사례 이름·규칙에서 찾을 낱말. 같은 뜻의 다른 말(바닷가 ↔ 어촌·포구)을 묶는다. */
const TOPICS: readonly (readonly [RegExp, RegExp])[] = [
  [/강|개울|시내|river|stream/iu, /강|개울|시냇|물길|폭포|여울/u],
  // 「호숫가」는 「호수」 글자를 포함하지 않는다(숫≠수) — 따로 적는다.
  [/호수|호숫|못|연못|lake|pond/iu, /호수|호숫|호반|못/u],
  [/바다|바닷|항구|포구|어촌|해안|선착|harbor|coast|sea|fish/iu, /항구|포구|어촌|선착|바다|물굽이|곶/u],
  [/절벽|언덕|산|고원|단구|계단|cliff|hill|mountain/iu, /절벽|언덕|고원|단구|계단|산촌|층바위/u],
  [/숲|나무|forest|wood/iu, /숲|솔/u],
  [/성곽|성벽|성채|요새|왕궁|왕도|성 ?도시|castle|fort/iu, /성벽|성곽|성채|왕궁|요새|왕도|성$|성 /u],
  [/폭포|falls/iu, /폭포/u],
  [/교회|성당|예배|묘지|church|chapel/iu, /교회|교구|종탑|묘지/u],
  [/농|밭|목장|farm|ranch/iu, /농|밭|목장|텃밭|과수/u],
  [/폐허|폐촌|버려|ruin/iu, /폐촌|폐가|무너진|옛 도읍/u],
  [/늪|swamp/iu, /늪/u],
  [/사막|오아시스|desert/iu, /사막|사암|오아시스|모래/u],
  [/눈|설원|겨울|snow|winter/iu, /설원|눈/u],
  [/화산|용암|volcano|lava/iu, /화산|용암|잿빛/u],
  [/가을|단풍|autumn/iu, /가을|단풍/u],
  [/장터|시장|축제|광장|market|festival/iu, /장터|축제|광장|상점/u],
  [/엘프|elf/iu, /엘프/u],
];

function settlementReferences(): Reference[] {
  const seen = new Set<string>();
  return ([...REGION_REFERENCES, ...PLACE_REFERENCES, ...sharedRegionReferences()] as unknown as Reference[])
    .filter(entry => (entry.regionKind === "settlement" || entry.placeKind === "settlement") && entry.width >= 30 && entry.height >= 24)
    // 같은 저장본을 장소판(…-place-…)으로 한 번 더 싣는 사례가 있다 — 그림이 같으면 한 번만.
    .filter(entry => { const key = entry.preview ?? entry.id; if (seen.has(key)) return false; seen.add(key); return true; });
}

function housesOf(entry: Reference): number | null {
  const rules = (entry.rules ?? []).join(" ");
  const digits = /집\s*(\d+)\s*채/u.exec(rules);
  if (digits) return Number(digits[1]);
  const words: Record<string, number> = { 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10 };
  const word = /(?:집|폐가|돌집)\s*(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*채|(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*집/u.exec(rules);
  const key = word?.[1] ?? word?.[2];
  return key ? words[key]! : null;
}

function score(entry: Reference, text: string, tilesetId: string): number {
  // 이름과 앞 두 규칙만 본다. 뒤쪽 규칙은 공용 문서 제목(「산촌·절벽·포구·강마을」 등)을 사례마다 되풀이해서
  // 전부 읽으면 모든 사례가 같은 점수가 된다(2026-09-28 실측: 「바닷가 어촌」에 산촌이 1순위).
  const lead = (entry.rules ?? []).slice(0, 2).join(" ");
  let total = 0;
  for (const [ask, found] of TOPICS) {
    if (!ask.test(text)) continue;
    if (found.test(entry.name)) total += 20;
    else if (found.test(lead)) total += 8;
  }
  if (entry.tilesetId === tilesetId) total += 3;
  // 폐촌·폐허 사례는 그런 분위기를 말했을 때만 — 「호숫가 마을」에 안개못 폐촌이 먼저 오지 않게.
  if (/폐촌|폐가|무너진/u.test(entry.name) && !/폐허|폐촌|버려|무너|ruin/iu.test(text)) total -= 15;
  // 기후 사례는 그 기후를 말했을 때만 — 「숲마을」에 설원 산촌이 먼저 오지 않게.
  if (/^climate-/u.test(entry.id) && !/눈|설원|겨울|화산|용암|사막|가을|단풍|snow|winter|volcano|desert|autumn/iu.test(text)) total -= 20;
  return total;
}

/**
 * 요청에 가장 가까운 완성 마을 사례. 요청 낱말이 아무것도 안 맞으면 기본 칩셋의 대표 사례를 준다.
 * leadId 가 있으면 그 사례를 맨 앞에 둔다 — 계약이 문장으로 고른 사례를 결과도 그대로 쓰게 한다.
 */
export function villageReferenceExamples(project: Project, requestText: string, tilesetId?: string, leadId?: string): VillageReferenceExample[] {
  const tileset = tilesetId ?? defaultOutdoorTilesetId(project);
  const ranked = settlementReferences().map((entry, index) => ({ entry, index, score: entry.id === leadId ? 1000 : score(entry, requestText, tileset) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked.slice(0, MAX_EXAMPLES).map(({ entry }) => ({
    id: entry.id, name: entry.name, size: `${entry.width}×${entry.height}`, tilesetId: entry.tilesetId,
    houses: housesOf(entry), rule: (entry.rules?.[0] ?? "").slice(0, 160), preview: entry.preview ?? null,
  }));
}

/**
 * 마을 계약용 — 사용자가 수량을 말하지 않았을 때 첫 사례의 집 수. 사례에 집 수가 없으면 비워 두고 호출자 기본값을 쓴다.
 */
export function villageReferenceDefaults(project: Project, requestText: string, tilesetId?: string): {
  readonly referenceId?: string; readonly houseCount?: number; readonly layouts: readonly VillageLayoutCandidate[];
} {
  const first = villageReferenceExamples(project, requestText, tilesetId)[0];
  if (!first) return { layouts: [] };
  return { referenceId: first.id, ...(first.houses && first.houses >= 2 && first.houses <= 16 ? { houseCount: first.houses } : {}),
    layouts: layoutCandidates(first, requestText) };
}

/** 시공기 인자 한 벌 — 크기는 사례 크기, 배치는 사례 구성에서. 순서대로 시험하고 처음 성공하는 것을 쓴다. */
export interface VillageLayoutCandidate {
  readonly width: number;
  readonly height: number;
  readonly morphology?: "river" | "street" | "green" | "round" | "cluster";
  readonly relief?: "hills";
  readonly theme?: string;
}

/**
 * 사례를 현재 시공기가 지을 수 있는 인자로 옮긴다. 2026-09-28 시드 6개 실측(빈 맵, 8채, 사례 크기로 맞춘 맵):
 * - 포구·어촌: theme 「바닷가 포구 어촌 선착장」(형태 생략) → 6/6 성공, 물가+모래+선착장.
 * - 절벽·단구: morphology cluster + relief hills(theme 없이) → 6/6. 같은 조합에 theme 을 더하면 4~6채만 지어 실패.
 * - 광장 교구: green + hills → 6/6. 강: river → 6/6.
 * 크기를 사례보다 작게(환산기 기본 54×28 등) 두면 대부분 채수가 모자라 실패했다 — 그래서 크기는 사례 그대로다.
 */
function layoutCandidates(example: VillageReferenceExample, requestText: string): VillageLayoutCandidate[] {
  const [w, h] = example.size.split("×").map(Number) as [number, number];
  const size = { width: Math.min(96, Math.max(44, w)), height: Math.min(96, Math.max(36, h)) };
  const text = `${requestText} ${example.name} ${example.rule}`;
  const out: VillageLayoutCandidate[] = [];
  // 호수 사례에도 선착장이 있으니 호수를 먼저 본다. 바다 판정은 요청 문장 기준이다.
  if (/호수|호숫|호반|연못/u.test(text)) out.push({ ...size, theme: "호숫가 마을" });
  if (/바다|바닷|포구|어촌|항구|해안|곶/u.test(requestText) || /포구|어촌|항구|물굽이|곶/u.test(example.name)) out.push({ ...size, theme: "바닷가 포구 어촌 선착장" });
  // 강·폭포를 요청했으면 물이 먼저다 — 시공기는 강과 언덕을 같이 못 깐다(village-river-conflict). 언덕만 깔면
  // 「절벽 위 폭포」가 물 없는 둔덕 마을이 됐다(2026-09-28 화면 확인).
  if (/강|개울|시냇|폭포|river|stream|falls/iu.test(requestText)) out.push({ ...size, morphology: "river" });
  if (/교회|교구|종탑|광장|분수|우물가/u.test(text)) out.push({ ...size, morphology: "green", relief: "hills" });
  if (/절벽|언덕|단구|윗단|대지|계단|고원|층바위/u.test(text)) out.push({ ...size, morphology: "cluster", relief: "hills" });
  if (/강|개울|시냇|물길|여울|폭포/u.test(text)) out.push({ ...size, morphology: "river" });
  return out;
}

/** author_village 결과에 붙는 첫 사례 그림. 마을 계약 실행은 다른 읽기 도구를 못 부르므로 여기가 유일한 통로다. */
export async function villageReferenceImages(data: unknown): Promise<{ dataUrl: string; label: string }[]> {
  const first = (data as { referenceVillages?: readonly VillageReferenceExample[] } | undefined)?.referenceVillages?.[0];
  if (!first?.preview) return [];
  const label = `참고 마을 「${first.name}」 ${first.size}`;
  try {
    return [{ dataUrl: await resolveReferenceImageDataUrl(villageModelPreview(first.preview)), label }];
  } catch {
    // 축소본이 없는 사례(공유 호스트에서만 온 사례 등)는 그림을 붙이지 않는다 — 원본 1MB를 대신 넣지 않는다.
    return [];
  }
}

/** Pi 의도 노트에 붙는 한 덩어리. 사례가 없으면 null. */
export function formatVillageReferenceNote(examples: readonly VillageReferenceExample[]): string | null {
  if (examples.length === 0) return null;
  const lines = examples.map(example => `- ${example.name}(${example.id}, ${example.size}${example.houses ? `, 집 ${example.houses}채` : ""}, 칩셋 ${example.tilesetId}): ${example.rule}`);
  return [
    "[참고 마을] 검토를 거친 완성 마을 사례다. 사용자가 집 수를 말하지 않았으면 첫 사례의 집 수를 쓴다(마을 계약이 있으면 이미 그 값이다). "
      + "author_village 에 referenceId 로 첫 사례 id 를 넘기면 결과가 그 사례 그림과 크기·집 수 비교를 돌려준다(시공 배치는 바꾸지 않는다). "
      + "시공기의 배치(강·언덕·광장)는 사례를 그대로 재현하지 못하니 계약 인자는 바꾸지 말고 그림과 비교해 차이를 보고에 적는다. "
      + "배열을 복사하지 않는다. 사용자가 그 마을 이름을 그대로 원하면 import_region_reference({id}) 한 번으로 가져온다.",
    ...lines,
  ].join("\n");
}
