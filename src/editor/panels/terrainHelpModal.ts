import { el } from "@/util/dom";
import { hideDelayedTooltip } from "@/editor/delayedTooltip";
import { isTopModal, registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { terrainToolbarIcon, type TerrainToolbarIcon } from "./terrainToolbarIcons";
import "@/styles/shell/dialogs/help-modal.css";
import "@/styles/editor/terrain-help.css";

type Guide = {
  readonly id: string;
  readonly title: string;
  readonly intro: string;
  readonly steps: readonly { readonly icon: TerrainToolbarIcon; readonly title: string; readonly text: string }[];
  readonly note: string;
};

const GUIDES: readonly Guide[] = [
  {
    id: "start", title: "만드는 순서",
    intro: "큰 지형을 먼저 잡고, 걸어 다닐 길을 연결한 뒤 건물과 소품을 놓으세요.",
    steps: [
      { icon: "height", title: "1. 땅의 높이 잡기", text: "높이 → 올리기나 산으로 언덕을 만들고, 평탄으로 윗면을 고르세요. 다듬기로 가장자리를 정리합니다. 크기는 S~XL, Shift는 작은 정밀 붓입니다." },
      { icon: "doodad", title: "2. 오르내릴 경사로 연결", text: "지형지물 → 경사로를 고르고 절벽 가장자리에 대세요. 초록 미리보기면 배치할 수 있습니다. 폭 2·4·6칸을 고를 수 있고, 연결할 수 없으면 이유가 표시됩니다." },
      { icon: "river", title: "3. 물과 바닥 칠하기", text: "강은 끌어서 그리고, 표면으로 풀·흙·돌을 칠하세요. 큰 호수는 지형 설계 → 호수·해안에서 외곽을 찍고 적용합니다." },
      { icon: "house", title: "4. 길과 마을 놓기", text: "도로를 끌어 기존 길과 연결하고 집을 드래그해 크기를 정하세요. 나무·바위는 지형지물에서 군집으로 배치합니다. 마지막에 통행 미리보기로 길이 이어졌는지 확인하세요." },
    ],
    note: "아래 줄은 도구 선택, 그 위는 현재 도구의 설정입니다. 아이콘에 잠시 마우스를 두거나 키보드로 초점을 옮기면 이름이 보입니다.",
  },
  {
    id: "land", title: "높이·물·숲",
    intro: "붓으로 자유롭게 그리거나, 지형 설계에서 외곽과 경유점으로 정확하게 만드세요.",
    steps: [
      { icon: "height", title: "높이 붓", text: "올리기·내리기는 누르는 동안 높이가 변합니다. 평탄은 처음 누른 칸의 높이로 맞춥니다. 산·단 지정은 설정한 상한을 사용하며, 1·2·3단 프리셋에 묶이지 않습니다. 오른쪽 버튼은 반대 동작입니다." },
      { icon: "design", title: "윤곽·능선·계곡", text: "지형 설계에서 도구를 선택하고 외곽 또는 경유점을 찍으세요. 높이 변화·폭을 정한 뒤 적용 / Enter로 확정합니다. 적용한 지형 재편집에서 제어점과 값을 다시 조절할 수 있습니다." },
      { icon: "river", title: "강·호수", text: "강 붓은 첫 칸의 높이로 강바닥을 만듭니다. 호수·해안은 수위·깊이·걸을 수 있는 물가 폭을 정합니다. 기존 물체와 통로, 잠근 영역은 보호합니다." },
      { icon: "doodad", title: "숲·바위·다리", text: "지형지물의 나무·바위에서 군집 배치와 밀도를 고르세요. 군집 선택으로 묶음을 옮기거나 지울 수 있습니다. 다리는 같은 줄의 첫 둑 → 반대 둑을 눌러 연결합니다." },
    ],
    note: "초록은 배치 가능, 빨강은 불가입니다. 물·집·잠금·이미 있는 통로 때문에 막히면 미리보기 이유를 확인하세요. 없는 재질은 비활성화됩니다.",
  },
  {
    id: "build", title: "집·도로",
    intro: "기본 버들항 타일로 집과 도로를 만듭니다. 현재 맵의 타일셋에 맞는 부품을 사용합니다.",
    steps: [
      { icon: "house", title: "집 크기 정하기", text: "집 아이콘 → 원하는 집 모양을 고르세요. 캔버스를 끌고 놓으면 너비·높이에 맞는 집이 생깁니다. 한 번 클릭하면 선택한 크기의 집을 문 위치에 놓습니다. 등록된 완성형 집은 원본 크기를 유지합니다." },
      { icon: "house", title: "지붕만 넓히기", text: "버들항 조립식 집의 드래그 대상을 지붕만으로 바꾸고, 기존 집의 지붕에서 좌우로 끄세요. 지붕 너비가 바뀌며 벽·창·문 위치는 유지됩니다." },
      { icon: "road", title: "도로 연결", text: "도로 아이콘 → 폭을 고르고 캔버스를 끌어 그리세요. 놓으면 적용되고 기존 길에 연결됩니다. 지형 따라가기는 높이 차이를 경사로로 잇고, 첫 점 높이로 평탄화도 선택할 수 있습니다." },
      { icon: "design", title: "경유점으로 정교하게", text: "도로의 끌고 놓으면 도로 적용을 끄면 경유점 방식입니다. 점을 차례로 찍고 Enter로 확정하세요. 이미 만든 도로는 적용한 지형 재편집에서 다시 선택할 수 있습니다." },
    ],
    note: "Esc는 진행 중인 집·도로 미리보기를 취소합니다. 확정한 작업은 Ctrl+Z로 되돌리고 Ctrl+Y로 다시 적용합니다.",
  },
  {
    id: "check", title: "검사·보호",
    intro: "보기 좋은 지형을 만든 뒤 실제로 이동 가능한지 확인하세요.",
    steps: [
      { icon: "reachable", title: "통행 미리보기", text: "시작 맵의 시작 위치에서 닿는 땅은 초록, 닿지 못하는 땅은 빨강으로 표시합니다. 경사로의 진입 방향과 소품의 통행을 함께 확인합니다." },
      { icon: "design", title: "경로 검사", text: "지형 설계 → 경로 검사에서 출발점과 목적지를 누르세요. 몸 크기·문·NPC·스위치를 설정해 통과할 길의 폭과 막힌 지점을 확인할 수 있습니다." },
      { icon: "group", title: "영역 보호·지형 도장", text: "영역 잠금으로 유지할 땅을 보호하세요. 지형 도장은 두 모서리로 지형을 저장해 같은 타일셋의 다른 맵에 놓을 수 있습니다. 대칭·회전·반전도 사용할 수 있습니다." },
      { icon: "help", title: "선택 기능인 시야 차단", text: "시야 차단은 기본 꺼짐입니다. 필요할 때 지형 설계의 게임 시야와 높이에서 켜세요. 미리보기를 켜고 캔버스를 누르면 관찰 위치를 바꿀 수 있습니다." },
    ],
    note: "Ctrl+S로 프로젝트를 저장하세요. 통행 미리보기는 시작 위치 기준이며, 게임 중 문·NPC·스위치가 바뀌는 상황은 경로 검사와 실제 실행으로 확인합니다.",
  },
];

let dismissOpen: (() => void) | null = null;

/** Returns the same dismissal used by Escape, X, backdrop and toolbar teardown. */
export function openTerrainHelpModal(opener: HTMLElement): () => void {
  dismissOpen?.();
  hideDelayedTooltip();
  const body = el("div", { class: "help-modal-body terrain-help-body", attrs: { id: "terrain-help-body" } });
  const nav = el("nav", { class: "terrain-help-nav", attrs: { "aria-label": "지형 도움말 목차" } });
  const closeButton = el("button", { class: "help-modal-close", text: "×", attrs: { type: "button", "aria-label": "지형 도움말 닫기" }, dataset: { testid: "terrain-help-close" }, on: { click: () => close() } });
  const backdrop = el("div", {
    class: "help-modal-backdrop modal-backdrop terrain-help-backdrop", dataset: { testid: "terrain-help-modal" },
    children: [el("section", { class: "help-modal-window terrain-help-window", attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "terrain-help-title" }, children: [
      el("header", { class: "help-modal-titlebar", children: [el("div", { class: "help-modal-titles", children: [el("h2", { text: "지형 만들기", attrs: { id: "terrain-help-title" } }), el("p", { class: "help-modal-subtitle", text: "언덕부터 마을까지 · 도구와 만드는 순서" })] }), closeButton] }),
      nav, body,
      el("footer", { class: "help-modal-footer", children: [el("span", { class: "terrain-help-shortcuts", text: "Shift 정밀 붓 · Enter 적용 · Esc 취소 · Ctrl+Z 되돌리기" }), el("button", { class: "help-modal-button", text: "닫기", attrs: { type: "button" }, dataset: { testid: "terrain-help-dismiss" }, on: { click: () => close() } })] }),
    ] })],
  });
  const show = (guide: Guide): void => {
    for (const button of nav.querySelectorAll<HTMLButtonElement>("button")) {
      const active = button.dataset.guide === guide.id;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", String(active));
    }
    body.replaceChildren(
      el("p", { class: "terrain-help-intro", text: guide.intro }),
      el("ol", { class: "terrain-help-steps", children: guide.steps.map(step => el("li", { children: [
        el("span", { class: "terrain-help-picture", children: [terrainToolbarIcon(step.icon)] }),
        el("div", { children: [el("h3", { text: step.title }), el("p", { text: step.text })] }),
      ] })) }),
      el("p", { class: "help-modal-note", text: guide.note }),
    );
    body.scrollTop = 0;
  };
  for (const guide of GUIDES) nav.append(el("button", { class: "help-modal-nav-item", text: guide.title, attrs: { type: "button", "aria-controls": "terrain-help-body" }, dataset: { guide: guide.id, testid: `terrain-help-${guide.id}` }, on: { click: () => show(guide) } }));
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    unregisterModal(backdrop);
    backdrop.removeEventListener("keydown", trapFocus);
    backdrop.remove();
    if (dismissOpen === close) dismissOpen = null;
    if (opener.isConnected && opener.getClientRects().length) opener.focus();
  };
  const trapFocus = (event: KeyboardEvent): void => {
    if (event.key !== "Tab" || !isTopModal(backdrop)) return;
    const buttons = [...backdrop.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  backdrop.addEventListener("keydown", trapFocus);
  backdrop.addEventListener("mousedown", event => { if (event.target === backdrop) close(); });
  document.body.append(backdrop);
  registerModal(backdrop, close);
  dismissOpen = close;
  show(GUIDES[0]!);
  closeButton.focus();
  return close;
}
