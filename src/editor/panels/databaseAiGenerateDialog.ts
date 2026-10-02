// editor/panels/databaseAiGenerateDialog.ts
// 데이터베이스 「AI로 생성」 대화상자(몬스터·아이템).
//
// 2026-09-03 재작성. 실측 문제: (1) `db-enemy-dialog` 껍데기를 빌려 써서 Win98 식 파란
// 그라디언트 헤더·MS PGothic·420px 창이 됐다 — 30탭을 studio-v2 로 통일한 DB 창 안에서
// 유일하게 다른 시대의 창이었다. (2) 진행은 평문 한 줄, 완료도 「완료: 이름 (id)」 평문뿐이라
// 2.9초 뒤 무엇이 생겼는지(수치·그림)를 대화상자 안에서 볼 수 없었다. (3) 그림 생성이 76초
// 걸리는데 단계 구분이 없어 멈춘 것처럼 보였다.
//
// 지금: 스튜디오 문법(흰 면·12px 라운딩·14px 읽는 글자)의 자체 껍데기, 예시 칩, 단계 상태줄
// (정보 → 그림 → 등록), 완료 카드(핵심 수치 + 그림), 「하나 더 만들기」. 기존 testid 와 상태
// 접두어(「완료」/「실패」)는 캡처 스크립트(scripts/capture-ai-db-generate.mts)가 읽으므로 유지한다.
//
// 이 파일은 databaseRecordViews 에서 **동적 import** 로만 불린다(정적이면 출하 번들 부팅이
// 순환 초기화로 죽는다 — test/databaseAiGenerateLazyImport.test.ts).

import { loadAiConfig, type AiConfig } from "@/ai/llmClient";
import { IMAGE_GENERATION_PROVIDER_ID, imageGenerationUsesOtherProvider } from "@/ai/imageGenerationClient";
import { flattenGeneratedArtwork } from "@/editor/aiArtworkCanvas";
import {
  generateDatabaseRecordWithAi,
  type AiDatabaseGenerationDeps,
  type AiDatabaseGenerationInput,
  type AiDatabaseGenerationOutcome,
  type AiDatabaseGenerationPhase,
  type AiDatabaseKind,
} from "@/editor/aiDatabaseGeneration";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { buildSvgIcon, type SvgNodeSpec } from "@/editor/panels/tileToolbarIcons";
import { store } from "@/project/store";
import type { EnemyRecord, ItemRecord } from "@/project/types";
import { el } from "@/util/dom";

const KIND_LABEL: Record<AiDatabaseKind, string> = { enemy: "몬스터", item: "아이템" };

const PLACEHOLDER: Record<AiDatabaseKind, string> = {
  enemy: "어떤 몬스터인지 한두 문장으로. 사는 곳·싸우는 방식·난이도를 적으면 수치가 맞게 나옵니다.",
  item: "어떤 아이템인지 한두 문장으로. 언제 쓰는지·효과·구하는 시기를 적으면 값이 맞게 나옵니다.",
};

// 예시는 입력을 채우기만 한다 — 누른 즉시 생성하면 의도와 다른 레코드에 돈과 시간을 쓴다.
const EXAMPLES: Record<AiDatabaseKind, readonly { readonly label: string; readonly brief: string }[]> = {
  enemy: [
    { label: "서슬 늑대", brief: "얼음 동굴에 사는 서슬 늑대. 빠르고 물리 공격 위주, 초중반 난이도." },
    { label: "습지 두꺼비", brief: "독을 뿜는 습지 두꺼비. 느리지만 맷집이 좋고 독 상태를 건다. 초반 난이도." },
    { label: "폐광 감시자", brief: "버려진 광산을 지키는 돌 감시자. 방어가 매우 높고 마법에 약한 중반 보스급." },
  ],
  item: [
    { label: "상급 회복약", brief: "전투 중에도 쓸 수 있는 상급 회복약. HP 를 넉넉히 회복한다. 중반 상점 판매." },
    { label: "여행자의 빵", brief: "필드에서만 먹는 소박한 빵. HP 를 조금 회복하고 값이 싸다. 초반." },
    { label: "고대 두루마리", brief: "한 번 읽으면 사라지는 고대 두루마리. 아군 전체의 MP 를 회복한다. 희귀." },
  ],
};

