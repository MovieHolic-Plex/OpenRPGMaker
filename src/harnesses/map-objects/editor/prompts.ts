// src/harnesses/map-objects/editor/prompts.ts
/**
 * 맵 기물 지시문 — 지금 맵의 칩셋에 없는 물건을 그 칩셋 화풍으로 새로 찍는다.
 * 실내 기물(interior-props)과 답 형식(팔레트 키 JSON 격자)은 같고, 화풍 기준이 번들 예시가 아니라 그 칩셋 그림이다.
 */
import { gridToAnswer, hexOf } from "@/harnesses/_core/workshop/grid";
import { requestedSize, shapeBrief, topRowsRange } from "@/harnesses/_core/workshop/objectShape";
import type { Direction, DrawContext, Palette, ReviewContext } from "@/harnesses/_core/workshop/types";
import { MAP_KIND_LABELS } from "./items";

/** 앞에서부터 실행기의 candidates 장만 쓴다 — 서로 가장 다른 셋을 앞에 둔다. */
export const MAP_DIRECTIONS: Direction[] = [
  { letter: "A", text: "칩셋 충실: 첨부한 칩셋 물체와 똑같은 윤곽 굵기·명암 단 수·색으로, 원래 그 칩셋에 있던 물건처럼 그린다." },
  { letter: "B", text: "설명 충실: 설명 문장의 요소를 빠짐없이, 가장 전형적인 SFC 시절 JRPG 모양으로 그린다." },
  { letter: "C", text: "단순·또렷: 16px 칸에서 한눈에 읽히게 덩어리를 크게, 세부는 최소로." },
  { letter: "D", text: "장식: 같은 물건을 한 단계 다듬어(문양·빛·재질감). 잔점·노이즈는 금지." },
  { letter: "E", text: "자유 해석: 같은 쓰임의 물건을 다른 디자인으로 해석한다. 캔버스는 지킨다." },
];

export function paletteSummary(palette: Palette): string {
  return palette.entries.map((entry) => `${entry.key} ${hexOf(entry.rgba)}`).join(" · ");
}

const ANSWER_FORMAT = [
  "## 답 형식 — JSON 객체 하나만 (설명·마크다운 없이)",
  '{"legend": {"a": "c:3", "b": "c:12"}, "rows": ["..aab..", ".abbba.", …], "note": "무엇을 어떻게 그렸나 한 줄", "topRows": 3}',
  "- rows 는 위에서 아래로 한 줄씩, 글자 하나 = 화소 하나. 「.」 = 투명. 줄 수 = 캔버스 높이, 줄 길이 = 캔버스 폭.",
  "- legend 의 값은 아래 팔레트 키(c:번호)만. 팔레트 밖 색은 못 쓴다 — 칩셋에 있는 색만 쓰는 것이 화풍을 맞추는 첫걸음이다.",
  "- topRows = 맨 위 수평 면의 윗면 행 수(정수). 바닥 무늬·벽 걸이·나무처럼 윗면이 없으면 null. note 에 「윗면 N행(y=a~b), 칠한 높이 Hpx」를 적는다.",
].join("\n");

/** 배경 한 줄 — 조수 요청이 칩셋에서 정한다. 없으면(공방에서 손으로 정의) 칩셋 이름만. */
export function settingLine(setting: string | undefined, tilesetName: string): string {
  return setting ? `${setting} (칩셋 ${tilesetName})` : `칩셋 「${tilesetName}」의 세계`;
}

const VIEW = [
  "## 시점 — 칩셋과 같은 3/4 탑뷰",
  "- 카메라는 남쪽 위에서 내려다본다. 보이는 면 = 수평 면의 윗면 + 남쪽 면. 순수 정면도(아이콘)나 순수 평면도는 틀린다.",
  "- 서 있는 물건은 맨 위 수평 면(지붕·뚜껑·윗판·수관 위)이 위에서 보이게 한다 — 행 수는 아래 「윗면」 절. 나무·바위·조각상은 첨부한 칩셋 물체가 하는 대로.",
  "- 맨 아래 칠한 줄이 땅에 닿는 접지선이다(캔버스 맨 아래). 발밑 줄은 막히는 칸, 그 위로 솟은 부분은 사람이 뒤로 지나간다.",
  "- 그림자·땅·풀 같은 배경은 그리지 않는다. 물건 밖은 투명.",
].join("\n");

