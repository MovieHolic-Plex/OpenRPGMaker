import { segmentedControl } from "@/editor/panels/databaseControls";
import {
  absenceEditor,
  bodyField,
  boundedCanonText,
  lawRow,
  toneRow,
  writeCanon,
} from "@/editor/panels/databaseWorldCanonFields";
import { detailPane, sectionCard, statStrip, workspaceShell } from "@/editor/panels/databaseWorkspace";
import { worldDocumentProperties } from "./worldDocumentProperties";
import { worldCanonPromptSection } from "@/ai/worldCanonContext";
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

export function renderWorldCanonTab(host: HTMLElement, rerender: () => void): void {
  const canon = resolveWorldCanon(store.getCurrent().worldCanon);
  const meterFill = el("i", {
    attrs: {
      role: "progressbar",
      "aria-label": "AI 전달 본문 분량",
      "aria-valuemin": "0",
      "aria-valuemax": "600",
      "aria-valuenow": String(Math.min(600, canon.body.trim().length)),
      style: `width:${Math.min(100, Math.round((Math.min(600, canon.body.trim().length) / 600) * 100))}%`,
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
      value: `${Math.min(600, canon.body.trim().length)} / 600자`,
      hint: canon.body.trim().length > 600 ? `뒤 ${canon.body.trim().length - 600}자 잘림` : "앞부분만 읽는다",
      tone: canon.body.trim().length > 600 ? "warn" : "neutral",
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
    meterFill.setAttribute("style", `width:${Math.min(100, Math.round((Math.min(600, filled) / 600) * 100))}%`);
    meterFill.setAttribute("aria-valuenow", String(Math.min(600, filled)));
    const statTile = heroStats.querySelector("[data-testid='db-world-canon-hero-stat-body']");
    const statValue = statTile?.querySelector(".db-ws-stat-value");
    if (statValue) statValue.textContent = `${Math.min(600, filled)} / 600자`;
    const statHint = statTile?.querySelector(".db-ws-stat-hint");
    if (statHint) statHint.textContent = filled > 600 ? `뒤 ${filled - 600}자 잘림` : "앞부분만 읽는다";
    if (statTile) {
      statTile.classList.remove("db-ws-stat-neutral", "db-ws-stat-warn", "db-ws-stat-good", "db-ws-stat-bad");
      statTile.classList.add(filled > 600 ? "db-ws-stat-warn" : "db-ws-stat-neutral");
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
      boundedCanonText("시대", canon.era, (value) => writeCanon({ era: value }, "db-world-canon-era"), "db-world-canon-era", WORLD_CANON_BOUNDS.era),
      boundedCanonText("기술 수준", canon.techCeiling, (value) => writeCanon({ techCeiling: value }, "db-world-canon-tech"), "db-world-canon-tech", WORLD_CANON_BOUNDS.techCeiling),
      absenceEditor(canon.absences, rerender),
    ],
  });
  const lawsCard = sectionCard({
    title: "세계의 법칙",
    hint: "힘·신·죽음·돈 — 비어 있으면 AI가 멋대로 채운다",
    testid: "db-world-canon-laws",
    children: [el("div", {
      class: "world-canon-law-grid",
      children: WORLD_CANON_LAW_KINDS.map((kind) => lawRow(kind, canon.laws[kind], rerender)),
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
  const workspace = workspaceShell({
      testid: "db-world-canon-workspace",
      header: el("header", {
        class: "world-document-toolbar",
        dataset: { testid: "db-world-canon-hero" },
        children: [
          el("strong", { text: "세계 개요" }),
          el("span", { class: "world-ai-scope-label", text: "AI 참고 · 핵심 설정 + 본문 앞 600자" }),
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
                  class: "world-canon-meter",
                  children: [
                    el("div", { class: "world-canon-meter-bar", children: [meterFill] }),
                    meterText,
                  ],
                }),
                heroStats,
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
  host.append(workspace);
}

export function excerptHint(filled: number): string {
  const excerptLen = Math.min(600, filled);
  return filled > 600
    ? `역사·지형·문화·비밀 — 조수는 앞 600자를 본다 (뒤 ${filled - 600}자는 발췌 밖)`
    : `역사·지형·문화·비밀 — 조수는 앞 600자 중 ${excerptLen}자를 본다`;
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
