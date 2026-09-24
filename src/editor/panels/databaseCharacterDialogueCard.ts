// 캐릭터 탭 「대화」 카드 — 화자 프로필(project.characters[id].dialogue).
//
// 비운 칸은 프로젝트 기본(시스템 「대화창」)을 따른다. 저장은 normalizeSpeakerDialogueProfile 을
// 거쳐 기본값과 같은 칸은 지운다. 견본 창과 「들어보기」는 게임과 같은 합성 규칙을 쓴다.

import { field, numberField } from "@/editor/panels/databaseControls";
import { sectionCard } from "@/editor/panels/databaseWorkspace";
import { renderDialogueLookSample } from "@/editor/panels/eventEditor/commandPreview";
import { createDialogueVoice } from "@/player/dialogueVoice";
import { listCharacterFaces } from "@/project/characterGraphics";
import { EMOTE_KINDS, emoteLabel } from "@/project/emotes";
import {
  DIALOGUE_CONTAINER_IDS,
  DIALOGUE_CONTAINER_LABELS,
  DIALOGUE_EMOTION_IDS,
  DIALOGUE_EMOTION_LABELS,
  DIALOGUE_PITCH_LIMITS,
  DIALOGUE_SPEED_LIMITS,
  DIALOGUE_STYLE_IDS,
  DIALOGUE_STYLES,
  DIALOGUE_VOICE_IDS,
  DIALOGUE_VOICE_LABELS,
  resolveDialogueLook,
  resolveDialogueStyleId,
  type DialogueEmotionId,
  type SpeakerDialogueProfile,
  type SpeakerExpression,
} from "@/project/dialogueStyles";
import { FONT_REGISTRY } from "@/project/fontRegistry";
import { store } from "@/project/store";
import type { CharacterProfile } from "@/project/types";
import { el } from "@/util/dom";

const INHERIT = "";
const SAMPLE_BODY = "안녕! 오늘도 날씨가 좋네. 같이 광장까지 걸어갈래?";
const LISTEN_STEP_MS = 42;

/** databaseControls.selectField 는 「(없음)」 칸을 스스로 붙인다 — 여기서는 빈 값이 「기본을 따름」이라 직접 만든다. */
function inheritSelect(
  label: string,
  testid: string,
  value: string,
  options: readonly { readonly id: string; readonly name: string }[],
  onChange: (value: string) => void,
): HTMLElement {
  const select = el("select", { dataset: { testid } }) as HTMLSelectElement;
  for (const option of options) select.append(el("option", { text: option.name, attrs: { value: option.id } }));
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return field(label, select);
}

