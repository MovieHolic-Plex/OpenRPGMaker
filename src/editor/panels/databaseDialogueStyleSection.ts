// 자료집 시스템 「대화창」 — 프로젝트 기본 대화창 스타일 고르기.
//
// 카드마다 게임과 같은 규칙(dialogue.css + dialogueStyles.css)으로 그린 견본 창을 싣는다.
// 기본값(glass)은 저장에서 지운다 — normalizeSystemRecords 와 같은 계약.
// 화자별 모양·목소리는 캐릭터 탭 「대화」 카드, 한 줄 단위는 대사 명령의 「대사 종류」가 맡는다.

import { field, numberField, toggleSwitch } from "@/editor/panels/databaseControls";
import { renderDialogueLookSample } from "@/editor/panels/eventEditor/commandPreview";
import {
  DEFAULT_DIALOGUE_STYLE_ID,
  DIALOGUE_CONTAINER_DESCRIPTIONS,
  DIALOGUE_CONTAINER_IDS,
  DIALOGUE_CONTAINER_LABELS,
  DIALOGUE_CONTEXTS,
  DIALOGUE_INLINE_TAGS,
  DIALOGUE_PROJECT_SPEED_LIMITS,
  DIALOGUE_STYLE_IDS,
  DIALOGUE_STYLES,
  recommendedDialogueStyleForPreset,
  resolveDialogueLook,
  resolveDialogueStyleId,
  type DialogueContextId,
  type DialogueStyleId,
} from "@/project/dialogueStyles";
import { FONT_REGISTRY, isFontFamilyId } from "@/project/fontRegistry";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

export const DIALOGUE_STYLE_SAMPLE_SPEAKER = "마을 사람";
export const DIALOGUE_STYLE_SAMPLE_BODY = "어서 오게, 여행자.\n오늘은 바람이 참 좋구먼.";

const CONTEXT_SAMPLES: readonly { readonly context: DialogueContextId; readonly body: string }[] = [
  { context: "speech", body: "같이 가 줄 거지?" },
  { context: "narration", body: "그날 밤, 마을의 종이 울리지 않았다." },
  { context: "thought", body: "뭔가 숨기고 있어…" },
  { context: "shout", body: "모두 엎드려!" },
  { context: "radio", body: "여기는 본부, 응답하라." },
  { context: "sign", body: "← 북쪽 숲  ·  남쪽 항구 →" },
  { context: "letter", body: "사랑하는 딸에게. 이 편지를 읽을 즈음이면…" },
  { context: "system", body: "자동 저장되었습니다." },
];

export interface DialogueStyleSectionDeps {
  readonly updateSystem: (mutator: (draft: Project) => void) => void;
  readonly fieldset: (title: string, children: readonly HTMLElement[]) => HTMLElement;
  readonly help: (text: string) => HTMLElement;
}

export function dialogueStyleSection(project: Project, deps: DialogueStyleSectionDeps): HTMLElement[] {
  let current = project;
  let showcase = dialogueContextShowcase(project, deps);
  let extras = dialogueExtrasShowcase(project, deps);
  const refresh = (patch: Partial<Project["system"]>) => {
    current = { ...current, system: { ...current.system, ...patch } };
    const nextShowcase = dialogueContextShowcase(current, deps);
    showcase.replaceWith(nextShowcase);
    showcase = nextShowcase;
    const nextExtras = dialogueExtrasShowcase(current, deps);
    extras.replaceWith(nextExtras);
    extras = nextExtras;
  };
  const gallery = dialogueStyleGallery(project, deps, (style) => refresh({ dialogueStyle: style }));
  const settings = dialogueTextSettings(project, deps, refresh);
  return [gallery, settings, showcase, extras];
}

