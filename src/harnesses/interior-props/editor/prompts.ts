// src/harnesses/interior-props/editor/prompts.ts
/**
 * 실내 기물 지시문. 파이썬 하네스의 brief.py(방향·시점 절)·prompt.md(작업자)·review.md(검수자)를
 * 에디터용으로 옮겼다: 파일을 열게 하는 대신 그림을 첨부하고, pxg 대신 팔레트 키 JSON 격자로 답하게 한다.
 * 규칙 문장을 바꿀 때는 파이썬 쪽과 같이 바꾼다.
 */
import { gridToAnswer } from "@/harnesses/_core/workshop/grid";
import type { Direction, DrawContext, ReviewContext } from "@/harnesses/_core/workshop/types";
import { FLAT_KINDS, KIND_LABELS } from "./items";
import { rampSummary } from "./palette";

export const DIRECTIONS: Direction[] = [
  { letter: "A", text: "최소 수정: 지금 그림의 디자인·비율·색·결을 그대로 두고, 3/4 로 안 읽히는 곳(얇은 윗면 등)만 고친다. 화소 대부분이 그대로여야 한다." },
  { letter: "B", text: "최소 수정 (A 와 다른 해석): 지금 그림을 출발점으로, 윤곽·명암·윗면을 다듬어 더 단단하게. 모양과 크기는 지금과 같게." },
  { letter: "C", text: "기준 맞추기: 기준 그림들과 같은 결(윤곽 굵기·명암 단 수·나뭇결·윗면 두께)로 다시 찍는다. 물건과 크기는 지금 그대로." },
  { letter: "D", text: "기준 맞추기 (C 와 다른 해석): 기준 그림의 결을 따르되 디자인을 한 단계 더 다듬는다(장식·비례). 물건은 같다." },
  { letter: "E", text: "자유: 같은 화풍(기준 그림) 안에서 이 물건을 가장 잘 읽히게 새로 디자인한다. 캔버스는 지킨다." },
];
export const NEW_DIRECTIONS: Direction[] = [
  { letter: "A", text: "설명 충실: 설명 문장의 요소를 빠짐없이, 가장 전형적인 SFC 시절 JRPG 모양으로 그린다." },
  { letter: "B", text: "같은 방 화풍: 기준 그림의 다른 가구 결을 그대로 따라, 원래 그 방에 있던 물건처럼 그린다." },
  { letter: "C", text: "단순·또렷: 16px 칸에서 한눈에 읽히게 덩어리를 크게, 세부는 최소로." },
  { letter: "D", text: "장식: 같은 물건을 한 단계 화려하게(금장·문양·빛). 잔점·노이즈는 금지." },
  { letter: "E", text: "자유 해석: 같은 쓰임의 물건을 다른 디자인으로 해석한다. 캔버스는 지킨다." },
];
export const REJECT_REASONS: Readonly<Record<string, string>> = {
  view: "시점 이상", size: "크기·비율 이상", style: "화풍이 다름", read: "무슨 물건인지 안 읽힘", messy: "지저분함·잔점", worse: "원래 그림이 더 나음",
};
/** 3/4 예시(public/assets/harnesses/interior-props/examples) */
export const EXAMPLES: readonly { file: string; label: string }[] = [
  { file: "good-bookshelf", label: "맞는 예: 책장 — 윗판 윗면 3~4행" },
  { file: "bad-bookshelf", label: "틀린 예: 책장 — 윗판이 1행 띠(정면도)" },
  { file: "good-wardrobe", label: "맞는 예: 옷장 — 윗면 4행" },
  { file: "bad-wardrobe", label: "틀린 예: 옷장 — 정면도" },
  { file: "good-fireplace", label: "맞는 예: 벽난로 — 선반 윗면 5행" },
  { file: "bad-fireplace", label: "틀린 예: 벽난로 — 정면도" },
  { file: "good-sideboard", label: "맞는 예: 찬장 — 윗면 6행" },
  { file: "good-helmet-shelf", label: "맞는 예: 투구 선반 — 꼭대기 판 + 투구 정수리도 윗면이 보인다" },
  { file: "bad-helmet-shelf", label: "틀린 예: 투구 선반 — 위가 뚫린 틀, 투구는 납작한 정면 아이콘" },
];
/** 검수자가 꼭대기 행 수를 같은 배율로 비교할 칩셋 기준 */
export const REVIEW_REFS: readonly string[] = ["good-bookshelf", "good-wardrobe", "good-sideboard", "good-fireplace"];

