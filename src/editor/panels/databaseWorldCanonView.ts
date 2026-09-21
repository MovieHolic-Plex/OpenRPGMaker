import { segmentedControl } from "@/editor/panels/databaseControls";
import {
  absenceEditor,
  bodyField,
  boundedCanonText,
  lawCard,
  toneRow,
  writeCanon,
} from "@/editor/panels/databaseWorldCanonFields";
import { detailPane, sectionCard, statStrip, workspaceShell } from "@/editor/panels/databaseWorkspace";
import { worldDocumentProperties } from "./worldDocumentProperties";
import { WORLD_CANON_BODY_EXCERPT_CHARS, worldCanonPromptSection } from "@/ai/worldCanonContext";

/**
 * 조수가 실제로 보는 본문 길이. 표시 문구가 이 값과 어긋나면 사용자가 "앞 600자만 본다"고
 * 믿고 세계관을 그 길이에 맞춰 쓰는데, 실제로는 20,000자를 보내므로 손해다. 그래서 UI 는
 * 하드코딩하지 않고 `worldCanonPromptSection` 과 **같은 상수**를 읽는다.
 */
const EXCERPT_MAX = WORLD_CANON_BODY_EXCERPT_CHARS;
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import {
  resolveWorldCanon,
  WORLD_CANON_LAW_KINDS,
  WORLD_CANON_BOUNDS,
  type ResolvedWorldCanon,
} from "@/project/world/canon";
import { el } from "@/util/dom";

const propertiesOpen = new WeakMap<HTMLElement, boolean>();

function excerptHint(filled: number): string {
  const excerptLen = Math.min(EXCERPT_MAX, filled);
  return filled > EXCERPT_MAX
    ? `역사·지형·문화·비밀 — 조수는 앞 ${EXCERPT_MAX}자를 본다 (뒤 ${filled - EXCERPT_MAX}자는 발췌 밖)`
    : `역사·지형·문화·비밀 — 조수는 앞 ${EXCERPT_MAX}자 중 ${excerptLen}자를 본다`;
}