/** 글꼴·기본 말 빠르기·구두점 쉼 — 스타일과 따로 정하는 프로젝트 기본. 인물 프로필이 다시 덮을 수 있다. */
function dialogueTextSettings(
  project: Project,
  deps: DialogueStyleSectionDeps,
  refresh: (patch: Partial<Project["system"]>) => void,
): HTMLElement {
  const system = project.system;
  const font = el("select", { dataset: { testid: "db-system-dialogue-font" } }) as HTMLSelectElement;
  font.append(el("option", { text: "대화창 스타일 기본", attrs: { value: "" } }));
  for (const entry of FONT_REGISTRY) font.append(el("option", { text: entry.label, attrs: { value: entry.id } }));
  font.value = system.dialogueFont ?? "";
  font.addEventListener("change", () => {
    const value = font.value;
    deps.updateSystem((draft) => {
      if (isFontFamilyId(value)) draft.system.dialogueFont = value;
      else delete draft.system.dialogueFont;
    });
    refresh({ dialogueFont: isFontFamilyId(value) ? value : undefined });
  });
  return deps.fieldset("대사 글자", [
    deps.help("대사창 글꼴은 편집기 글꼴과 따로입니다. 빠르기는 모든 대사에 곱해지고, 인물마다 「말 빠르기」가 한 번 더 곱해집니다."),
    field("대화창 글꼴", font),
    numberField(
      "기본 말 빠르기 (배)",
      "db-system-dialogue-speed",
      system.dialogueSpeed ?? 1,
      (value) => {
        deps.updateSystem((draft) => {
          if (value === 1) delete draft.system.dialogueSpeed;
          else draft.system.dialogueSpeed = value;
        });
        refresh({ dialogueSpeed: value });
      },
      { min: DIALOGUE_PROJECT_SPEED_LIMITS.min, max: DIALOGUE_PROJECT_SPEED_LIMITS.max, step: 0.1 },
    ),
    toggleSwitch("쉼표·마침표에서 잠깐 쉬기", "db-system-dialogue-punctuation", system.dialoguePunctuationPause !== false, (on) => {
      deps.updateSystem((draft) => {
        if (on) delete draft.system.dialoguePunctuationPause;
        else draft.system.dialoguePunctuationPause = false;
      });
      refresh({ dialoguePunctuationPause: on ? undefined : false });
    }),
  ]);
}

/** 대사 그릇(상자·말풍선·흘림·코너)과 본문 태그 — 고르는 설정이 아니라 대사마다 쓰는 것, 견본만 보인다. */
function dialogueExtrasShowcase(project: Project, deps: DialogueStyleSectionDeps): HTMLElement {
  const containers = el("div", {
    class: "db-system-dialogue-context-grid",
    dataset: { testid: "db-system-dialogue-containers" },
  });
  for (const id of DIALOGUE_CONTAINER_IDS) {
    const look = resolveDialogueLook(project, { container: id });
    containers.append(el("figure", {
      class: "db-system-dialogue-context-card",
      dataset: { testid: `db-system-dialogue-container-${id}` },
      children: [
        renderDialogueLookSample("아린", id === "box" ? "여기서 기다릴게." : "저기 좀 봐!", look),
        el("figcaption", { children: [el("strong", { text: DIALOGUE_CONTAINER_LABELS[id] }), el("span", { text: DIALOGUE_CONTAINER_DESCRIPTIONS[id] })] }),
      ],
    }));
  }
  const tags = el("div", {
    class: "db-system-dialogue-context-grid",
    dataset: { testid: "db-system-dialogue-tags" },
  });
  for (const tag of DIALOGUE_INLINE_TAGS) {
    const visual = tag.id === "shake" || tag.id === "wave" || tag.id === "big" || tag.id === "small" || tag.id === "color";
    tags.append(el("figure", {
      class: "db-system-dialogue-context-card db-system-dialogue-tag-card",
      dataset: { testid: `db-system-dialogue-tag-${tag.id}` },
      children: [
        ...(visual ? [renderDialogueLookSample("아린", tag.sample, resolveDialogueLook(project, {}))] : []),
        el("figcaption", { children: [el("strong", { text: tag.sample }), el("span", { text: tag.description })] }),
      ],
    }));
  }
  return deps.fieldset("대사 그릇 · 본문 태그", [
    deps.help("대사 명령의 「대화창」으로 그릇을 고릅니다. 본문에 [흔들]…[/] 처럼 태그를 쓰면 그 구간만 효과가 붙습니다. 표정 태그 [표정:기쁨] 은 인물 「대화」의 표정 얼굴·음높이·이모트를 부릅니다."),
    containers,
    tags,
  ]);
}

function stateText(id: DialogueStyleId, selected: DialogueStyleId, recommended: DialogueStyleId): string {
  if (id === selected) return "✓ 선택됨";
  return id === recommended ? "장르 추천 · 선택하기" : "선택하기";
}

function statusText(selected: DialogueStyleId, recommended: DialogueStyleId, hasBrief: boolean): string {
  const current = `현재 대화창 · ${DIALOGUE_STYLES[selected].label}`;
  if (!hasBrief) return current;
  if (selected === recommended) return `${current} (기획 장르 추천과 같습니다)`;
  return `${current} · 기획 장르 추천은 「${DIALOGUE_STYLES[recommended].label}」`;
}