const ANSWER_FORMAT = [
  "## 답 형식 — JSON 객체 하나만 (설명·마크다운 없이)",
  '{"legend": {"a": "wood:2", "b": "wood:6", "c": "shadow:0"}, "rows": ["..aab..", ".abbba.", …], "note": "무엇을 바꿨나 한 줄", "topRows": 3}',
  "- rows 는 위에서 아래로 한 줄씩, 글자 하나 = 화소 하나. 「.」 = 투명. 줄 수 = 캔버스 높이, 줄 길이 = 캔버스 폭.",
  "- legend 의 값은 아래 팔레트 키(램프이름:번호)만. 팔레트 밖 색은 못 쓴다.",
  "- topRows = 꼭대기 면 윗면 행 수(정수). 벽면 걸이·바닥 무늬면 null.",
].join("\n");

const VIEW_SECTION = [
  "## 시점 (3/4) — 재서 지킨다",
  "첨부한 예시 그림부터 본다. 「맞는 예」는 칩셋의 3/4 가구, 「틀린 예」는 같은 물건의 틀린 그림이다. 둘의 차이(꼭대기 윗면 행 수)를 눈에 익힌 뒤 그린다.",
  "- 카메라는 남쪽 위에서 내려다본다. 보이는 면 = 수평 면의 윗면 + 남쪽 면. 순수 정면도(아이콘)는 틀린다.",
  "- 꼭대기 면: 가구의 가장 높은 수평 면(윗판·뚜껑·덮개·좌판·기둥 머리)의 윗면을 3행 이상(큰 가구 4~6행). 칩셋 책장 3~4행 · 옷장 4행 · 찬장 6행 · 벽난로 5행.",
  "  위가 뚫린 틀(기둥만 솟고 윗판이 없다)은 안 된다.",
  "- 안쪽 판(선반판·칸막이판)은 윗면 2~3행 + 앞 모서리 1~2행. 안쪽 판이 잘 보여도 꼭대기 판을 대신하지 못한다.",
  "- 얹힌 물건(투구·책·단지·병·빵·화분)도 정수리·입구·뚜껑의 윗면이 보인다. 납작한 정면 아이콘으로 찍지 않는다.",
  "- 「북쪽 벽 앞 기물」은 벽 앞에 서 있는 가구다(깊이가 있다). 평평해도 되는 것은 벽면 걸이·바닥 무늬뿐이다.",
  "- 윗면 자리가 모자라면 남쪽 면(앞면)을 줄여서 만든다. 꼭대기 윗면을 깎지 않는다.",
  "- 옆을 보는 물건(동쪽을 보는 의자 등)의 남쪽 면은 그 물건의 옆모습이다 — 옆모습은 정상.",
  "- 기하 도형(원통·상자)으로 통째로 다시 만들지 마라. 손 도트 화풍(기준 그림·지금 그림)을 지킨다.",
  "- 끝내기 전에 세어서 note 에 「꼭대기 윗면 N행(y=a~b)」을 적고 topRows 에 N 을 넣는다. 3행 미만이면 고친 뒤 낸다 — 검수가 다시 재고, 3행 미만이면 무조건 떨어진다.",
].join("\n");

export function drawSystemPrompt(): string {
  return [
    "너는 OPRN 의 16px 손 도트 실내 기물 작업자다. 후보 한 장을 찍는다. 사용자가 같은 기물의 후보 5장 중에서 하나를 고른다 — 다른 4장과 다르게, 네 방향을 지켜서 찍어라.",
    "화풍: SFC 시절 JRPG 실내. 윤곽은 어두운 같은 램프 색, 명암은 램프 안에서 3~5단, 잔점·노이즈 금지.",
    "제3자 그림의 화소를 옮기지 마라. 답은 JSON 하나뿐이다.",
  ].join("\n");
}