export function renderWorldCanonTab(host: HTMLElement, rerender: () => void): void {
  const canon = resolveWorldCanon(store.getCurrent().worldCanon);
  const meterFill = el("div", {
    class: "world-canon-meter-fill",
    attrs: {
      role: "progressbar",
      "aria-label": "AI 전달 본문 분량",
      "aria-valuemin": "0",
      "aria-valuemax": String(EXCERPT_MAX),
      "aria-valuenow": String(Math.min(EXCERPT_MAX, canon.body.trim().length)),
      style: `width:${Math.min(100, Math.round((Math.min(EXCERPT_MAX, canon.body.trim().length) / EXCERPT_MAX) * 100))}%`,
    },
  });
  const meterText = el("span", {
    class: "world-canon-meter-text",
    attrs: { role: "status" },
    dataset: { testid: "db-world-canon-ai-meter" },
    text: excerptHint(canon.body.trim().length),
  });
  const heroStats = statStrip([
    {
      label: "AI 전달 본문",
      value: `${Math.min(EXCERPT_MAX, canon.body.trim().length)} / ${EXCERPT_MAX}자`,
      hint: canon.body.trim().length > EXCERPT_MAX ? `뒤 ${canon.body.trim().length - EXCERPT_MAX}자 잘림` : "앞부분만 읽는다",
      tone: canon.body.trim().length > EXCERPT_MAX ? "warn" : "neutral",
      testid: "db-world-canon-hero-stat-body",
    },
    { label: "톤", value: `${canon.tones.length}종`, hint: "8종 중" },
    { label: "없는 것", value: `${canon.absences.length}개`, hint: "부분일치" },
    {
      label: "법칙",
      value: `${WORLD_CANON_LAW_KINDS.filter((kind) => canon.laws[kind].present !== undefined || canon.laws[kind].note.trim()).length} / 4`,
      hint: "힘·신·죽음·돈",
    },
  ], { testid: "db-world-canon-hero-stats" });
  const bodyCard = sectionCard({
    title: "본문",
    hint: "형식 없음",
    testid: "db-world-canon-body-card",
    children: [bodyField(canon.body, hintLine)],
  });
  // 본문 타이핑마다 힌트 줄의 발췌 카운터를 갱신한다 — 다시 렌더하지 않고 숫자만 바꾼다.
  function hintLine(): void {
    const filled = (bodyCard.querySelector("[data-testid='db-world-canon-body']") as HTMLTextAreaElement | null)
      ?.value.trim().length ?? canon.body.trim().length;
    const hint = bodyCard.querySelector(".db-ws-card-hint");
    if (hint) hint.textContent = excerptHint(filled);
    meterText.textContent = excerptHint(filled);
    meterFill.setAttribute("style", `width:${Math.min(100, Math.round((Math.min(EXCERPT_MAX, filled) / EXCERPT_MAX) * 100))}%`);
    meterFill.setAttribute("aria-valuenow", String(Math.min(EXCERPT_MAX, filled)));
    const statTile = heroStats.querySelector("[data-testid='db-world-canon-hero-stat-body']");
    const statValue = statTile?.querySelector(".db-ws-stat-value");
    if (statValue) statValue.textContent = `${Math.min(EXCERPT_MAX, filled)} / ${EXCERPT_MAX}자`;
    const statHint = statTile?.querySelector(".db-ws-stat-hint");
    if (statHint) statHint.textContent = filled > EXCERPT_MAX ? `뒤 ${filled - EXCERPT_MAX}자 잘림` : "앞부분만 읽는다";
    if (statTile) {
      statTile.classList.remove("db-ws-stat-neutral", "db-ws-stat-warn", "db-ws-stat-good", "db-ws-stat-bad");
      statTile.classList.add(filled > EXCERPT_MAX ? "db-ws-stat-warn" : "db-ws-stat-neutral");
    }
  }
  hintLine();
  const aiPreview = el("pre", { class: "world-ai-preview", dataset: { testid: "world-canon-ai-preview" } });
  const updateAiPreview = (): void => {
    aiPreview.textContent = worldCanonPromptSection(store.getCurrent().worldCanon) ?? "아직 AI에 전달할 설정이 없습니다.";
  };
  const aiDetails = el("details", {
    class: "world-ai-scope",
    children: [el("summary", { text: "AI 미리보기 — 이 세계(세계관 고정)" }), aiPreview],
    on: { toggle: updateAiPreview },
  });
  updateAiPreview();
  const frameCard = sectionCard({
    title: "뼈대",
    hint: "톤 8종 · 시대 · 기술 천장 · 세계에 없는 것(부분일치)",
    testid: "db-world-canon-frame",
    children: [
      toneRow(canon.tones, rerender),
      el("div", {
        class: "world-canon-spread-era",
        children: [
          boundedCanonText("시대", canon.era, (value) => writeCanon({ era: value }, "db-world-canon-era"), "db-world-canon-era", WORLD_CANON_BOUNDS.era),
          boundedCanonText("기술 수준", canon.techCeiling, (value) => writeCanon({ techCeiling: value }, "db-world-canon-tech"), "db-world-canon-tech", WORLD_CANON_BOUNDS.techCeiling),
        ],
      }),
      absenceEditor(canon.absences, rerender),
    ],
  });
  const lawsCard = sectionCard({
    title: "이 세계의 네 가지 질문",
    hint: "힘·신·죽음·돈 — 비어 있으면 AI가 멋대로 채운다",
    testid: "db-world-canon-laws",
    children: [el("div", {
      class: "world-canon-law-grid is-cards",
      children: WORLD_CANON_LAW_KINDS.map((kind) => lawCard(kind, canon.laws[kind], rerender)),
    })],
  });
  const properties = worldDocumentProperties([
    sectionCard({
      title: "문서 설정",
      children: [
        segmentedControl("작성 상태", "db-world-canon-status", canon.status, [
          { id: "draft", name: "초안" }, { id: "canon", name: "확정" },
        ], (value) => {
          if (value !== "draft" && value !== "canon") return;
          recordProjectSnapshot("세계관 상태");
          writeCanon({ status: value });
          updateAiPreview();
        }),
        segmentedControl("공개 범위", "db-world-canon-visibility", canon.visibility, [
          { id: "public", name: "공개" }, { id: "secret", name: "비밀" },
        ], (value) => {
          if (value !== "public" && value !== "secret") return;
          recordProjectSnapshot("세계관 공개 범위");
          writeCanon({ visibility: value });
          updateAiPreview();
        }),
        el("p", { class: "world-muted", text: "비밀 설정도 AI는 참고하지만, 플레이어 대사에 직접 공개하지 않도록 지시합니다." }),
      ],
    }),
    aiDetails,
  ], propertiesOpen.get(host) ?? false, (open) => propertiesOpen.set(host, open));
  // 스프레드 헤드는 "보는 것 = 편집하는 것"의 핵심이라 이름/전제 타이핑에 즉시 따라붙는다.
  // 탭 리렌더를 기다리면 미러가 늦게 갱신돼 문서가 아니라 폼처럼 보인다.
  const headTitle = el("h3", { class: "world-canon-head-title", text: canon.name.trim() || "세계의 이름을 지어 보세요" });
  const headSub = el("p", { class: "world-canon-head-sub" });
  const renderHeadMirror = (): void => {
    const next = resolveWorldCanon(store.getCurrent().worldCanon);
    headTitle.textContent = next.name.trim() || "세계의 이름을 지어 보세요";
    if (next.premise.trim()) headSub.textContent = premiseQuote(next.premise);
    else {
      headSub.replaceChildren();
      headSub.append(
        el("strong", { text: "한 줄 전제" }),
        document.createTextNode("를 먼저 적어 보세요 — 조수가 이 세계를 읽는 첫 줄이 됩니다."),
      );
    }
  };
  renderHeadMirror();
  const workspace = workspaceShell({
      testid: "db-world-canon-workspace",
      header: el("header", {
        class: "world-document-toolbar",
        dataset: { testid: "db-world-canon-hero" },
        children: [
          el("strong", { text: "세계 개요" }),
          el("span", { class: "world-ai-scope-label", text: `AI 참고 · 핵심 설정 + 본문 앞 ${EXCERPT_MAX}자` }),
        ],
      }),
      detail: detailPane({
        body: [el("div", {
          class: "world-document-layout",
          children: [
            el("div", {
              class: "world-document-content",
              children: [
                el("div", {
                  class: "world-canon-spread-head",
                  children: [
                    el("span", { class: "world-canon-kicker", text: "세계 안내서 · 한 장" }),
                    headTitle,
                    headSub,
                    el("div", {
                      class: "world-canon-meter",
                      children: [
                        el("div", { class: "world-canon-meter-bar", children: [meterFill] }),
                        meterText,
                      ],
                    }),
                    heroStats,
                  ],
                }),
                identityCard(canon),
                frameCard,
                lawsCard,
                bodyCard,
              ],
            }),
            properties,
          ],
        })],
      }),
    });
  workspace.classList.add("world-document-workspace", "world-canon-workspace");
  workspace.addEventListener("input", updateAiPreview);
  workspace.addEventListener("input", renderHeadMirror);
  host.append(workspace);
}