function dialogueStyleGallery(
  project: Project,
  deps: DialogueStyleSectionDeps,
  onSelect: (style: DialogueStyleId) => void,
): HTMLElement {
  const saved = resolveDialogueStyleId(project.system.dialogueStyle);
  const presetId = project.gameDesignBrief?.presetId;
  const recommended = recommendedDialogueStyleForPreset(presetId);
  let selected = saved;
  const cards = new Map<DialogueStyleId, HTMLButtonElement>();
  const status = el("p", {
    class: "db-system-menu-skin-description",
    attrs: { role: "status" },
    text: statusText(saved, recommended, Boolean(presetId)),
    dataset: { testid: "db-system-dialogue-style-status" },
  });
  const gallery = el("div", {
    class: "db-system-menu-skin-gallery db-system-dialogue-style-gallery",
    attrs: { role: "group", "aria-label": "대화창 스타일" },
    dataset: { testid: "db-field-system-dialogue-style" },
  });
  for (const id of DIALOGUE_STYLE_IDS) {
    const style = DIALOGUE_STYLES[id];
    const look = resolveDialogueLook(project, { style: id });
    const card = el("button", {
      class: "db-system-menu-skin-card db-system-dialogue-style-card",
      attrs: { type: "button", "aria-pressed": String(id === saved), "aria-label": style.label },
      dataset: { testid: `db-system-dialogue-style-${id}`, recommended: String(id === recommended && Boolean(presetId)) },
      children: [
        renderDialogueLookSample(DIALOGUE_STYLE_SAMPLE_SPEAKER, DIALOGUE_STYLE_SAMPLE_BODY, look),
        el("strong", { text: style.label }),
        el("span", { class: "db-system-menu-skin-card-description", text: `${style.description} ${style.fit}` }),
        el("span", { class: "db-system-menu-skin-card-state", text: stateText(id, saved, presetId ? recommended : saved) }),
      ],
    });
    card.addEventListener("click", () => {
      if (selected === id) return;
      deps.updateSystem((draft) => {
        if (id === DEFAULT_DIALOGUE_STYLE_ID) delete draft.system.dialogueStyle;
        else draft.system.dialogueStyle = id;
      });
      selected = id;
      for (const [key, button] of cards) {
        button.setAttribute("aria-pressed", String(key === id));
        const badge = button.querySelector(".db-system-menu-skin-card-state");
        if (badge) badge.textContent = stateText(key, id, presetId ? recommended : id);
      }
      status.textContent = statusText(id, recommended, Boolean(presetId));
      onSelect(id);
    });
    cards.set(id, card);
    gallery.append(card);
  }
  return deps.fieldset("대화창 스타일", [
    deps.help(
      "게임 전체 대사창의 기본 모양입니다. 스타일마다 어울리는 글꼴과 글자 소리가 함께 정해지며, "
        + "인물마다 다른 이름 색·목소리는 캐릭터 탭의 「대화」에서 덮어쓸 수 있습니다. 다음 테스트 플레이부터 적용됩니다.",
    ),
    status,
    gallery,
  ]);
}

/** 대사 종류는 고르는 설정이 아니라 대사 명령마다 쓰는 것이다 — 여기서는 현재 스타일 위에서 보여만 준다. */
function dialogueContextShowcase(project: Project, deps: DialogueStyleSectionDeps): HTMLElement {
  const grid = el("div", {
    class: "db-system-dialogue-context-grid",
    dataset: { testid: "db-system-dialogue-contexts" },
  });
  for (const sample of CONTEXT_SAMPLES) {
    const context = DIALOGUE_CONTEXTS[sample.context];
    const look = resolveDialogueLook(project, { context: sample.context });
    grid.append(el("figure", {
      class: "db-system-dialogue-context-card",
      dataset: { testid: `db-system-dialogue-context-${sample.context}` },
      children: [
        renderDialogueLookSample("아린", sample.body, look),
        el("figcaption", { children: [el("strong", { text: context.label }), el("span", { text: context.description })] }),
      ],
    }));
  }
  return deps.fieldset("대사 종류", [
    deps.help("대사 명령의 「대사 종류」로 한 줄씩 고릅니다. 내레이션·표지판·편지·안내는 이름과 얼굴을 숨기고, 외침은 창을 흔듭니다. 아래는 지금 고른 스타일 위에서의 모양입니다."),
    grid,
  ]);
}
