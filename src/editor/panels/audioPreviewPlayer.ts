import type { AudioResource } from "@/assets/audioResourceCatalog";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { renderEditorIcon as editorIcon } from "./eventEditor/editorIcons";
import { audioPlayback } from "./audioResourcePresentation";
import { AUDIO_PREVIEW_DEFAULTS, AudioPreviewSession, type AudioPreviewSettings } from "./audioPreviewSession";

const PHASE_LABELS = {
  empty: "음원을 선택하세요", ready: "미리듣기 준비", loading: "불러오는 중 / 버퍼링",
  playing: "재생 중", paused: "일시 정지", stopped: "정지됨", ended: "재생 완료", error: "재생 실패", unavailable: "미리듣기 불가",
} as const;

export function audioPreviewTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "--:--";
  if (seconds > 0 && seconds < 1) return `0:${seconds.toFixed(2).padStart(5, "0")}`;
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function createAudioPreviewPlayer(prefix = "audio-preview") {
  const host = el("div", { attrs: { hidden: "" } });
  const session = new AudioPreviewSession(host);
  let settings = { ...AUDIO_PREVIEW_DEFAULTS };
  let playing = false;
  let selectedKey = "";
  const play = el("button", {
    class: "btn audio-preview-play", attrs: { type: "button" }, dataset: { testid: `${prefix}-play` },
    on: { click: () => { if (playing) session.pause(); else void session.play(); } },
  });
  const stop = el("button", {
    class: "btn", attrs: { type: "button" }, dataset: { testid: `${prefix}-stop` },
    on: { click: () => session.stop() },
  });
  stop.replaceChildren(editorIcon("stop"), "정지");
  const time = el("output", { class: "audio-preview-time", attrs: { "aria-live": "off", "aria-label": "현재 시간 / 전체 길이" }, dataset: { testid: `${prefix}-time` } });
  const seek = el("input", {
    attrs: { type: "range", min: "0", max: "0", step: "0.1", "aria-label": "재생 위치" },
    dataset: { testid: `${prefix}-seek` }, on: { input: () => session.seek(Number(seek.value)) },
  });
  const status = el("div", {
    class: "audio-preview-status", attrs: { role: "status", "aria-live": "polite" },
    dataset: { testid: `${prefix}-status` },
  });
  const transport = el("div", {
    class: "audio-preview-transport", dataset: { testid: `${prefix}-transport` },
    children: [el("div", { class: "audio-preview-actions", children: [play, stop, time] }), seek, status, host],
  });
  const unsubscribe = session.subscribe(state => {
    playing = state.phase === "playing" || (state.phase === "loading" && state.requested);
    const actualPlaying = state.phase === "playing";
    play.replaceChildren(editorIcon(playing ? "pause" : "play"), playing ? "일시 정지" : state.phase === "ended" ? "다시 재생" : "재생");
    play.setAttribute("aria-label", playing ? "일시 정지" : "재생");
    play.setAttribute("aria-pressed", String(actualPlaying));
    play.disabled = state.phase === "empty" || state.phase === "unavailable";
    stop.disabled = play.disabled || state.phase === "ready" || state.phase === "stopped";
    transport.dataset.state = state.phase;
    transport.setAttribute("aria-busy", String(state.phase === "loading"));
    seek.disabled = state.duration === null;
    seek.max = String(state.duration ?? 0);
    seek.value = String(state.current);
    seek.setAttribute("aria-valuetext", `${audioPreviewTime(state.current)} / ${audioPreviewTime(state.duration)}`);
    time.textContent = `${audioPreviewTime(state.current)} / ${audioPreviewTime(state.duration)}`;
    status.textContent = state.error ? `${PHASE_LABELS[state.phase]}: ${state.error}` : PHASE_LABELS[state.phase];
  });
  const controls: { readonly input: HTMLInputElement; readonly output: HTMLOutputElement; readonly key: keyof AudioPreviewSettings; readonly format: (value: number) => string }[] = [];
  const advanced = el("details", {
    class: "audio-preview-advanced", dataset: { testid: `${prefix}-advanced` },
    children: [el("summary", { text: "고급 미리듣기 설정" })],
  });
  for (const spec of [
    { key: "volume", id: "volume", label: "음량", min: 0, max: 100, format: (n: number) => `음량 ${n}%` },
    { key: "tempo", id: "tempo", label: "템포", min: 50, max: 150, format: (n: number) => `템포 ${n}%` },
    { key: "pan", id: "balance", label: "밸런스", min: -100, max: 100, format: (n: number) => n === 0 ? "밸런스 중앙" : `밸런스 ${n < 0 ? "왼쪽" : "오른쪽"} ${Math.abs(n)}` },
    { key: "fade", id: "fade", label: "페이드인 시간", min: 0, max: 10, format: (n: number) => n === 0 ? "페이드인 없음" : `페이드인 ${n}초` },
  ] as const) {
    const input = el("input", { attrs: { type: "range", min: String(spec.min), max: String(spec.max), step: "1", "aria-label": spec.label } });
    const output = el("output", { dataset: { testid: `${prefix}-${spec.id}-value` } });
    input.value = String(settings[spec.key]);
    output.textContent = spec.format(settings[spec.key]);
    input.addEventListener("input", () => {
      settings = { ...settings, [spec.key]: Number(input.value) };
      output.textContent = spec.format(settings[spec.key]);
      session.configure(settings);
    });
    controls.push({ input, output, key: spec.key, format: spec.format });
    advanced.append(el("label", {
      class: "audio-preview-setting", dataset: { testid: `${prefix}-${spec.id}` },
      children: [el("span", { text: spec.label }), output, input],
    }));
  }
  advanced.append(el("p", { text: "게임에는 적용되지 않습니다. 페이드인은 다음 재생부터 적용됩니다. 원격 음원 밸런스는 서버의 CORS 허용이 필요합니다." }), el("button", {
    class: "btn", text: "설정 초기화", attrs: { type: "button" }, dataset: { testid: `${prefix}-reset` },
    on: { click: () => {
      settings = { ...AUDIO_PREVIEW_DEFAULTS };
      session.configure(settings);
      for (const control of controls) {
        control.input.value = String(settings[control.key]);
        control.output.textContent = control.format(settings[control.key]);
      }
    } },
  }));
  return {
    transport, advanced,
    select(resource: AudioResource | undefined, project: Project): void {
      const key = resource ? `${resource.kind}:${resource.id}` : "";
      if (key !== selectedKey) session.select(null);
      selectedKey = key;
      const playback = resource ? audioPlayback(resource.id, project) : undefined;
      session.select(playback?.url ?? null, playback && !playback.playable ? playback.midi ? "MIDI 비재생" : "재생 가능한 파일이 없습니다." : "", resource?.kind === "music");
    },
    dispose: (): void => { unsubscribe(); session.dispose(); },
  };
}
