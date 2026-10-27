import { authoredVolumePercent } from "@/player/audio/fade";
import { el } from "@/util/dom";
import type { Command } from "@/project/types";

// 오디오 명령(재생/정지) 프리뷰. 자동 재생은 하지 않는다(누수·의도치 않은 소리 방지) —
// 파일명·반복 배지 + 정적 파형 장식만 시각 요약으로 보여준다.
export function previewAudio(cmd: Extract<Command, { kind: "playAudio" | "stopAudio" }>): HTMLElement {
  const root = el("div", { class: "ecp-audio", dataset: { testid: "ecp-audio-preview" } });
  if (cmd.kind === "stopAudio") {
    root.append(el("div", { class: "ecp-audio-icon stop", text: "■" }));
    root.append(
      el("div", {
        class: "ecp-audio-name",
        text: cmd.channel === "bgm" ? "배경음(BGM)만 페이드아웃합니다" : "재생 중인 소리를 정지합니다",
      }),
    );
    return root;
  }
  root.append(el("div", { class: "ecp-audio-icon play", text: "▶" }));
  root.append(el("div", { class: "ecp-audio-name", text: cmd.resourceId || "(소리 선택 없음)" }));
  root.append(renderWaveform());
  const badges = [el("span", { class: `ecp-audio-badge ${cmd.loop ? "on" : "off"}`, text: cmd.loop ? "반복 재생" : "1회 재생" })];
  if (cmd.channel === "bgs") badges.push(el("span", { class: "ecp-audio-badge on", text: "환경음" }));
  else if (cmd.channel === "me") badges.push(el("span", { class: "ecp-audio-badge on", text: "효과 음악" }));
  if (cmd.volume !== undefined && authoredVolumePercent(cmd.volume) !== 100) {
    badges.push(el("span", { class: "ecp-audio-badge off", text: `음량 ${authoredVolumePercent(cmd.volume)}%` }));
  }
  if (cmd.fadeInMs !== undefined && cmd.fadeInMs > 0) {
    const seconds = cmd.fadeInMs / 1000;
    const text = Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1).replace(/\.0$/, "");
    badges.push(el("span", { class: "ecp-audio-badge off", text: `페이드 ${text}초` }));
  }
  root.append(el("div", { class: "ecp-audio-badges", children: badges }));
  return root;
}

// 정적 파형(결정적 높이 배열 — Math.random 미사용).
function renderWaveform(): HTMLElement {
  const wave = el("div", { class: "ecp-audio-wave", attrs: { "aria-hidden": "true" } });
  const heights = [30, 60, 45, 80, 50, 70, 40, 92, 55, 65, 35, 78, 50, 62, 44, 86, 40, 72, 30, 58, 48, 68];
  for (const h of heights) {
    const bar = el("span", { class: "ecp-audio-bar" });
    bar.style.height = `${h}%`;
    wave.append(bar);
  }
  return wave;
}
