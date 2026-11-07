// src/harnesses/_core/workshop/autoInstall.ts
/**
 * 공방 「알아서 고르기 → 칩셋에 굽기」의 순수 부분 — 편집기(assistantObjectGen.ts·workshopBake.ts)와 헤드리스
 * (src/headless/objectGen.ts, 코딩 에이전트 경로)가 같은 함수를 쓴다. 스토어·window·IndexedDB 를 건드리지 않는다.
 *
 * 2026-11-07 agent-custom-tiles: 코딩 에이전트(./oprn·에이전트 모드)에서 generate_missing_object 가 카드만 돌려주고
 * 아무도 그리지 않았다(Terra 15판 호출 0, 공방 기물 0). 같은 고르기·굽기 규칙을 화면 없이도 돌리려고 여기로 뺐다.
 */
import { workshopBakeSheet, workshopGridHash } from "./bakeSheet";
import { exemplarSheet, loadAnchors, ogPickerPrompt, ogStyleSetFor } from "./objectGenFlow";
import { parsePicker, pickerMajority, pickerMessages, PICK_RUNS } from "./picker";
import type { BaseInfo, ChatFn, GateAdvice, Grid, Palette, Rgba, RgbaImage, WorkshopEnv, WorkshopItem, WorkshopRun } from "./types";
import type { ObjectSpecV1 } from "@/project/objectSpec";
import { workshopAssetId, workshopObjectId, type WorkshopHandKind, type WorkshopObjectInput } from "@/project/workshopTiles";

const TILE = 16;
const KINDS: ReadonlySet<string> = new Set(["floor", "wall", "hang", "flat"]);
const PICK_FLOOR: Rgba = [149, 107, 68, 255];

export type PassedRun = WorkshopRun & { grid: Grid };

export function passedRuns(runs: readonly WorkshopRun[]): PassedRun[] {
  return runs
    .filter((run): run is PassedRun => run.status === "done" && run.grid !== null && run.verdict?.verdict === "PASS")
    .sort((a, b) => a.letter.localeCompare(b.letter));
}

async function pickerExtras(item: WorkshopItem, env: WorkshopEnv): Promise<{ prompt: string; exemplars: RgbaImage | null; floor: Rgba }> {
  try {
    const anchors = await loadAnchors(env, ogStyleSetFor(item));
    return { prompt: ogPickerPrompt(item), exemplars: exemplarSheet(anchors, PICK_FLOOR, 8), floor: PICK_FLOOR };
  } catch {
    return { prompt: ogPickerPrompt(item), exemplars: null, floor: PICK_FLOOR };
  }
}

/**
 * 「알아서 고르기」: 검수 통과가 하나면 그것, 둘 이상이면 object-gen picker(숫자 꼬리표를 섞어 objectGen 흐름이면 3번, 다수결).
 * 고르기 호출이 실패하거나 답을 못 읽으면 통과 첫 장으로 물러선다. 통과가 없으면 null — 굽지 않는다.
 */
export async function chooseAutoPickFrom(input: {
  readonly runs: readonly WorkshopRun[];
  readonly item: WorkshopItem;
  readonly palette: Palette;
  readonly env: WorkshopEnv;
  readonly chat: ChatFn;
  readonly objectGenFlow: boolean;
}): Promise<{ letter: string; reason: string } | null> {
  const passed = passedRuns(input.runs);
  if (!passed.length) return null;
  if (passed.length === 1) return { letter: passed[0]!.letter, reason: "검수 통과가 하나뿐" };
  const og = input.objectGenFlow ? await pickerExtras(input.item, input.env) : undefined;
  const votes: { letter: string; reason: string }[] = [];
  for (let i = 0; i < (og ? PICK_RUNS : 1); i++) {
    try {
      const board = pickerMessages(input.item, passed.map((r) => ({ letter: r.letter, grid: r.grid })), input.palette, input.env, Math.random, og);
      const text = await input.chat("workshop-review", { messages: board.messages, response_format: { type: "json_object" }, temperature: 0.1 });
      const vote = parsePicker(text, board.labels);
      if (vote) votes.push(vote);
    } catch { /* 이 판은 빠진다 */ }
  }
  const win = og ? pickerMajority(votes) : votes[0] ? { ...votes[0], tally: "" } : null;
  if (win) return { letter: win.letter, reason: win.tally ? `${win.reason} (고르기 ${win.tally})` : win.reason };
  if (votes[0]) return { letter: votes[0].letter, reason: `${votes[0].reason} (고르기 의견이 갈려 첫 답)` };
  return { letter: passed[0]!.letter, reason: "고르기 답을 못 받아 검수 통과 첫 후보" };
}

