import { EASYRPG_MUSIC_ASSETS, EASYRPG_SOUND_ASSETS, type EasyRpgRtpAsset } from "@/assets/easyrpgRtp";
import { el } from "@/util/dom";

type AudioCategory = "music" | "sound";

type AudioDialogState = {
  category: AudioCategory;
  selectedIndex: number;
  playing: boolean;
};

type AudioControlSpec = {
  readonly label: string;
  readonly testId: string;
  readonly scale: readonly [string, string, string];
  readonly min: number;
  readonly max: number;
  readonly value: number;
};

const CATEGORY_LABELS: Readonly<Record<AudioCategory, string>> = {
  music: "음악",
  sound: "효과음",
};

const AUDIO_GROUPS: Readonly<Record<AudioCategory, readonly EasyRpgRtpAsset[]>> = {
  music: EASYRPG_MUSIC_ASSETS,
  sound: EASYRPG_SOUND_ASSETS,
};

export function openAudioTestDialog(): void {
  document.querySelector("[data-testid='audio-test-dialog']")?.remove();

  const state: AudioDialogState = { category: "music", selectedIndex: 0, playing: false };
  const closeButton = el("button", {
    class: "audio-test-close",
    text: "×",
    attrs: { type: "button", title: "닫기", "aria-label": "닫기" },
    dataset: { testid: "audio-test-window-close" },
  });
  const categoryTabs = el("div", { class: "audio-test-tabs", attrs: { role: "tablist", "aria-label": "오디오 종류" } });
  const list = el("div", {
    class: "audio-test-list",
    attrs: { role: "listbox", "aria-label": "오디오 목록" },
    dataset: { testid: "audio-test-list" },
  });
  const status = el("div", {
    class: "audio-test-status",
    text: "대기 중",
    attrs: { "aria-live": "polite" },
    dataset: { testid: "audio-test-status" },
  });
  const closeAction = el("button", {
    class: "audio-test-button",
    text: "닫기",
    attrs: { type: "button" },
    dataset: { testid: "audio-test-close" },
    on: { click: () => close() },
  });
  const body = el("div", {
    class: "audio-test-body",
    children: [
      el("section", { class: "audio-test-left", children: [categoryTabs, list] }),
      el("section", {
        class: "audio-test-right",
        children: [
          audioFieldset({ label: "페이드인 시간", testId: "audio-test-fade", scale: ["None", "5초", "10초"], min: 0, max: 10, value: 0 }),
          audioFieldset({ label: "음량", testId: "audio-test-volume", scale: ["0%", "50%", "100%"], min: 0, max: 100, value: 100 }),
          audioFieldset({ label: "템포", testId: "audio-test-tempo", scale: ["50%", "100%", "150%"], min: 50, max: 150, value: 100 }),
          audioFieldset({ label: "밸런스", testId: "audio-test-balance", scale: ["왼쪽", "중앙", "오른쪽"], min: -50, max: 50, value: 0 }),
          el("div", {
            class: "audio-test-actions",
            children: [
              el("button", {
                class: "audio-test-button",
                attrs: { type: "button" },
                children: [el("span", { class: "audio-test-play-icon", attrs: { "aria-hidden": "true" } }), "재생"],
                on: { click: () => setPlaying(true) },
              }),
              el("button", {
                class: "audio-test-button",
                attrs: { type: "button" },
                children: [el("span", { class: "audio-test-stop-icon", attrs: { "aria-hidden": "true" } }), "정지"],
                on: { click: () => setPlaying(false) },
              }),
            ],
          }),
          status,
        ],
      }),
    ],
  });
  const backdrop = el("div", {
    class: "audio-test-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "audio-test-dialog" },
    children: [
      el("section", {
        class: "audio-test-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "audio-test-title" },
        children: [
          el("header", {
            class: "audio-test-titlebar",
            children: [el("h2", { text: "음악/효과음 테스트", attrs: { id: "audio-test-title" } }), closeButton],
          }),
          body,
          el("footer", { class: "audio-test-footer", children: [closeAction] }),
        ],
      }),
    ],
  });

  function close(): void {
    backdrop.remove();
    document.removeEventListener("keydown", onKeyDown);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") close();
  }

  function setPlaying(playing: boolean): void {
    state.playing = playing;
    const selected = currentAsset(state);
    status.textContent = playing ? `재생 중: ${selected}` : "정지됨";
  }

  function renderTabs(): void {
    categoryTabs.replaceChildren();
    for (const category of ["music", "sound"] as const) {
      categoryTabs.append(el("button", {
        class: "audio-test-tab" + (state.category === category ? " active" : ""),
        text: CATEGORY_LABELS[category],
        attrs: { type: "button", role: "tab", "aria-selected": String(state.category === category) },
        dataset: { testid: `audio-test-tab-${category}` },
        on: {
          click: () => {
            state.category = category;
            state.selectedIndex = 0;
            state.playing = false;
            status.textContent = "대기 중";
            render();
          },
        },
      }));
    }
  }

  function renderList(): void {
    list.replaceChildren();
    const options = ["(꺼짐)", ...AUDIO_GROUPS[state.category].map(audioDisplayName)];
    options.forEach((label, index) => {
      const selected = state.selectedIndex === index;
      list.append(el("button", {
        class: "audio-test-option" + (selected ? " selected" : ""),
        text: label,
        attrs: { type: "button", role: "option", "aria-selected": String(selected) },
        dataset: { testid: index === 0 ? "audio-test-option-off" : `audio-test-option-${index}` },
        on: {
          click: () => {
            state.selectedIndex = index;
            state.playing = false;
            status.textContent = "대기 중";
            renderList();
          },
        },
      }));
    });
  }

  function render(): void {
    renderTabs();
    renderList();
  }

  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener("keydown", onKeyDown);
  document.body.append(backdrop);
  render();
  closeAction.focus();
}

function audioDisplayName(asset: EasyRpgRtpAsset): string {
  return `${asset.fileName.replace(/\.[^.]+$/, "")} <RTP>`;
}

function currentAsset(state: AudioDialogState): string {
  if (state.selectedIndex === 0) return "(꺼짐)";
  const fallback = AUDIO_GROUPS[state.category][0];
  const selected = AUDIO_GROUPS[state.category][state.selectedIndex - 1] ?? fallback;
  return selected ? audioDisplayName(selected) : "(꺼짐)";
}

function audioFieldset(spec: AudioControlSpec): HTMLElement {
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(spec.min);
  input.max = String(spec.max);
  input.value = String(spec.value);
  input.step = "1";
  return el("fieldset", {
    class: "audio-test-fieldset",
    dataset: { testid: spec.testId },
    children: [
      el("legend", { text: spec.label }),
      input,
      el("div", {
        class: "audio-test-scale",
        children: spec.scale.map((text) => el("span", { text })),
      }),
    ],
  });
}
