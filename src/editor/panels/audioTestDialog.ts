import { CC0_MUSIC_ASSETS, CC0_SOUND_ASSETS } from "@/assets/cc0AudioAssets";
import { EASYRPG_MUSIC_ASSETS, EASYRPG_SOUND_ASSETS } from "@/assets/easyrpgRtp";
import { listAudioResources, type AudioResource } from "@/assets/audioResourceCatalog";
import { audioDescriptionView, audioPlayback } from "./audioResourcePresentation";
import { uiLabel } from "@/editor/uiCopy";
import { registerModal } from "@/editor/ui/modalStack";
import { getAudioEngine, playAudioCommand, stopAudioCommand } from "@/player/audio";
import { store } from "@/project/store";
import { el } from "@/util/dom";

type AudioCategory = "music" | "sound";

type ListedAudio = AudioResource & {
  readonly label: string;
  readonly playable: boolean;
  readonly midi: boolean;
};

type AudioDialogState = {
  category: AudioCategory;
  // Selection survives catalog refreshes; option test IDs retain display indices.
  selectedId: string;
  playing: boolean;
  // 슬라이더 원단위 값. 화면 표기와 엔진 적용값의 단일 원천.
  volume: number;
  fadeSeconds: number;
  tempo: number;
  balance: number;
  filter: string;
};

type AudioControlSpec = {
  readonly label: string;
  readonly testId: string;
  readonly scale: readonly [string, string, string];
  readonly min: number;
  readonly max: number;
  readonly value: number;
  // 슬라이더 값 → 화면에 보일 숫자 문구.
  readonly format: (value: number) => string;
  // 즉시 적용인지, 다음 재생부터 적용인지. 화면에 그렇게 적는다.
  readonly hint?: string;
  readonly onInput: (value: number) => void;
};

const CATEGORY_LABELS: Readonly<Record<AudioCategory, string>> = {
  music: "음악",
  sound: "효과음",
};