export function characterDialogueCard(
  characterId: string,
  profile: CharacterProfile,
  patchDialogue: (patch: Partial<Record<keyof SpeakerDialogueProfile, unknown>>) => void,
): HTMLElement {
  const dialogue = profile.dialogue ?? {};
  const speakerName = profile.displayName?.trim() || characterId;
  const previewHost = el("div", { class: "db-character-dialogue-preview", dataset: { testid: "db-character-dialogue-preview" } });

  const lookNow = () => resolveDialogueLook(store.getCurrent(), { characterId, speaker: speakerName });
  const refreshPreview = () => {
    previewHost.replaceChildren(renderDialogueLookSample(speakerName, SAMPLE_BODY, lookNow()));
  };
  const apply = (patch: Partial<Record<keyof SpeakerDialogueProfile, unknown>>) => {
    patchDialogue(patch);
    refreshPreview();
  };
  refreshPreview();

  const projectStyle = DIALOGUE_STYLES[resolveDialogueStyleId(store.getCurrent().system.dialogueStyle)];
  const styleOptions = [
    { id: INHERIT, name: `프로젝트 기본 (${projectStyle.label})` },
    ...DIALOGUE_STYLE_IDS.map((id) => ({ id, name: DIALOGUE_STYLES[id].label })),
  ];
  const voiceOptions = [
    { id: INHERIT, name: "대화창 스타일 기본" },
    ...DIALOGUE_VOICE_IDS.map((id) => ({ id, name: DIALOGUE_VOICE_LABELS[id] })),
  ];
  const fontOptions = [
    { id: INHERIT, name: "대화창 스타일 기본" },
    ...FONT_REGISTRY.map((font) => ({ id: font.id, name: font.label })),
  ];

  const containerOptions = [
    { id: INHERIT, name: "대사 상자 (기본)" },
    ...DIALOGUE_CONTAINER_IDS.filter((id) => id !== "box").map((id) => ({ id, name: DIALOGUE_CONTAINER_LABELS[id] })),
  ];
  const faceOptions = [
    { id: INHERIT, name: "없음" },
    ...listCharacterFaces(store.getCurrent()).map((face) => ({ id: face.resourceId, name: face.label })),
  ];

  const colorInput = el("input", {
    attrs: { type: "color", "aria-label": "이름 색" },
    dataset: { testid: "db-character-dialogue-name-color" },
  }) as HTMLInputElement;
  colorInput.value = dialogue.nameColor ?? "#ffffff";
  const colorClear = el("button", {
    class: "db-ws-btn",
    attrs: { type: "button" },
    text: "기본 색",
    dataset: { testid: "db-character-dialogue-name-color-clear" },
  });
  colorClear.hidden = !dialogue.nameColor;
  colorInput.addEventListener("input", () => {
    apply({ nameColor: colorInput.value });
    colorClear.hidden = false;
  });
  colorClear.addEventListener("click", () => {
    apply({ nameColor: undefined });
    colorClear.hidden = true;
  });

  const listen = el("button", {
    class: "db-ws-btn db-ws-btn-primary",
    attrs: { type: "button" },
    text: "▶ 들어보기",
    dataset: { testid: "db-character-dialogue-listen" },
  });
  listen.addEventListener("click", () => {
    const voice = createDialogueVoice(lookNow());
    const chars = Array.from(SAMPLE_BODY);
    const speed = store.getCurrent().characters?.[characterId]?.dialogue?.speed ?? 1;
    chars.forEach((char, index) => {
      window.setTimeout(() => voice.speak(char), (index * LISTEN_STEP_MS) / speed);
    });
  });

  return sectionCard({
    title: "대화",
    hint: "이 인물이 말할 때의 대사창·이름 색·목소리입니다. 비운 칸은 시스템 「대화창」 설정을 따릅니다.",
    testid: "db-character-dialogue-card",
    children: [
      previewHost,
      inheritSelect("대화창", "db-character-dialogue-style", dialogue.style ?? INHERIT, styleOptions, (value) => apply({ style: value || undefined })),
      el("div", {
        class: "db-field db-character-dialogue-color",
        children: [
          el("span", { text: "이름 색", attrs: { title: "이름 색" } }),
          el("span", { class: "db-character-dialogue-color-row", children: [colorInput, colorClear] }),
        ],
      }),
      inheritSelect("목소리", "db-character-dialogue-voice", dialogue.voice ?? INHERIT, voiceOptions, (value) => apply({ voice: value || undefined })),
      numberField(
        "음 높이 (반음)",
        "db-character-dialogue-pitch",
        dialogue.pitch ?? 0,
        (value) => apply({ pitch: value }),
        { min: DIALOGUE_PITCH_LIMITS.min, max: DIALOGUE_PITCH_LIMITS.max, step: 1 },
      ),
      numberField(
        "말 빠르기 (배)",
        "db-character-dialogue-speed",
        dialogue.speed ?? 1,
        (value) => apply({ speed: value }),
        { min: DIALOGUE_SPEED_LIMITS.min, max: DIALOGUE_SPEED_LIMITS.max, step: 0.1 },
      ),
      inheritSelect("글꼴", "db-character-dialogue-font", dialogue.font ?? INHERIT, fontOptions, (value) => apply({ font: value || undefined })),
      inheritSelect("대화창 그릇", "db-character-dialogue-container", dialogue.container ?? INHERIT, containerOptions, (value) => apply({ container: value || undefined })),
      inheritSelect("입 벌린 얼굴", "db-character-dialogue-talk-face", dialogue.talkFace ?? INHERIT, faceOptions, (value) => apply({ talkFace: value || undefined })),
      expressionTable(dialogue.expressions ?? {}, faceOptions, (expressions) => apply({ expressions })),
      listen,
    ],
  });
}

