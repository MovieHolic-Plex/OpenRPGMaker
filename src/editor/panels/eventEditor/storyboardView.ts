import {
  BATTLE_DEFEAT_BRANCH_INDEX,
  BATTLE_ESCAPE_BRANCH_INDEX,
  BATTLE_VICTORY_BRANCH_INDEX,
  CHOICE_CANCEL_BRANCH_INDEX,
  FORK_ELSE_BRANCH_INDEX,
  FORK_THEN_BRANCH_INDEX,
  LOOP_BODY_BRANCH_INDEX,
} from "@/editor/eventCommandPaths";
import type { Command } from "@/project/types";
import { el } from "@/util/dom";
import { commandSummary } from "./commandSummary";
import { commandKindLabel } from "./options";

// "graph"는 Phase 2 플레이스홀더였다 — 동작하지 않는 토글이 3뷰의 1/3을 차지해
// 초보 모드에까지 노출됐다(2026-08-18 적대 평가). 기능이 생길 때 다시 추가한다.
export type StoryboardMode = "storyboard" | "list";

const MODE_KEY = "oprn:storyboard-mode";

export function loadStoryboardMode(): StoryboardMode {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    if (raw === "list" || raw === "storyboard") return raw;
  } catch { /* ignore */ }
  // 목록이 기본: 명령 추가·편집·컨텍스트 메뉴가 모두 목록에 있고, 스토리보드는 훑어보기용.
  return "list";
}

export function saveStoryboardMode(mode: StoryboardMode): void {
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
}

function summarizeCommand(cmd: Command): { title: string; detail: string; color: string } {
  const compactSummary = (() => { try { return commandSummary(cmd); } catch { return cmd.kind; } })();
  const detail = cmd.kind === "text"
    ? `문장 표시: ${cmd.body.replace(/\s+/g, " ").trim()}`
    : compactSummary;
  const cat = categoryOf(cmd.kind);
  const colorMap: Record<string,string> = {
    dialogue: "#246fcb", flow: "#b74416", reward: "#087b52",
    map: "#6e63c5", screen: "#b53866", system: "#8a5a00",
  };
  return { title: kindLabel(cmd.kind), detail, color: colorMap[cat] ?? "#4a5260" };
}

function categoryOf(kind: string): string {
  if (["text","changeFace","displayTextSettings"].includes(kind)) return "dialogue";
  if (["choices","fork","loop","breakLoop","label","gotoLabel","callCommonEvent","callMapEvent"].includes(kind)) return "flow";
  if (["changeGold","changeItem","changeExp","changeLevel","recoverAll","changeActorHp","changeActorMp","battleProcessing"].includes(kind)) return "reward";
  if (["transfer","moveEvent","changeTile","setEventGraphicPattern"].includes(kind)) return "map";
  if (["wait","inputWait","playBgm","playSe","fadeIn","fadeOut"].includes(kind)) return "screen";
  return "system";
}

function kindLabel(kind: string): string {
  const m: Record<string,string> = {
    text:"대사", changeFace:"표정", choices:"선택지", fork:"분기", loop:"반복",
    transfer:"이동", moveEvent:"이벤트 이동", playBgm:"BGM", playSe:"SE",
    battleProcessing:"전투", shopProcessing:"상점", innProcessing:"여관",
    changeGold:"골드", changeItem:"아이템", wait:"대기",
  };
  // 커스텀 표에 없으면 명령 사전의 한글 라벨로 — 내부 명령명(setSwitch 등)을
  // 카드 제목에 그대로 노출하지 않는다(2026-08-18 적대 평가 C03).
  return m[kind] ?? commandKindLabel(kind as Parameters<typeof commandKindLabel>[0]);
}