const PHASE_TEXT: Record<AiDatabaseKind, Record<AiDatabaseGenerationPhase, string>> = {
  enemy: {
    text: "몬스터 정보를 만드는 중…",
    artwork: "몬스터 그림을 그리는 중… 30초 이상 걸릴 수 있어요",
    apply: "데이터베이스에 등록하는 중…",
  },
  item: {
    text: "아이템 정보를 만드는 중…",
    artwork: "아이템 아이콘을 그리는 중… 30초 이상 걸릴 수 있어요",
    apply: "데이터베이스에 등록하는 중…",
  },
};

type DialogPhase = "idle" | AiDatabaseGenerationPhase | "done" | "error";

const ICONS: Readonly<Record<"sparkle" | "close" | "check", readonly SvgNodeSpec[]>> = {
  sparkle: [
    { tag: "path", attrs: { d: "M11 3l1.7 4.6L17.3 9.3 12.7 11 11 15.6 9.3 11 4.7 9.3 9.3 7.6z" } },
    { tag: "path", attrs: { d: "M17.5 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" } },
  ],
  close: [{ tag: "path", attrs: { d: "M6 6l10 10M16 6L6 16" } }],
  check: [{ tag: "path", attrs: { d: "M5 11.5l4 4 8-9" } }],
};

function icon(name: keyof typeof ICONS): SVGSVGElement {
  const svg = buildSvgIcon(ICONS[name]);
  svg.setAttribute("class", "db-ai-generate-icon");
  return svg;
}

export interface OpenAiGenerateDialogDeps {
  readonly generate?: (input: AiDatabaseGenerationInput, deps?: AiDatabaseGenerationDeps) => Promise<AiDatabaseGenerationOutcome>;
  readonly loadConfig?: () => AiConfig;
  /** 완료 카드가 읽는 레코드. 기본은 store 의 현재 프로젝트. */
  readonly readRecord?: (kind: AiDatabaseKind, id: string) => EnemyRecord | ItemRecord | undefined;
}

export interface OpenAiGenerateDialogOptions {
  readonly kind: AiDatabaseKind;
  readonly rerender: () => void;
  readonly deps?: OpenAiGenerateDialogDeps;
}

function defaultReadRecord(kind: AiDatabaseKind, id: string): EnemyRecord | ItemRecord | undefined {
  const database = store.getCurrent().database;
  return kind === "item"
    ? database.items.find((entry) => entry.id === id)
    : database.enemies.find((entry) => entry.id === id);
}

const ITEM_TYPE_LABEL: Record<string, string> = {
  medicine: "약",
  normalGoods: "일반",
  book: "책",
  seed: "씨앗",
  special: "특수",
};

const OCCASION_LABEL: Record<string, string> = {
  always: "언제나",
  battle: "전투 중",
  field: "필드에서",
  never: "사용 불가",
};