export function drawBrief(ctx: DrawContext): string {
  const { item } = ctx;
  const flat = FLAT_KINDS.has(item.kind);
  const lines = [
    `# ${item.title} (\`${item.key}\`) — 방향 ${ctx.direction.letter}, 시도 ${ctx.attempt}/${ctx.maxAttempts}`,
    "",
    `- 물건: ${item.description || "(설명 없음)"}`,
    `- 종류: ${KIND_LABELS[item.kind] ?? item.kind} · 분류: ${item.category}${item.use.length ? ` · 쓰임: ${item.use.join(", ")}` : ""}`,
    `- 캔버스 ${item.width}×${item.height}px. 맨 위 ${item.padTop}줄은 비운다. 맨 아래 칠한 줄 = 바닥 접지선(캔버스 맨 아래). 배경은 투명.`,
    `- 너의 방향 ${ctx.direction.letter}: ${ctx.direction.text}`,
    "",
  ];
  if (item.isNew && !ctx.current) {
    lines.push("## 새 기물 — 지금 그림이 없다", "설명대로 처음부터 그린다. 같은 방에 놓을 기준 그림과 윤곽 굵기·명암 단 수·크기감이 같아야 한다.", "");
  }
  if (ctx.roundNote) lines.push("## 사용자 메모 (가장 먼저 따른다)", ctx.roundNote, "");
  if (ctx.redrawNote) lines.push("## 이 장만 다시 — 사용자가 남긴 말", ctx.redrawNote, "");
  if (ctx.notes.length) lines.push("## 이 기물에 대한 사용자의 지난 말", ...ctx.notes.map((n) => `- ${n}`), "");
  if (ctx.lastVerdict) {
    lines.push(
      `## 지난 시도가 검수에서 떨어졌다 (${ctx.lastVerdict.codes.join(", ") || "이유 코드 없음"})`,
      `- 꼭대기: ${ctx.lastVerdict.top || "?"}`,
      `- 이유: ${ctx.lastVerdict.reasons || "?"}`,
      `- 고칠 것: ${ctx.lastVerdict.fix || "?"}`,
      "지난 격자(아래)에서 출발해 고칠 것만 고친다.",
      "",
    );
  }
  if (ctx.rejected.length) {
    lines.push("## 사용자가 버린 후보 (이렇게 하지 말 것 — 그림 첨부)", ...ctx.rejected.map((r, i) => `- 버린 것 ${i + 1}: ${r.reasons.join(", ") || "이유 없음"}${r.note ? ` · 「${r.note}」` : ""}`), "");
  }
  lines.push(
    "## 화풍 기준 (첨부한 기준 그림)",
    "윤곽 굵기·명암 단 수·결·크기감은 기준 그림을 따른다. 시점(윗면 행 수)은 아래 시점 절이 우선한다 — 기준 그림이 그보다 납작하면 시점 절을 따른다.",
    "",
  );
  lines.push(flat ? `## 시점\n- 이 물건은 ${KIND_LABELS[item.kind]}이다 — 평평한 게 정상이다. 칩셋의 같은 종류처럼 그린다.\n` : `${VIEW_SECTION}\n`);
  lines.push("## 팔레트 키", rampSummary(ctx.palette), "", ANSWER_FORMAT, "");
  const start = ctx.previousGrid ?? ctx.current;
  if (start) lines.push(ctx.previousGrid ? "## 지난 시도 격자 (여기서 출발)" : "## 지금 그림 격자 (여기서 출발)", JSON.stringify(gridToAnswer(start)), "");
  return lines.join("\n");
}

export function selfCheckText(ctx: DrawContext): string {
  return [
    "첨부한 것은 네 격자를 8배로 그린 그림이다(옆은 지금 그림). 다시 본다:",
    "- 지금 그림보다 나빠진 데가 없나? (사용자가 가장 싫어한 것: 「고쳤는데 더 이상해졌다」)",
    "- 기준 그림과 화풍(윤곽·명암·결)이 같나?",
    FLAT_KINDS.has(ctx.item.kind) ? "- 평평한 물건으로 읽히나?" : "- 꼭대기 면 윗면을 세어 본다 — 3행 이상인가? 위가 뚫린 틀이 아닌가? 얹힌 물건도 윗면이 보이나?",
    "고칠 것이 있으면 고친 전체 격자를, 없으면 같은 격자를 그대로 같은 JSON 형식으로 다시 낸다.",
  ].join("\n");
}

export function reviewSystemPrompt(): string {
  return [
    "너는 OPRN 16px 손 도트 실내 기물 후보의 독립 검수자다. 그린 사람이 아니다. 후보 한 장을 두 가지만 보고 합격/불합격을 낸다:",
    "(1) 3/4 시점이 지켜졌나, (2) 지금 그림보다 나빠지지 않았나. 취향(어느 후보가 제일 예쁜가)은 판정하지 않는다 — 그건 사용자가 고른다.",
    "답은 JSON 객체 하나뿐이다.",
  ].join("\n");
}