export function drawSystemPrompt(): string {
  return [
    "너는 OPRN 의 16px 칩셋 맵 기물 작업자다. 사용자의 맵 칩셋에 없는 물건 하나를 그 칩셋의 화풍으로 새로 찍는다. 후보 한 장만 낸다 — 사용자가 여러 후보 중에서 고른다.",
    "화풍: 첨부한 칩셋 그림이 기준이다. 윤곽 굵기·명암 단 수·색은 그 그림을 따른다. 잔점·노이즈 금지.",
    "제3자 그림의 화소를 옮기지 마라. 답은 JSON 하나뿐이다.",
  ].join("\n");
}

export function drawBrief(ctx: DrawContext, tilesetName: string): string {
  const { item } = ctx;
  const lines = [
    `# ${item.title} — 방향 ${ctx.direction.letter}, 시도 ${ctx.attempt}/${ctx.maxAttempts}`,
    "",
    `- 칩셋: ${tilesetName}`,
    `- 배경: ${settingLine(item.setting, tilesetName)} — 이 배경에서 실제로 보는 모양으로 그린다. 다른 나라·시대의 모양(예: 일본 거리에 영국식 빨간 전화 부스)은 틀린다.`,
    `- 물건: ${item.description || "(설명 없음)"}`,
    `- 종류: ${MAP_KIND_LABELS[item.kind] ?? item.kind}${item.use.length ? ` · 쓰임: ${item.use.join(", ")}` : ""}`,
    `- 캔버스 ${item.width}×${item.height}px (16px 칸 ${item.width / 16}×${item.height / 16}). 맨 위 ${item.padTop}줄은 비운다. 배경은 투명.`,
    `- 너의 방향 ${ctx.direction.letter}: ${ctx.direction.text}`,
    "",
  ];
  if (ctx.roundNote) lines.push("## 사용자 메모 (가장 먼저 따른다)", ctx.roundNote, "");
  if (ctx.redrawNote) lines.push("## 이 장만 다시 — 사용자가 남긴 말", ctx.redrawNote, "");
  if (ctx.notes.length) lines.push("## 이 기물에 대한 사용자의 지난 말", ...ctx.notes.map((n) => `- ${n}`), "");
  if (ctx.lastVerdict) {
    lines.push(
      `## 지난 시도가 검수에서 떨어졌다 (${ctx.lastVerdict.codes.join(", ") || "이유 코드 없음"})`,
      `- 이유: ${ctx.lastVerdict.reasons || "?"}`,
      `- 고칠 것: ${ctx.lastVerdict.fix || "?"}`,
      "지난 격자에서 출발해 고칠 것만 고친다.",
      "",
    );
  }
  if (ctx.rejected.length) {
    lines.push("## 사용자가 버린 후보 (이렇게 하지 말 것 — 그림 첨부)", ...ctx.rejected.map((r, i) => `- 버린 것 ${i + 1}: ${r.reasons.join(", ") || "이유 없음"}${r.note ? ` · 「${r.note}」` : ""}`), "");
  }
  lines.push(
    "## 화풍 기준 (첨부)",
    "「칩셋 물체」는 이 칩셋에 원래 있는 그림이다. 윤곽 굵기·명암 단 수·크기감을 그대로 따른다. 「칩셋 조각」은 시트 일부다.",
    "",
    item.kind === "flat" || item.kind === "hang" ? `## 시점\n- 이 물건은 ${MAP_KIND_LABELS[item.kind]}이다 — 평평한 게 정상이다.\n` : `${VIEW}\n`,
    shapeBrief(item),
    "",
    "## 팔레트 키 (이 칩셋에서 뽑은 색, 어두운 것부터)",
    paletteSummary(ctx.palette),
    "",
    ANSWER_FORMAT,
    "",
  );
  if (ctx.previousGrid) lines.push("## 지난 시도 격자 (여기서 출발)", JSON.stringify(gridToAnswer(ctx.previousGrid)), "");
  return lines.join("\n");
}

export function reviewSystemPrompt(): string {
  return [
    "너는 OPRN 16px 칩셋 맵 기물 후보의 독립 검수자다. 그린 사람이 아니다. 후보 한 장을 보고 합격/불합격을 낸다.",
    "보는 것: (1) 1배(실제 게임 크기)로 봤을 때 요청한 물건으로, 그 맵의 배경(나라·시대)에 맞는 모양으로 읽히는가, (2) 첨부한 칩셋과 화풍이 같은가, (3) 3/4 탑뷰 — 윗면 행 수를 잰다, (4) 요청 크기대로인가, (5) 배경을 칠하지 않았나.",
    "화풍 검사만 통과했다고 합격이 아니다 — 1배에서 그 물건으로 안 읽히거나 배경과 다른 나라 모양이면 떨어뜨린다.",
    "취향(어느 후보가 제일 예쁜가)은 판정하지 않는다 — 그건 사용자가 고른다. 답은 JSON 객체 하나뿐이다.",
  ].join("\n");
}

