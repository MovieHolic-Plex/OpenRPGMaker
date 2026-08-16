// benchmark/ui/landing.ts
// 벤치마크 사이트 랜딩 뷰(todo 11). 카드 데이터는 src/benchmark/tasks.ts 의
// BENCHMARK_TASKS 를 직접 import 한다 — 타이틀/개수를 여기 손으로 옮겨 적지
// 않는다(차원이 늘거나 제목이 바뀌면 이 뷰가 자동으로 따라간다).
import { BENCHMARK_TASKS, type BenchmarkTaskDef } from "../tasks";
import "./styles.css";

// 각 차원 카드의 한 줄 설명. tasks.ts 는 측정 계약(프롬프트/스코어러)만 담고
// UI 문구는 여기 둔다. tasks.ts 에 없는 id 는 "설명 없음" 처리되어 즉시 드러난다.
const DIMENSION_DESCRIPTIONS: Readonly<Record<string, string>> = {
  d1: "타일셋 이미지에서 벽/바닥 타일 id 를 나열합니다(2개 서브런, F1 평균).",
  d2: "지붕 타일 id 를 타일셋 이미지에서 찾아냅니다.",
  d3: "주어진 그리드에 벽+지붕이 조합된 집을 짓습니다.",
  d4: "창문 타일 id 를 타일셋 이미지에서 찾아냅니다.",
  d5: "나무를 줄기(하위 레이어)+잎(상위 레이어)으로 정확히 배치합니다.",
  d6: "L자 흙길 오토타일을 구현하고 타일셋의 오토타일 종류 수를 셉니다.",
  d7: "표시된 밭 사각형을 울타리로 정확히 둘러칩니다.",
};

const KIND_LABELS: Readonly<Record<BenchmarkTaskDef["kind"], string>> = {
  detection: "감지",
  construction: "구성",
  autotileGrid: "오토타일",
  autotileCount: "개수",
};

function descriptionFor(task: BenchmarkTaskDef): string {
  return DIMENSION_DESCRIPTIONS[task.id] ?? "설명 없음";
}

/**
 * 라우팅: v1 은 단일 페이지 + 해시 라우팅(#run / #leaderboard)을 쓴다.
 * 별도 HTML 파일로 쪼개지 않은 이유 — MPA 엔트리가 늘어나면 rollup input 과
 * 증거/스모크가 매번 늘고, dev 와 dist 경로 규칙도 두 벌이 된다. 해시면
 * /benchmark.html 하나로 dev·dist 동작이 같다. todo 12/13 이 실제 뷰를
 * 마운트하며 이 href 계약(#run, #leaderboard)을 그대로 소비한다.
 */
export function mountLanding(container: HTMLElement): void {
  const doc = document;
  const page = doc.createElement("main");
  page.className = "bm-page";

  const shell = doc.createElement("div");
  shell.className = "bm-shell";

  // ---- 헤더 ----
  const header = doc.createElement("header");
  header.className = "bm-header";

  const eyebrow = doc.createElement("p");
  eyebrow.className = "bm-header__eyebrow";
  eyebrow.textContent = "Tileset Vision Benchmark";
  header.appendChild(eyebrow);

  const title = doc.createElement("h1");
  title.className = "bm-header__title";
  title.textContent = "타일셋 비전 벤치마크";
  header.appendChild(title);

  const desc = doc.createElement("p");
  desc.className = "bm-header__desc";
  desc.textContent =
    "표준 결합 타운 타일셋에서 모델의 시각 이해력을 7개 차원으로 측정합니다. " +
    "채점은 전부 결정적(사람/LLM 심사 없음)이며, 원본 응답은 저장하지 않습니다.";
  header.appendChild(desc);

  const nav = doc.createElement("nav");
  nav.className = "bm-header__nav";
  const back = doc.createElement("a");
  back.className = "bm-header__backlink";
  back.href = "/";
  back.textContent = "← 에디터로 돌아가기";
  nav.appendChild(back);
  header.appendChild(nav);

  shell.appendChild(header);

  // ---- CTA + 리더보드 링크 ----
  const actions = doc.createElement("div");
  actions.className = "bm-header__nav";
  const cta = doc.createElement("a");
  cta.className = "bm-cta";
  cta.href = "#run";
  cta.textContent = "벤치마크 실행";
  actions.appendChild(cta);

  const leaderboard = doc.createElement("a");
  leaderboard.className = "bm-link";
  leaderboard.href = "#leaderboard";
  leaderboard.textContent = "리더보드";
  actions.appendChild(leaderboard);
  shell.appendChild(actions);

  // ---- 7개 차원 카드(BENCHMARK_TASKS 에서 파생) ----
  const grid = doc.createElement("section");
  grid.className = "bm-grid";
  grid.setAttribute("aria-label", "벤치마크 차원");
  for (const task of BENCHMARK_TASKS) {
    grid.appendChild(taskCard(doc, task));
  }
  shell.appendChild(grid);

  // ---- 푸터 ----
  const footer = doc.createElement("p");
  footer.className = "bm-footer";
  footer.textContent = `차원 ${BENCHMARK_TASKS.length}개 · 실행·채점은 전부 브라우저에서 로컬로 이루어집니다.`;
  shell.appendChild(footer);

  page.appendChild(shell);
  container.replaceChildren(page);
}

function taskCard(doc: Document, task: BenchmarkTaskDef): HTMLElement {
  const card = doc.createElement("article");
  card.className = "bm-card";
  card.dataset.taskId = task.id;

  const top = doc.createElement("div");
  top.className = "bm-card__top";

  const id = doc.createElement("span");
  id.className = "bm-card__id";
  id.textContent = task.id.toUpperCase();
  top.appendChild(id);

  const badge = doc.createElement("span");
  badge.className = "bm-badge bm-badge--ready";
  badge.textContent = "준비됨";
  top.appendChild(badge);

  card.appendChild(top);

  const title = doc.createElement("h2");
  title.className = "bm-card__title";
  // titleKo 는 tasks.ts(단일 진실 공급원)에서 온다 — 여기서 재작성하지 않는다.
  title.textContent = task.titleKo;
  card.appendChild(title);

  const desc = doc.createElement("p");
  desc.className = "bm-card__desc";
  desc.textContent = descriptionFor(task);
  card.appendChild(desc);

  const meta = doc.createElement("div");
  meta.className = "bm-card__meta";
  const kind = doc.createElement("span");
  kind.className = "bm-badge bm-badge--kind";
  kind.textContent = KIND_LABELS[task.kind];
  meta.appendChild(kind);

  if (task.subRuns) {
    const subRuns = doc.createElement("span");
    subRuns.className = "bm-badge bm-badge--kind";
    subRuns.textContent = `서브런 ${task.subRuns.length}개`;
    meta.appendChild(subRuns);
  }
  card.appendChild(meta);

  return card;
}