/** 완료 카드의 핵심 수치 — 종류별로 「이게 맞는 값인가」를 4~6칸으로 답한다. */
export function recordFacts(kind: AiDatabaseKind, record: EnemyRecord | ItemRecord | undefined): readonly { readonly label: string; readonly value: string }[] {
  if (!record) return [];
  if (kind === "enemy") {
    const enemy = record as EnemyRecord;
    return [
      { label: "HP", value: String(enemy.stats?.maxHp ?? "—") },
      { label: "공격", value: String(enemy.stats?.attack ?? "—") },
      { label: "방어", value: String(enemy.stats?.defense ?? "—") },
      { label: "민첩", value: String(enemy.stats?.agility ?? "—") },
      { label: "경험치", value: String(enemy.rewards?.exp ?? "—") },
      { label: "골드", value: String(enemy.rewards?.gold ?? "—") },
    ];
  }
  const item = record as ItemRecord;
  const recovery = item.hpRecovery
    ? [item.hpRecovery.flat ? `${item.hpRecovery.flat}` : "", item.hpRecovery.percentMax ? `${item.hpRecovery.percentMax}%` : ""].filter(Boolean).join(" + ") || "없음"
    : "없음";
  return [
    { label: "가격", value: `${item.price ?? "—"}G` },
    { label: "종류", value: ITEM_TYPE_LABEL[item.type] ?? item.type ?? "—" },
    { label: "사용", value: OCCASION_LABEL[item.occasion] ?? item.occasion ?? "—" },
    { label: "HP 회복", value: recovery },
  ];
}