function premiseQuote(premise: string): string {
  const text = premise.trim();
  return text.startsWith("\"") || text.startsWith("“") || text.startsWith("'") ? text : `"${text}"`;
}

function identityCard(canon: ResolvedWorldCanon): HTMLElement {
  const name = el("input", {
    class: "db-world-canon-name",
    attrs: {
      type: "text",
      placeholder: "이 세계의 이름",
      "aria-label": "세계 이름",
      maxlength: String(WORLD_CANON_BOUNDS.name),
      title: `세계 이름: ${WORLD_CANON_BOUNDS.name}자까지`,
    },
    value: canon.name,
    dataset: { testid: "db-world-canon-name" },
  });
  name.addEventListener("input", () => writeCanon({ name: name.value }, "db-world-canon-name"));
  const premise = el("textarea", {
    class: "db-world-canon-premise",
    attrs: {
      rows: "2",
      placeholder: "한 줄로, 이 세계는 어떤 곳인가",
      "aria-label": "한 줄 전제",
      maxlength: String(WORLD_CANON_BOUNDS.premise),
      title: `한 줄 전제: ${WORLD_CANON_BOUNDS.premise}자까지`,
    },
    value: canon.premise,
    dataset: { testid: "db-world-canon-premise" },
  });
  premise.addEventListener("input", () => writeCanon({ premise: premise.value }, "db-world-canon-premise"));
  return sectionCard({
    title: "이름과 한 줄",
    hint: "AI가 항상 읽는 한 장의 첫 줄",
    testid: "db-world-canon-identity",
    children: [
      name,
      premise,
    ],
  });
}

