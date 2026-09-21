import { segmentedControl } from "@/editor/panels/databaseControls";
import {
  absenceEditor,
  bodyField,
  boundedCanonText,
  lawCard,
  toneRow,
  writeCanon,
  WORLD_CANON_TONE_LABELS,
} from "@/editor/panels/databaseWorldCanonFields";
import { detailPane, inspectorTabs, sectionCard, statStrip, workspaceShell } from "@/editor/panels/databaseWorkspace";
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
const activeSpreadTab = new WeakMap<HTMLElement, string>();

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
  // "조수 전달" 탭의 라이브 값들. 탭 패널은 지연 생성되므로 refs 가 없을 수 있다 — 있을 때만 갱신.
  const aiRefs: { pre?: HTMLElement; tiles?: Map<string, { item: HTMLElement; value: HTMLElement }> } = {};
  const aiTileDefs = [
    {
      key: "premise",
      label: "한 줄 전제",
      value: (c: ResolvedWorldCanon) => c.premise.trim() || "미작성",
      tone: (c: ResolvedWorldCanon) => (c.premise.trim() ? "ok" : "missing"),
    },
    {
      key: "tones",
      label: "톤",
      value: (c: ResolvedWorldCanon) => (c.tones.length ? c.tones.map((tone) => WORLD_CANON_TONE_LABELS[tone]).join(", ") : "미작성"),
      tone: (c: ResolvedWorldCanon) => (c.tones.length ? "ok" : "missing"),
    },
    {
      key: "absences",
      label: "없는 것(절대 금지)",
      value: (c: ResolvedWorldCanon) => (c.absences.length ? `${c.absences.length}개 — ${c.absences.join(", ")}` : "미지정"),
      tone: (c: ResolvedWorldCanon) => (c.absences.length ? "ok" : "warn"),
    },
    {
      key: "laws",
      label: "법칙 확정",
      value: (c: ResolvedWorldCanon) => {
        const unset = WORLD_CANON_LAW_KINDS.filter((kind) => c.laws[kind].present === undefined).length;
        return unset === 0 ? "4 / 4 확정" : `${4 - unset} / 4 확정 · 미정 ${unset}`;
      },
      tone: (c: ResolvedWorldCanon) => (WORLD_CANON_LAW_KINDS.every((kind) => c.laws[kind].present !== undefined) ? "ok" : "warn"),
    },
    {
      key: "body",
      label: "본문 발췌",
      value: (c: ResolvedWorldCanon) => {
        const filled = c.body.trim().length;
        return filled > EXCERPT_MAX ? `앞 ${EXCERPT_MAX.toLocaleString()}자 / 뒤 ${(filled - EXCERPT_MAX).toLocaleString()}자 잘림` : `앞 ${filled.toLocaleString()}자 / ${EXCERPT_MAX.toLocaleString()}자`;
      },
      tone: (c: ResolvedWorldCanon) => (c.body.trim().length > EXCERPT_MAX ? "warn" : "ok"),
    },
  ];
  const updateAiTiles = (): void => {
    if (!aiRefs.tiles) return;
    const next = resolveWorldCanon(store.getCurrent().worldCanon);
    for (const def of aiTileDefs) {
      const ref = aiRefs.tiles.get(def.key);
      if (!ref) continue;
      ref.value.textContent = def.value(next);
      ref.item.dataset.tone = def.tone(next);
    }
  };
  const updateAiPreview = (): void => {
    const section = worldCanonPromptSection(store.getCurrent().worldCanon) ?? "아직 AI에 전달할 설정이 없습니다.";
    aiPreview.textContent = section;
    if (aiRefs.pre) aiRefs.pre.textContent = section;
    updateAiTiles();
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
  const spreadHead = el("div", {
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
  });

  // ---- 탭 1: 문서 (기존 스프레드 전체) ----
  const documentPanel = el("div", {
    class: "world-canon-tab-body",
    children: [identityCard(canon), frameCard, lawsCard, bodyCard],
  });
  // ---- 탭 2: 조수 전달 (AI 프롬프트 투영 + 전달 상태) ----
  const buildAiPanel = (): HTMLElement => {
    const wrap = el("div", { class: "world-canon-tab-body world-canon-ai-panel", dataset: { testid: "world-canon-ai-panel" } });
    wrap.append(el("p", {
      class: "world-canon-ai-lead",
      text: "조수가 매 턴 읽는 고정 블록이다. 여기 보이는 것 = 조수가 아는 것의 전부다. 고치려면 문서 탭에서 해당 필드를 수정하면 된다.",
    }));
    const grid = el("div", { class: "world-canon-ai-grid" });
    aiRefs.tiles = new Map();
    for (const def of aiTileDefs) {
      const value = el("span", { class: "world-canon-ai-grid-value" });
      const item = el("div", {
        class: "world-canon-ai-grid-item",
        children: [el("span", { class: "world-canon-ai-grid-label", text: def.label }), value],
      });
      aiRefs.tiles.set(def.key, { item, value });
      grid.append(item);
    }
    aiRefs.pre = el("pre", { class: "world-ai-preview world-canon-ai-pre", dataset: { testid: "world-canon-ai-panel-preview" } });
    wrap.append(grid, sectionCard({
      title: "조수 프롬프트 투영",
      hint: "worldCanonPromptSection — 이름·전제·톤·없는 것·법칙 + 본문 발췌",
      children: [aiRefs.pre],
    }));
    updateAiPreview();
    return wrap;
  };
  const unsetCount = WORLD_CANON_LAW_KINDS.filter((kind) => canon.laws[kind].present === undefined).length;
  const tabs = inspectorTabs({
    sections: [
      { id: "document", label: "문서", build: () => documentPanel },
      { id: "ai", label: "조수 전달", ...(unsetCount > 0 ? { badge: `미정 ${unsetCount}` } : {}), build: buildAiPanel },
    ],
    activeId: activeSpreadTab.get(host),
    onChange: (id) => activeSpreadTab.set(host, id),
    testidPrefix: "db-ws-section",
  });

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
              children: [spreadHead, tabs],
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

