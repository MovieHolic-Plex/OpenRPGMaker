// Lightweight launcher presentation: no editor, runtime, project store, or audio boot.
import type { RecentProjectEntry } from "../../electron/shared/start";
import { el } from "@/util/dom";

const SCENES = [
  { label: "성채", title: "강 너머의 왕국", image: "/assets/region-references/river-fortress.png" },
  { label: "마을", title: "호숫가의 작은 마을", image: "/assets/region-references/lake-village.png" },
  { label: "숲", title: "폭포 너머의 길", image: "/assets/region-references/outdoor-opening-overlook.png" },
] as const;
const MOTION_KEY = "oprn:start-lobby-motion-paused";

type LobbyActions = {
  readonly newGame: () => void;
  readonly openProject: () => void;
  readonly examples: () => void;
  readonly ai: () => void;
  readonly blank: () => void;
};

/** Keep the same cover hooks as recent cards, so late cover rendering never replaces focused controls. */
export function createStartLobby(entry: RecentProjectEntry | undefined, meta: string, actions: LobbyActions): HTMLElement {
  const background = el("img", {
    class: "start-hero-bg",
    attrs: { src: entry?.cover || SCENES[0].image, alt: "", decoding: "async", draggable: "false" },
  });
  const caption = el("span", { class: "start-cinema-caption", text: entry ? "내 프로젝트" : SCENES[0].title });
  const hero = el("section", {
    class: "start-hero start-cinema" + (entry && !entry.cover ? " is-fallback-art" : ""),
    attrs: { "aria-label": entry ? "이어서 만들기" : "나의 세계 만들기" },
    dataset: entry ? { testid: "start-continue", heroFor: entry.projectDir } : { testid: "start-cinematic-welcome" },
    children: [background, el("div", { class: "start-cinema-light", attrs: { "aria-hidden": "true" } }),
      el("div", { class: "start-cinema-motes", attrs: { "aria-hidden": "true" } })],
  });

  let paused = false;
  try { paused = window.localStorage.getItem(MOTION_KEY) === "true"; } catch { /* Storage can be unavailable. */ }
  // CSS follows reduced-motion (including changes while open) and hides the redundant toggle.
  const motion = el("button", {
    class: "start-cinema-control",
    attrs: { type: "button", "aria-pressed": String(paused) },
    dataset: { testid: "start-motion-toggle" },
    text: paused ? "움직임 켜기" : "움직임 멈추기",
    on: { click: () => {
      paused = !paused;
      hero.classList.toggle("is-motion-paused", paused);
      motion.setAttribute("aria-pressed", String(paused));
      motion.textContent = paused ? "움직임 켜기" : "움직임 멈추기";
      try { window.localStorage.setItem(MOTION_KEY, String(paused)); } catch { /* Optional preference. */ }
    } },
  });
  hero.classList.toggle("is-motion-paused", paused);

  const tools = el("div", { class: "start-cinema-tools", children: [motion] });
  if (!entry) {
    const switcher = el("div", { class: "start-scene-picker", attrs: { role: "group", "aria-label": "배경 장면" } });
    SCENES.forEach((scene, index) => {
      const button = el("button", {
        class: "start-cinema-control",
        attrs: { type: "button", "aria-pressed": String(index === 0) },
        dataset: { testid: "start-scene-" + index },
        text: scene.label,
        on: { click: () => {
          background.src = scene.image;
          caption.textContent = scene.title;
          switcher.querySelectorAll("button").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
        } },
      });
      switcher.append(button);
    });
    tools.prepend(switcher);
  }
  const primary = el("button", {
    class: "start-btn start-btn-primary start-btn-lg",
    attrs: { type: "button" },
    dataset: { testid: entry ? "start-continue-open" : "start-cinematic-create" },
    text: entry ? "계속 만들기" : "나의 세계 만들기",
    on: { click: entry ? actions.openProject : actions.newGame },
  });
  hero.append(tools, el("div", { class: "start-hero-body", children: [
    el("p", { class: "start-cinema-eyebrow", text: entry ? "다시, 당신의 세계로" : "당신의 이야기를 기다리는 세계" }),
    el("h1", { class: "start-hero-title", text: entry?.title || "상상했던 세계에\n첫 발을 내딛다.", attrs: entry ? { translate: "no" } : {} }),
    el("p", { class: "start-cinema-description", text: entry ? meta : "장소를 만들고, 이야기를 심고, 모험을 완성하세요. 당신의 첫 게임이 여기서 시작됩니다." }),
    ...(entry ? [el("span", { class: "start-path", text: entry.projectDir, attrs: { translate: "no" } })] : []),
    el("div", { class: "start-hero-actions", children: [primary, el("button", {
      class: "start-btn start-btn-lg", attrs: { type: "button" },
      text: entry ? "새 게임 만들기" : "예제 둘러보기", on: { click: actions.newGame },
    })] }),
  ] }), el("div", { class: "start-cinema-credit", children: [
    el("span", { text: entry && !entry.cover ? "OPRN 장면 미리보기" : "MADE WITH OPRN" }), caption,
  ] }));
  return hero;
}

/** All entry points reuse the existing example/AI/blank project creation flow. */
export function createLobbyWays(actions: LobbyActions): HTMLElement {
  const ways = [
    { title: "장면에서 시작", description: "플레이 가능한 예제를 내 이야기로", action: actions.examples, testid: "start-lobby-examples" },
    { title: "AI와 함께 구상", description: "만들고 싶은 게임을 말해 보세요", action: actions.ai, testid: "start-ai-project" },
    { title: "빈 세계에서 시작", description: "첫 타일부터 직접 만드는 즐거움", action: actions.blank, testid: "start-blank-project" },
  ];
  return el("section", { class: "start-lobby-ways", attrs: { "aria-label": "모험을 만드는 세 가지 시작" }, children: ways.map(way =>
    el("button", { class: "start-lobby-way", attrs: { type: "button" }, dataset: { testid: way.testid }, on: { click: way.action }, children: [
      el("strong", { text: way.title }), el("span", { text: way.description }), el("span", { class: "start-lobby-way-arrow", text: "↗", attrs: { "aria-hidden": "true" } }),
    ] }),
  ) });
}

export function createLobbyFeatures(): HTMLElement {
  const features = [
    ["세계", "마을과 던전, 탐험할 장소를 만들어요."],
    ["인물", "주인공과 동료, 마을 사람들을 만드세요."],
    ["이야기", "대화와 선택을 연결해 이야기를 이어가요."],
    ["전투", "몬스터와 스킬, 전투 연출을 구성해요."],
    ["음악", "장소에 어울리는 음악과 효과음을 골라요."],
    ["AI 조수", "아이디어를 구체화하고 제작과 수정을 함께해요."],
  ];
  return el("section", { class: "start-lobby-features", attrs: { "aria-label": "게임 한 편을 만드는 모든 것" }, children: [
    el("h2", { text: "게임 한 편을 만드는 모든 것" }),
    el("div", { class: "start-lobby-feature-list", children: features.map(([title, description]) => el("details", { children: [
      el("summary", { text: title }), el("p", { text: description }),
    ] })) }),
  ] });
}