/**
 * 표정 표 — [표정:기쁨] 태그·대사 명령의 감정이 부르는 얼굴·음높이·이모트.
 * 얼굴은 낱장 얼굴 리소스 하나(칸 번호 없음). 비운 칸은 기본 얼굴·음높이를 그대로 쓴다.
 */
function expressionTable(
  initial: Partial<Record<DialogueEmotionId, SpeakerExpression>>,
  faceOptions: readonly { readonly id: string; readonly name: string }[],
  onChange: (expressions: Partial<Record<DialogueEmotionId, SpeakerExpression>> | undefined) => void,
): HTMLElement {
  const draft: Partial<Record<DialogueEmotionId, SpeakerExpression>> = { ...initial };
  const commit = (emotion: DialogueEmotionId, patch: Partial<SpeakerExpression>) => {
    const next: SpeakerExpression = { ...draft[emotion], ...patch };
    const cleaned = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined && value !== "" && value !== 0));
    if (Object.keys(cleaned).length === 0) delete draft[emotion];
    else draft[emotion] = cleaned as SpeakerExpression;
    onChange(Object.keys(draft).length > 0 ? { ...draft } : undefined);
  };
  const rows = DIALOGUE_EMOTION_IDS.map((emotion) => {
    const entry = draft[emotion] ?? {};
    const face = el("select", { dataset: { testid: `db-character-expression-${emotion}-face` }, attrs: { "aria-label": `${DIALOGUE_EMOTION_LABELS[emotion]} 얼굴` } }) as HTMLSelectElement;
    for (const option of faceOptions) face.append(el("option", { text: option.name, attrs: { value: option.id } }));
    face.value = entry.face ?? "";
    face.addEventListener("change", () => commit(emotion, { face: face.value || undefined }));
    const pitch = el("input", {
      attrs: { type: "number", min: String(DIALOGUE_PITCH_LIMITS.min), max: String(DIALOGUE_PITCH_LIMITS.max), step: "1", "aria-label": `${DIALOGUE_EMOTION_LABELS[emotion]} 음높이` },
      dataset: { testid: `db-character-expression-${emotion}-pitch` },
    }) as HTMLInputElement;
    pitch.value = String(entry.pitch ?? 0);
    pitch.addEventListener("change", () => commit(emotion, { pitch: Number(pitch.value) || undefined }));
    const emote = el("select", { dataset: { testid: `db-character-expression-${emotion}-emote` }, attrs: { "aria-label": `${DIALOGUE_EMOTION_LABELS[emotion]} 이모트` } }) as HTMLSelectElement;
    emote.append(el("option", { text: "없음", attrs: { value: "" } }));
    for (const kind of EMOTE_KINDS) emote.append(el("option", { text: emoteLabel(kind), attrs: { value: kind } }));
    emote.value = entry.emote ?? "";
    emote.addEventListener("change", () => commit(emotion, { emote: (emote.value || undefined) as SpeakerExpression["emote"] }));
    return el("tr", { children: [
      el("th", { text: DIALOGUE_EMOTION_LABELS[emotion], attrs: { scope: "row" } }),
      el("td", { children: [face] }),
      el("td", { children: [pitch] }),
      el("td", { children: [emote] }),
    ] });
  });
  return el("div", {
    class: "db-field db-character-expression-field",
    dataset: { testid: "db-character-dialogue-expressions" },
    children: [
      el("span", { text: "표정", attrs: { title: "표정" } }),
      el("table", { class: "db-character-expression-table", children: [
        el("thead", { children: [el("tr", { children: ["감정", "얼굴", "음높이", "이모트"].map((text) => el("th", { text, attrs: { scope: "col" } })) })] }),
        el("tbody", { children: rows }),
      ] }),
    ],
  });
}