export function reviewBrief(ctx: ReviewContext, tilesetName = ""): string {
  const flat = ctx.item.kind === "flat" || ctx.item.kind === "hang";
  const size = requestedSize(ctx.item);
  const top = topRowsRange(size.height);
  return [
    `- 기물: ${ctx.item.title} — ${ctx.item.description} (종류 ${MAP_KIND_LABELS[ctx.item.kind] ?? ctx.item.kind})`,
    `- 배경: ${settingLine(ctx.item.setting, tilesetName || ctx.item.category)}`,
    `- 요청 크기: 발밑 ${size.tilesW}×${size.footRows}칸${size.risePx ? ` + 위로 ${size.risePx}px` : ""} = 칠할 범위 약 ${size.width}×${size.height}px`,
    `- 후보: 시도 ${ctx.attempt}/${ctx.maxAttempts}, 방향 ${ctx.direction.letter}: ${ctx.direction.text}`,
    "- 첨부: 후보 1배·2배(실제 게임 크기, 그 칩셋 땅 색 위), 후보 8배, 칩셋 물체·조각(화풍 기준).",
    "",
    "## 1배 — 가장 먼저 (제목을 잊고 본다)",
    "- 「후보 1배」만 보고 무엇으로 보이는지 looks_like 에 한국어 명사로 적는다. 그 다음에 제목과 견준다.",
    `- 1배에서 「${ctx.item.title}」로 읽히지 않으면 READ. 그 배경(위)에서 실제로 보는 모양이 아니고 다른 나라·시대 모양이면 CONTEXT(예: 일본 거리의 공중전화 부스가 영국식 빨간 부스).`,
    ctx.previousVerdict ? `- 지난 시도는 ${ctx.previousVerdict.codes.join(", ")} 로 떨어졌다: ${ctx.previousVerdict.reasons}. 이번에 고쳐졌는지 본다.` : "",
    "",
    "",
    flat ? "## 이 물건은 바닥 무늬·벽 걸이다\n평평한 게 정상이다. READ·CONTEXT·STYLE·BG 만 본다. top_rows 는 null." : [
      "## 시점·윗면 — 8배 그림에서 잰다",
      "- 남쪽 위에서 내려다본 3/4: 맨 위 수평 면의 윗면 + 남쪽 면. 순수 정면 아이콘이면 FRONT, 순수 평면도면 TOPDOWN.",
      `- 맨 위 수평 면(뚜껑·지붕·윗판·좌판·입구)의 윗면 행 수를 세어 top_rows 에 적는다. 이 크기는 ${top.min}~${top.max}행(칠한 높이의 25~33%)이 맞다. ${top.min}행 미만이면 THIN 으로 떨어뜨린다 — 1~2행 테두리 띠는 윗면이 아니다.`,
      "- 윗면이 없는 물건(나무·식물·사람 모양 조각상·가는 기둥)만 top_rows null, top 은 「해당 없음: 이유」. 받침대가 있으면 받침대 윗면을 잰다.",
    ].join("\n"),
    "",
    "## 불합격 코드",
    "READ 1배에서 그 물건으로 안 읽힘 · CONTEXT 배경과 다른 나라·시대 모양 · THIN 윗면이 하한보다 얇음 · FRONT 정면 아이콘 · TOPDOWN 위에서 본 판만 · SIZE 요청 크기와 다름(한 칸이 두 칸 높이 등) · STYLE 칩셋과 화풍이 다름(윤곽·명암 단·크기감·색 느낌) · MESSY 잔점·노이즈·지저분 · BG 물건 밖 배경을 칠함",
    "- 확실하지 않은 의심만으로 떨어뜨리지 않는다. 그러나 READ·CONTEXT·THIN 은 1배 그림과 잰 행 수로 판정한다.",
    "",
    "## 답 형식 (JSON 하나, 한국어)",
    '{"looks_like": "제목을 잊고 1배만 봤을 때 보이는 것", "verdict": "PASS" 또는 "FAIL", "codes": ["READ", …], "top": "맨 위 수평 면과 윗면 행 수(y=a~b), 없으면 \\"해당 없음: 이유\\"", "top_rows": 정수 또는 null, "worse": false, "reasons": "불합격이면 화소 위치로(행·열), 합격이면 한 줄 근거", "fix": "불합격이면 다음 시도에 고칠 것만, 합격이면 빈 문자열"}',
  ].filter((line) => line !== "").join("\n");
}