export function openAudioTestDialog(): void {
  document.querySelector("[data-testid='audio-test-dialog']")?.remove();
  const engine = getAudioEngine();
  engine.installUnlockListeners();
  engine.unlock();
  // 모달이 엔진 기본 페이드 길이를 잠시 소유한다 — 닫을 때 원래 값을 되돌려
  // 플레이어 런타임의 BGM 페이드가 모달 슬라이더 값에 오염되지 않게 한다.
  const restoreFadeInMs = engine.getFadeInMs();

  const state: AudioDialogState = {
    category: "music",
    selectedId: "",
    playing: false,
    volume: 100,
    fadeSeconds: 0,
    tempo: 100,
    balance: 0,
    filter: "",
  };

  const closeButton = el("button", {
    class: "audio-test-close",
    text: "×",
    attrs: { type: "button", title: "닫기", "aria-label": "닫기" },
    dataset: { testid: "audio-test-window-close" },
  });
  const categoryTabs = el("div", { class: "audio-test-tabs", attrs: { role: "tablist", "aria-label": "오디오 종류" } });
  const filterInput = el("input", {
    class: "audio-test-filter",
    attrs: { type: "search", placeholder: "목록 좁히기", "aria-label": "오디오 목록 좁히기" },
    dataset: { testid: "audio-test-filter" },
  });
  const listCount = el("span", {
    class: "audio-test-list-count",
    attrs: { "aria-live": "polite" },
    dataset: { testid: "audio-test-list-count" },
  });
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
  const description = el("div", {
    dataset: { testid: "audio-test-description" },
  });
  const playButton = el("button", {
    class: "audio-test-button primary",
    text: "재생",
    attrs: { type: "button", "aria-pressed": "false" },
    dataset: { testid: "audio-test-play" },
    on: { click: () => setPlaying(true) },
  });
  const stopButton = el("button", {
    class: "audio-test-button",
    text: "정지",
    attrs: { type: "button", "aria-pressed": "false" },
    dataset: { testid: "audio-test-stop" },
    on: { click: () => setPlaying(false) },
  });
  const closeAction = el("button", {
    class: "audio-test-button",
    text: "닫기",
    attrs: { type: "button" },
    dataset: { testid: "audio-test-close" },
    on: { click: () => closeUi() },
  });

  const body = el("div", {
    class: "audio-test-body",
    children: [
      el("section", {
        class: "audio-test-left",
        children: [
          categoryTabs,
          el("div", { class: "audio-test-filter-row", children: [filterInput, listCount] }),
          list,
        ],
      }),
      el("section", {
        class: "audio-test-right",
        children: [
          audioFieldset({
            label: "페이드인 시간",
            testId: "audio-test-fade",
            scale: ["없음", "5초", "10초"],
            min: 0,
            max: 10,
            value: state.fadeSeconds,
            hint: "다음 재생부터 적용",
            format: (value) => (value === 0 ? "페이드인 없음" : `페이드인 ${value}초`),
            onInput: (value) => {
              state.fadeSeconds = value;
              engine.setFadeInMs(value * 1000);
            },
          }),
          audioFieldset({
            label: "음량",
            testId: "audio-test-volume",
            scale: ["0%", "50%", "100%"],
            min: 0,
            max: 100,
            value: state.volume,
            hint: "재생 중 즉시 적용",
            format: (value) => `음량 ${value}%`,
            onInput: (value) => {
              state.volume = value;
              applyVolume(state);
            },
          }),
          audioFieldset({
            label: "템포",
            testId: "audio-test-tempo",
            scale: ["50%", "100%", "150%"],
            min: 50,
            max: 150,
            value: state.tempo,
            hint: "재생 중 즉시 적용",
            format: (value) => `템포 ${value}%`,
            onInput: (value) => {
              state.tempo = value;
              engine.setPlaybackRate(value / 100);
            },
          }),
          audioFieldset({
            label: "밸런스",
            testId: "audio-test-balance",
            scale: ["왼쪽", "중앙", "오른쪽"],
            min: -100,
            max: 100,
            value: state.balance,
            hint: "재생 중 즉시 적용",
            format: balanceText,
            onInput: (value) => {
              state.balance = value;
              engine.setPan(value / 100);
            },
          }),
          el("div", { class: "audio-test-actions", children: [playButton, stopButton] }),
          description,
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
            children: [
              el("h2", {
                text: uiLabel("audio"),
                attrs: { id: "audio-test-title", title: uiLabel("audio") },
              }),
              closeButton,
            ],
          }),
          body,
          el("footer", { class: "audio-test-footer", children: [closeAction] }),
        ],
      }),
    ],
  });

  // 모달 층 등록: Escape 는 modalStack 이 맨 위 층에만 전달한다(중첩 모달 계약).
  const close = registerModal(backdrop, () => {
    stopAudioCommand();
    engine.setFadeInMs(restoreFadeInMs);
    backdrop.remove();
  });

  function closeUi(): void {
    close();
  }

  function setPlaying(playing: boolean): void {
    const selected = currentEntry(state);
    if (!playing || state.selectedId === "" || !selected) {
      stopAudioCommand();
      state.playing = false;
      status.textContent = "정지됨";
      syncTransport();
      return;
    }
    if (!selected.playable) {
      stopAudioCommand();
      state.playing = false;
      status.textContent =
        selected.midi
          ? `재생 불가(MIDI): ${selected.label} — CC0 WAV/OGG 트랙을 쓰세요`
          : `재생 불가: ${selected.label}`;
      syncTransport();
      return;
    }
    applyVolume(state);
    engine.setPlaybackRate(state.tempo / 100);
    engine.setPan(state.balance / 100);
    // 페이드인은 엔진의 현재 기본값(슬라이더가 소유)을 통해 **다음 재생**에 적용된다.
    engine.setFadeInMs(state.fadeSeconds * 1000);
    playAudioCommand({ resourceId: selected.id, loop: state.category === "music" }, store.getCurrent());
    state.playing = true;
    status.textContent = `재생 중: ${selected.label}`;
    syncTransport();
  }

  // 재생/정지 버튼이 실제 상태를 반영한다(장식 금지).
  function syncTransport(): void {
    const selected = currentEntry(state);
    description.replaceChildren(...(selected ? [audioDescriptionView(selected)] : []));
    const canPlay = selected !== null && selected.playable;
    playButton.setAttribute("aria-pressed", String(state.playing));
    stopButton.setAttribute("aria-pressed", String(!state.playing));
    playButton.disabled = !canPlay || state.playing;
    stopButton.disabled = !state.playing;
    playButton.classList.toggle("is-active", state.playing);
  }

  function renderTabs(): void {
    categoryTabs.replaceChildren();
    for (const category of ["music", "sound"] as const) {
      categoryTabs.append(
        el("button", {
          class: "audio-test-tab" + (state.category === category ? " active" : ""),
          text: CATEGORY_LABELS[category],
          attrs: { type: "button", role: "tab", "aria-selected": String(state.category === category) },
          dataset: { testid: `audio-test-tab-${category}` },
          on: {
            click: () => {
              stopAudioCommand();
              state.category = category;
              state.selectedId = "";
              state.playing = false;
              status.textContent = "대기 중";
              render();
            },
          },
        })
      );
    }
  }

  function renderList(): void {
    list.replaceChildren();
    const options = listAudio(state.category);
    const needle = state.filter.trim().toLowerCase();
    // (꺼짐) 은 필터와 무관하게 언제나 첫 줄이다 — 선택 해제 경로가 사라지면 안 된다.
    list.append(optionButton({ id: "", label: "(꺼짐)", index: 0, playable: true, midi: false }));
    let shown = 0;
    options.forEach((entry, offset) => {
      if (needle && ![entry.id, entry.label, entry.description, ...entry.tags]
        .some(value => value.toLowerCase().includes(needle))) return;
      shown += 1;
      list.append(optionButton({
        id: entry.id,
        label: entry.label,
        index: offset + 1,
        playable: entry.playable,
        midi: entry.midi,
      }));
    });
    listCount.textContent = needle ? `${shown}/${options.length}개` : `${options.length}개`;
  }

  function optionButton(spec: {
    readonly id: string;
    readonly label: string;
    readonly index: number;
    readonly playable: boolean;
    readonly midi: boolean;
  }): HTMLButtonElement {
    const selected = state.selectedId === spec.id;
    const classes = ["audio-test-option"];
    if (selected) classes.push("selected");
    if (!spec.playable) classes.push("unplayable");
    return el("button", {
      class: classes.join(" "),
      attrs: {
        type: "button",
        role: "option",
        "aria-selected": String(selected),
        // 재생 불가(MIDI)는 목록에서 바로 구별된다 — 눌러보고 나서야 알게 하지 않는다.
        ...(spec.playable ? {} : {
          "aria-disabled": "true",
          title: spec.midi ? "재생 불가(MIDI)" : "미리 듣기 불가",
        }),
      },
      dataset: {
        testid: spec.index === 0 ? "audio-test-option-off" : `audio-test-option-${spec.index}`,
        resourceId: spec.id,
        audioMidi: String(spec.midi),
      },
      children: [
        el("span", { class: "audio-test-option-label", text: spec.label }),
        ...(spec.playable ? [] : [el("span", { class: "audio-test-option-badge", text: "재생 불가" })]),
      ],
      on: {
        click: () => {
          stopAudioCommand();
          state.selectedId = spec.id;
          state.playing = false;
          status.textContent = spec.playable
            ? "대기 중"
            : spec.midi
              ? "재생 불가(MIDI) — CC0 WAV/OGG 트랙을 쓰세요"
              : "미리 듣기 불가";
          renderList();
          syncTransport();
        },
      },
    });
  }

  function render(): void {
    renderTabs();
    renderList();
    syncTransport();
  }

  filterInput.addEventListener("input", () => {
    state.filter = filterInput.value;
    renderList();
    syncTransport();
  });
  closeButton.addEventListener("click", () => closeUi());
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) closeUi();
  });
  document.body.append(backdrop);
  // 엔진에 현재 슬라이더 값을 심어 화면 표기와 실제 적용값이 처음부터 일치하게 한다.
  applyVolume(state);
  engine.setPlaybackRate(state.tempo / 100);
  engine.setPan(state.balance / 100);
  engine.setFadeInMs(state.fadeSeconds * 1000);
  render();
  closeAction.focus();
}