/** 설명서 review: 사람 선택(알아서 고르기가 아니면) + 3/4 관문 조언(있으면, 미보정 1표). */
function reviewOf(options: { readonly autoPicked?: boolean; readonly gate?: GateAdvice | null }, at: string): ObjectSpecV1["review"] | undefined {
  const pick = options.autoPicked ? undefined : { by: "human" as const, at };
  const gate = options.gate;
  // 영수증 판(「한 번에 만들기」 알아서 고르기): 영수증 자체는 spec.gate 에 적고(gateOf), 여기에는 REFER 를 정한 적대 검사만 남긴다.
  const receipt = gate?.receipt;
  const vqa = receipt
    ? receipt.refer ? { verdict: receipt.refer.verdict, judge: `object-gate-refer-check/${receipt.refer.judge}`, calibrated: false, at } : undefined
    : gate && gate.kind ? { verdict: gate.state === "refer" ? "none" as const : gate.state, judge: `workshop-object-gate-advice/${gate.kind}`, calibrated: false, at } : undefined;
  return pick || vqa ? { ...(pick ? { pick } : {}), ...(vqa ? { vqa } : {}) } : undefined;
}

/**
 * 설명서 gate: 관문 영수증 요약(호스트 판정기가 낸 것 — 화소 해시·프로필). 프로필이 보정되지 않았으므로 번들·공용·스토어 출구는 이것을 통과로 치지 않는다
 * (그 출구는 영수증 원본·보정 프로필로 다시 본다). 영수증이 없으면(사람이 고른 판 등) 적지 않는다.
 */
function gateOf(gate: GateAdvice | null | undefined, at: string): ObjectSpecV1["gate"] | undefined {
  const receipt = gate?.receipt;
  if (!gate || !receipt) return undefined;
  return { kind: gate.kind as NonNullable<ObjectSpecV1["gate"]>["kind"], verdict: receipt.verdict, pixelSha256: receipt.pixelSha256, profileHash: receipt.profileHash, decidedAt: at };
}

/**
 * 고른 후보 → project/workshopTiles.ts bakeWorkshopObject 입력. 격자를 16px 칸으로 잘라(빈 칸 뺌) 시트 PNG 한 장을 만든다.
 * 칸 격자·발밑 줄(footRows)·솟은 px(risePx)·종류(floor|wall|hang|flat)는 기물 정의(크기 사전 decideFootprint)를 그대로 따른다.
 */
export function workshopObjectInput(item: WorkshopItem, grid: Grid, palette: Palette, env: Pick<WorkshopEnv, "encodePng">, options: {
  readonly autoPicked?: boolean; readonly gate?: GateAdvice | null; readonly base?: BaseInfo | null; readonly tool?: string; readonly at?: string;
} = {}): WorkshopObjectInput {
  if (!KINDS.has(item.kind)) throw new Error(`이 기물 종류(${item.kind})는 칩셋에 넣을 수 없습니다.`);
  const at = options.at ?? new Date().toISOString();
  const { sheet, cells, columns, rows } = workshopBakeSheet(grid, palette);
  const dataUrl = env.encodePng(sheet);
  const review = reviewOf(options, at);
  const gate = gateOf(options.gate, at);
  return {
    objectId: workshopObjectId(item.key),
    title: item.title,
    description: item.description,
    kind: item.kind as WorkshopHandKind,
    columns,
    rows,
    footRows: item.footRows ?? 1,
    risePx: item.risePx ?? Math.max(0, (rows - (item.footRows ?? 1)) * TILE - item.padTop),
    use: item.use,
    gridHash: workshopGridHash(grid),
    asset: { id: workshopAssetId(dataUrl), dataUrl, width: sheet.width, height: sheet.height },
    cells,
    // 설명서(ObjectSpec): 공방 판에서 고른 후보다. 「한 번에 만들기」 알아서 고르기는 3/4 관문 영수증(호스트 판정기)이 통과한 것만 여기 온다.
    provenance: {
      aiGenerated: true, tool: options.tool ?? `oprn-workshop/${item.tilesetId ? "map-objects" : "interior-props"}${options.autoPicked ? "/auto-pick" : ""}`,
      // 칩셋 출발 그림(object-gen base-from-chipset)에서 출발했으면 그 id·출처 칸
      ...(options.base ? { base: `${options.base.id} (${options.base.label}) from ${options.base.sources.join(", ")}`.slice(0, 400) } : {}),
    },
    // 3/4 관문 조언(1표, 미보정)은 review.vqa 에 calibrated:false 로만 남긴다 — 출구 효력 없음(관문 영수증이 아니다).
    ...(review ? { review } : {}),
    ...(gate ? { gate } : {}),
  };
}