export function openDatabaseAiGenerateDialog(options: OpenAiGenerateDialogOptions): HTMLElement {
  const { kind, rerender } = options;
  const deps = options.deps ?? {};
  const generate = deps.generate ?? generateDatabaseRecordWithAi;
  const readRecord = deps.readRecord ?? defaultReadRecord;
  const label = KIND_LABEL[kind];
  const config = (deps.loadConfig ?? loadAiConfig)();
  const opener = typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const overlay = el("div", {
    class: "db-ai-generate-backdrop",
    dataset: { testid: `db-ai-generate-dialog-${kind}` },
  });

  const titleId = `db-ai-generate-title-${kind}`;
  const briefId = `db-ai-generate-brief-${kind}`;
  const brief = el("textarea", {
    class: "db-ai-generate-brief",
    attrs: { id: briefId, rows: "3", placeholder: PLACEHOLDER[kind] },
    dataset: { testid: "db-ai-generate-brief" },
  }) as HTMLTextAreaElement;

  const examples = el("div", {
    class: "db-ai-generate-examples",
    attrs: { role: "group", "aria-label": "예시 설명" },
    children: EXAMPLES[kind].map((example, index) => el("button", {
      class: "db-ai-generate-example",
      text: example.label,
      attrs: { type: "button", title: example.brief },
      dataset: { testid: `db-ai-generate-example-${index}` },
      on: {
        click: () => {
          brief.value = example.brief;
          brief.focus();
          brief.setSelectionRange(example.brief.length, example.brief.length);
        },
      },
    })),
  });

  const artworkToggle = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "db-ai-generate-artwork" },
  }) as HTMLInputElement;
  artworkToggle.checked = true;
  const otherProvider = imageGenerationUsesOtherProvider(config);
  const artworkOption = el("label", {
    class: "db-ai-generate-option",
    children: [
      artworkToggle,
      el("span", {
        class: "db-ai-generate-option-text",
        children: [
          el("strong", { text: kind === "item" ? "아이콘 그림도 함께 만들기" : "몬스터 그림도 함께 만들기" }),
          el("small", { text: "그림은 30초 이상 걸릴 수 있어요. 끄면 정보만 몇 초 안에 만들어요." }),
          ...(otherProvider
            ? [el("small", {
              class: "db-ai-generate-provider-notice",
              text: `선택한 그림 제공자: ${config.imageProviderId ?? IMAGE_GENERATION_PROVIDER_ID} (대화 제공자: ${config.providerId}).`,
              dataset: { testid: "db-ai-generate-provider-notice" },
            })]
            : []),
        ],
      }),
    ],
  });

  // ── 상태줄 + 완료 카드 ───────────────────────────────────────────────────
  const statusIcon = el("span", { class: "db-ai-generate-status-icon", attrs: { "aria-hidden": "true" } });
  const statusText = el("span", { class: "db-ai-generate-status-text" });
  const status = el("p", {
    class: "db-ai-generate-status",
    attrs: { role: "status", "aria-live": "polite" },
    dataset: { testid: "db-ai-generate-status", phase: "idle" },
    children: [statusIcon, statusText],
  });
  const preview = el("img", {
    class: "db-ai-generate-preview",
    dataset: { testid: "db-ai-generate-preview" },
  }) as HTMLImageElement;
  preview.hidden = true;
  preview.alt = `생성된 ${label} 그림 미리보기`;
  const resultName = el("strong", { class: "db-ai-generate-result-name" });
  const resultId = el("code", { class: "db-ai-generate-result-id" });
  const resultFacts = el("dl", { class: "db-ai-generate-facts" });
  const result = el("section", {
    class: "db-ai-generate-result",
    attrs: { "aria-label": `만들어진 ${label}` },
    dataset: { testid: "db-ai-generate-result" },
    children: [
      el("div", { class: "db-ai-generate-result-art", children: [preview] }),
      el("div", {
        class: "db-ai-generate-result-body",
        children: [
          el("div", { class: "db-ai-generate-result-head", children: [resultName, resultId] }),
          resultFacts,
          el("p", { class: "db-ai-generate-result-hint", text: "목록에서 선택된 상태로 등록됐어요. 닫으면 바로 편집할 수 있어요." }),
        ],
      }),
    ],
  });
  result.hidden = true;

  const runButton = el("button", {
    class: "db-ai-generate-btn primary",
    attrs: { type: "button", title: "Ctrl+Enter" },
    dataset: { testid: "db-ai-generate-run" },
    children: [icon("sparkle"), el("span", { class: "db-ai-generate-btn-label", text: "만들기" })],
  }) as HTMLButtonElement;
  const closeButton = el("button", {
    class: "db-ai-generate-btn",
    text: "닫기",
    attrs: { type: "button" },
    dataset: { testid: "db-ai-generate-close" },
  }) as HTMLButtonElement;
  const headerClose = el("button", {
    class: "db-ai-generate-x",
    attrs: { type: "button", "aria-label": "닫기", title: "닫기" },
    children: [icon("close")],
  }) as HTMLButtonElement;

  let controller: AbortController | null = null;
  let phase: DialogPhase = "idle";
  let finished = false;

  const setPhase = (next: DialogPhase, text: string): void => {
    phase = next;
    status.dataset.phase = next;
    statusText.textContent = text;
    status.hidden = next === "idle";
    statusIcon.replaceChildren(
      next === "done" ? icon("check") : el("span", { class: "db-ai-spinner" }),
    );
    statusIcon.hidden = next === "idle" || next === "error";
  };
  setPhase("idle", "");

  const setRunning = (running: boolean): void => {
    runButton.disabled = running;
    runButton.setAttribute("aria-busy", String(running));
    brief.disabled = running;
    artworkToggle.disabled = running;
    for (const chip of examples.querySelectorAll<HTMLButtonElement>("button")) chip.disabled = running;
    closeButton.textContent = running ? "취소" : "닫기";
    overlay.classList.toggle("is-running", running);
  };

  const dismiss = (): void => {
    controller?.abort();
    controller = null;
    unregisterModal(overlay);
    overlay.remove();
    // 열었던 「AI로 생성」 단추로 포커스를 돌려준다. rerender 가 그 노드를 갈아 끼웠으면 testid 로 다시 찾는다.
    const target = opener && opener.isConnected
      ? opener
      : document.querySelector<HTMLElement>("[data-testid='db-ai-generate-open']");
    try {
      target?.focus();
    } catch {
      // headless DOM
    }
  };

  const resetForAnother = (): void => {
    finished = false;
    brief.value = "";
    result.hidden = true;
    preview.hidden = true;
    preview.removeAttribute("src");
    setPhase("idle", "");
    runButton.querySelector(".db-ai-generate-btn-label")!.textContent = "만들기";
    brief.focus();
  };

  const showOutcome = (outcome: AiDatabaseGenerationOutcome): void => {
    const record = readRecord(kind, outcome.recordId);
    resultName.textContent = outcome.name;
    resultId.textContent = outcome.recordId;
    resultFacts.replaceChildren(
      ...recordFacts(kind, record).flatMap((fact) => [
        el("dt", { text: fact.label }),
        el("dd", { text: fact.value }),
      ]),
    );
    if (outcome.artworkDataUrl) {
      preview.src = outcome.artworkDataUrl;
      preview.hidden = false;
    } else {
      preview.hidden = true;
    }
    result.classList.toggle("has-art", Boolean(outcome.artworkDataUrl));
    result.hidden = false;
    finished = true;
    runButton.querySelector(".db-ai-generate-btn-label")!.textContent = "하나 더 만들기";
  };

  const run = (): void => {
    if (runButton.disabled) return;
    if (finished) {
      resetForAnother();
      return;
    }
    const text = brief.value.trim();
    if (!text) {
      setPhase("error", `만들 ${label}의 설명을 먼저 적어 주세요.`);
      brief.focus();
      return;
    }
    controller = new AbortController();
    const signal = controller.signal;
    setRunning(true);
    result.hidden = true;
    setPhase("text", PHASE_TEXT[kind].text);
    void generate(
      { kind, brief: text, config, withArtwork: kind === "item" && artworkToggle.checked, signal },
      {
        flattenArtwork: flattenGeneratedArtwork,
        onPhase: (next) => {
          if (signal.aborted) return;
          setPhase(next, PHASE_TEXT[kind][next]);
        },
      },
    )
      .then((outcome) => {
        if (signal.aborted) return;
        setSelectedRecordId(kind === "item" ? "items" : "enemies", outcome.recordId);
        rerender();
        showOutcome(outcome);
        setPhase("done", `완료 · 「${outcome.name}」을 만들었어요`);
      })
      .catch((error: unknown) => {
        if (signal.aborted) return;
        const detail = error instanceof Error ? error.message : String(error);
        setPhase("error", `실패 — ${detail}`);
      })
      .finally(() => {
        if (controller?.signal === signal) controller = null;
        setRunning(false);
      });
  };

  runButton.addEventListener("click", run);
  brief.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      run();
    }
  });
  brief.addEventListener("input", () => {
    if (phase === "error") setPhase("idle", "");
  });
  closeButton.addEventListener("click", dismiss);
  headerClose.addEventListener("click", dismiss);
  overlay.addEventListener("click", (event) => {
    // 실행 중 바깥 클릭은 무시한다 — 76초짜리 그림 생성을 실수로 버리지 않게.
    if (event.target === overlay && !runButton.disabled) dismiss();
  });
  registerModal(overlay, dismiss);

  overlay.append(
    el("div", {
      class: "db-ai-generate",
      attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, tabindex: "-1" },
      children: [
        el("header", {
          class: "db-ai-generate-header",
          children: [
            el("span", { class: "db-ai-generate-mark", attrs: { "aria-hidden": "true" }, children: [icon("sparkle")] }),
            el("div", {
              class: "db-ai-generate-heading",
              children: [
                el("h2", { text: `AI로 ${label} 만들기`, attrs: { id: titleId } }),
                el("p", { text: `설명 한두 문장으로 ${label} 레코드를 만들어 바로 등록합니다.` }),
              ],
            }),
            headerClose,
          ],
        }),
        el("div", {
          class: "db-ai-generate-body",
          children: [
            el("label", { class: "db-ai-generate-label", text: `어떤 ${label}인가요?`, attrs: { for: briefId } }),
            brief,
            examples,
            // 몬스터는 그림을 만들지 않고 도트 몬스터를 고른다(2026-10-02).
            ...(kind === "item" ? [artworkOption] : []),
            status,
            result,
          ],
        }),
        el("footer", { class: "db-ai-generate-footer", children: [closeButton, runButton] }),
      ],
    }),
  );
  document.body.append(overlay);
  brief.focus();
  return overlay;
}