function listAudio(category: AudioCategory): readonly ListedAudio[] {
  const project = store.getCurrent();
  const resources = listAudioResources(category, project);
  // Ordering only: metadata and eligibility belong to the shared catalog.
  // Preserve historical numbered test IDs before appending newly exposed entries.
  const legacyOrder = {
    music: [...CC0_MUSIC_ASSETS, ...EASYRPG_MUSIC_ASSETS],
    sound: [...CC0_SOUND_ASSETS, ...EASYRPG_SOUND_ASSETS],
  };
  const order = legacyOrder[category];
  const rank = new Map<string, number>(order.map((asset, index) => [asset.id, index]));
  return [...resources]
    .sort((a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length))
    .map(resource => ({
      ...resource,
      label: resource.name,
      ...audioPlayback(resource.id, project),
    }));
}

function currentEntry(state: AudioDialogState): ListedAudio | null {
  if (state.selectedId === "") return null;
  return listAudio(state.category).find(entry => entry.id === state.selectedId) ?? null;
}

function applyVolume(state: AudioDialogState): void {
  const group = state.category === "music" ? "bgm" : "se";
  getAudioEngine().setVolume(group, Math.max(0, Math.min(1, state.volume / 100)));
}

// 밸런스 표기: 0 은 중앙, 그 밖은 방향 + 크기.
function balanceText(value: number): string {
  if (value === 0) return "밸런스 중앙";
  return value < 0 ? `밸런스 왼쪽 ${Math.abs(value)}` : `밸런스 오른쪽 ${value}`;
}

function audioFieldset(spec: AudioControlSpec): HTMLElement {
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(spec.min);
  input.max = String(spec.max);
  input.value = String(spec.value);
  input.step = "1";
  input.setAttribute("aria-label", spec.label);
  const readout = el("span", {
    class: "audio-test-readout",
    text: spec.format(spec.value),
    dataset: { testid: `${spec.testId}-value` },
  });
  input.addEventListener("input", () => {
    const value = Number(input.value);
    readout.textContent = spec.format(value);
    spec.onInput(value);
  });
  return el("fieldset", {
    class: "audio-test-fieldset",
    dataset: { testid: spec.testId },
    children: [
      el("div", {
        class: "audio-test-fieldset-head",
        children: [
          // <legend> 는 fieldset 의 직계 자식만 유효하므로 머리줄은 span 으로 적고
          // 접근성 이름은 슬라이더의 aria-label 이 담당한다.
          el("span", { class: "audio-test-legend", text: spec.label }),
          readout,
          ...(spec.hint ? [el("span", { class: "audio-test-hint", text: spec.hint })] : []),
        ],
      }),
      input,
      el("div", {
        class: "audio-test-scale",
        children: spec.scale.map((text) => el("span", { text })),
      }),
    ],
  });
}