export function renderStoryboard(
  commands: readonly Command[],
  opts?: { onSelect?: (path: number[]) => void; onAddNext?: () => void; onShowList?: () => void }
): HTMLElement {
  const host = el("div", { class: "event-storyboard", dataset: { testid: "event-storyboard" } });
  const track = el("div", { class: "event-storyboard-track" });
  const selectPath = (path: number[], control: HTMLElement) => {
    for (const candidate of host.querySelectorAll<HTMLElement>("[data-cmd-path]")) {
      candidate.classList.toggle("is-selected", candidate === control);
      if (candidate === control) candidate.setAttribute("aria-current", "step");
      else candidate.removeAttribute("aria-current");
    }
    opts?.onSelect?.(path);
  };

  if (commands.length === 0) {
    track.append(el("div", {
      class: "event-storyboard-empty",
      children: [
        el("strong", { text: "아직 할 일이 없습니다" }),
        el("span", { text: "아래의 [첫 명령 추가]를 눌러 시작하세요." }),
      ],
    }));
  } else {
    commands.forEach((cmd, idx) => {
      const info = summarizeCommand(cmd);
      const branches = branchesOf(cmd);
      const visibleBranches = branches.slice(0, 2);
      const hiddenBranches = Math.max(0, branches.length - visibleBranches.length);
      const branchRow = branches.length > 0
        ? el("span", {
            class: "event-storyboard-card-branches",
            children: [
              ...visibleBranches.map((br) => el("span", {
                class: "event-storyboard-branch",
                children: [el("span", {
                  class: "event-storyboard-branch-label",
                  text: (br.label || "이름 없는 분기").slice(0, 12),
                })],
              })),
              ...(hiddenBranches > 0
                ? [el("span", { class: "event-storyboard-branch-more", text: `+${hiddenBranches}` })]
                : []),
            ],
          })
        : null;
      const card = el("button", {
        class: "event-storyboard-card",
        attrs: {
          type: "button",
          style: `--storyboard-accent:${info.color}`,
          "aria-label": `${idx + 1}번째 명령, ${info.title}: ${info.detail}`,
        },
        dataset: { testid: `event-storyboard-card-${idx}`, cmdPath: JSON.stringify([idx]) },
        on: { click: (event) => selectPath([idx], event.currentTarget as HTMLElement) },
        children: [
          el("span", { class: "event-storyboard-card-thumb", text: String(idx + 1) }),
          el("span", {
            class: "event-storyboard-card-copy",
            children: [
              el("span", { class: "event-storyboard-card-title", text: info.title }),
              el("span", { class: "event-storyboard-card-detail", text: info.detail }),
            ],
          }),
          el("span", { class: "event-storyboard-card-action", text: "편집" }),
          ...(branchRow ? [branchRow] : []),
        ],
      });
      track.append(card);
    });
  }

  const addCard = el("button", {
    class: "event-storyboard-add",
    attrs: { type: "button", "aria-label": commands.length === 0 ? "첫 명령 추가" : "다음 명령 추가" },
    dataset: { testid: "event-storyboard-add" },
    on: { click: () => opts?.onAddNext?.() },
    children: [
      el("span", { class: "event-storyboard-add-plus", text: "＋" }),
      el("span", {
        class: "event-storyboard-add-copy",
        children: [
          el("span", { class: "event-storyboard-add-label", text: commands.length === 0 ? "첫 명령 추가" : "다음 명령 추가" }),
          el("span", { class: "event-storyboard-add-hint", text: "명령 팔레트 열기" }),
        ],
      }),
      el("span", { class: "event-storyboard-add-action", text: "추가" }),
    ],
  });
  track.append(addCard);
  host.append(track);
  host.append(el("div", { class: "event-storyboard-hint", text: "위에서 아래로 실행됩니다 · 카드와 분기 명령을 눌러 바로 편집" }));
  return host;
}

type StoryboardBranch = {
  label: string;
  commands: readonly Command[];
  pathSegment: number;
};

function branchesOf(cmd: Command): StoryboardBranch[] {
  if (cmd.kind === "choices") {
    return [
      ...cmd.options.map((option, optionIdx) => ({
        label: option.text,
        commands: option.branch,
        pathSegment: optionIdx,
      })),
      ...(cmd.cancelBranch
        ? [{ label: "취소", commands: cmd.cancelBranch, pathSegment: CHOICE_CANCEL_BRANCH_INDEX }]
        : []),
    ];
  }
  if (cmd.kind === "fork") {
    return [
      { label: "조건을 만족함", commands: cmd.then, pathSegment: FORK_THEN_BRANCH_INDEX },
      ...(cmd.else
        ? [{ label: "조건을 만족하지 않음", commands: cmd.else, pathSegment: FORK_ELSE_BRANCH_INDEX }]
        : []),
    ];
  }
  if (cmd.kind === "loop") {
    return [{ label: "반복할 내용", commands: cmd.body, pathSegment: LOOP_BODY_BRANCH_INDEX }];
  }
  const branches = cmd as unknown as {
    victoryBranch?: Command[];
    defeatBranch?: Command[];
    escapeBranch?: Command[];
  };
  if (cmd.kind === "battleProcessing" && branches.victoryBranch) {
    return [
      ...(branches.victoryBranch
        ? [{ label: "승리", commands: branches.victoryBranch, pathSegment: BATTLE_VICTORY_BRANCH_INDEX }]
        : []),
      ...(branches.defeatBranch
        ? [{ label: "패배", commands: branches.defeatBranch, pathSegment: BATTLE_DEFEAT_BRANCH_INDEX }]
        : []),
      ...(branches.escapeBranch
        ? [{ label: "도주", commands: branches.escapeBranch, pathSegment: BATTLE_ESCAPE_BRANCH_INDEX }]
        : []),
    ];
  }
  return [];
}

export function renderViewToggle(
  current: StoryboardMode,
  onChange: (next: StoryboardMode) => void
): HTMLElement {
  const modes: readonly StoryboardMode[] = ["list","storyboard"];
  const labels: Record<StoryboardMode,string> = { list:"목록", storyboard:"스토리보드" };
  const bar = el("div", {
    class: "event-view-toggle",
    attrs: { role: "group", "aria-label": "보기 방식" },
    dataset: { testid: "event-view-toggle" },
  });
  for (const mode of modes) {
    const btn = el("button", {
      class: `event-view-toggle-btn${mode === current ? " is-active" : ""}`,
      text: labels[mode],
      attrs: { type: "button", "aria-pressed": mode === current ? "true" : "false" },
      dataset: { testid: `event-view-toggle-${mode}` },
      on: { click: () => { if (mode !== current) { saveStoryboardMode(mode); onChange(mode); } } },
    });
    bar.append(btn);
  }
  return bar;
}