export function reviewBrief(ctx: ReviewContext): string {
  const flat = FLAT_KINDS.has(ctx.item.kind);
  return [
    `- 기물: ${ctx.item.title} — ${ctx.item.description} (종류 ${KIND_LABELS[ctx.item.kind] ?? ctx.item.kind} · 분류 ${ctx.item.category})`,
    `- 후보: 시도 ${ctx.attempt}/${ctx.maxAttempts}, 방향 ${ctx.direction.letter}: ${ctx.direction.text}`,
    ctx.current ? "- 첨부: 지금 그림|후보 나란히(8배), 후보(8배), 칩셋 기준 가구(8배), 화풍 기준." : "- 새 기물이라 지금 그림이 없다. 첨부: 후보(8배), 칩셋 기준 가구(8배), 화풍 기준. 「나빠졌나」 대신 같은 방 가구와 화풍·크기감이 같은지(STYLE)를 본다.",
    ctx.previousVerdict ? `- 지난 시도는 ${ctx.previousVerdict.codes.join(", ")} 로 떨어졌다: ${ctx.previousVerdict.reasons}. 이번에 고쳐졌는지 본다.` : "",
    "",
    flat ? "## 이 물건은 벽면 걸이·바닥 무늬다\n평평한 게 정상이다. 꼭대기 면은 「해당 없음」, top_rows 는 null. WORSE·READ·STYLE 만 본다." : [
      "## 꼭대기 면 — 가장 먼저 잰다",
      "- 가구의 가장 높은 수평 면(윗판·뚜껑·덮개·좌판·기둥 머리)을 찾아 그 윗면 행 수를 8배 그림에서 센다. 칩셋 기준: 책장 3~4행, 옷장 4행, 찬장 6행, 벽난로 5행(첨부 기준 가구).",
      "- 16px 판에서 3행 미만이면 FRONT. 위가 뚫린 틀(기둥만 솟고 윗판이 없다)도 FRONT.",
      "- 선반판·칸막이판처럼 안쪽 판은 꼭대기를 대신하지 못한다.",
      "- 얹힌 물건(투구·책·단지·병)도 윗면이 보여야 한다. 납작한 정면 도식이면 FRONT — 「소품 크기라 허용」은 없다.",
      "- 「북쪽 벽 앞 기물」은 벽 앞에 서 있는 가구다. 평평해도 되는 것은 벽면 걸이뿐이다.",
    ].join("\n"),
    "",
    "## 불합격 코드",
    "FRONT 정면 도면(윗면 없음·1~2행 띠) · THIN 수평 면이 납작한 띠로 읽힘 · TOPDOWN 위에서 본 판만 있고 남쪽 면이 없음 · CAP 기둥 머리 단면이 안 보임 · MIXED 부분마다 시점이 다름 · SIDE 안 보여야 할 동·서쪽 면이 크게 보임(옆을 보는 물건의 옆모습은 해당 없음) · WORSE 지금보다 나빠짐(디자인·비율이 깨짐, 기하 도형으로 다시 찍은 꼴, 뭉툭·지저분, 화풍이 다름) · READ 무슨 물건인지 안 읽힘 · STYLE (새 기물만) 같은 방 가구와 화풍·크기감이 다름",
    "- 지금 그림이 이미 3/4 로 충분히 읽히고 후보가 그것을 해치지 않았으면 합격이다. 고친 양이 적은 것은 불합격 사유가 아니다.",
    "- 있는 그림을 고친 후보는 확실하지 않은 의심만으로 떨어뜨리지 않는다. 그러나 꼭대기 면 규칙은 예외 없이 잰 수로 판정한다.",
    "",
    "## 답 형식 (JSON 하나, 한국어)",
    '{"verdict": "PASS" 또는 "FAIL", "codes": ["THIN", …], "top": "꼭대기 면 이름과 윗면 행 수 — 예: 윗판 윗면 3행(y=2~4). 없는 물건이면 \\"해당 없음: 이유\\"", "top_rows": 정수 또는 null, "surfaces": "그 밖의 수평 면 행 수", "worse": true/false, "reasons": "불합격이면 화소 위치로(행·열), 합격이면 한 줄 근거", "fix": "불합격이면 다음 시도에 고칠 것만 구체적으로, 합격이면 빈 문자열"}',
  ].filter((line) => line !== "").join("\n");
}
