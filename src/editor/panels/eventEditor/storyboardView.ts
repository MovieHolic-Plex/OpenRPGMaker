import { el } from "@/util/dom";
import { commandSummary } from "./commandSummary";
import type { Command } from "@/project/types";

export type StoryboardMode = "storyboard" | "list" | "graph";

const MODE_KEY = "rpg-zzu:storyboard-mode";

export function loadStoryboardMode(): StoryboardMode {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    if (raw === "list" || raw === "graph" || raw === "storyboard") return raw;
  } catch { /* ignore */ }
  return "storyboard";
}

export function saveStoryboardMode(mode: StoryboardMode): void {
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
}

function summarizeCommand(cmd: Command): { title: string; detail: string; color: string } {
  const s = (() => { try { return commandSummary(cmd); } catch { return cmd.kind; } })();
  const cat = categoryOf(cmd.kind);
  const colorMap: Record<string,string> = {
    dialogue: "#3987e5", flow: "#d95926", reward: "#199e70",
    map: "#9085e9", screen: "#d55181", system: "#c98500",
  };
  return { title: kindLabel(cmd.kind), detail: s.slice(0, 80), color: colorMap[cat] ?? "#626b7d" };
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
    changeGold:"골드", changeItem:"아이템", wait:"대기", callCommonEvent:"공통 이벤트",
  };
  return m[kind] ?? kind;
}

export function renderStoryboard(
  commands: readonly Command[],
  opts?: { onSelect?: (path: number[]) => void; onAddNext?: () => void }
): HTMLElement {
  const host = el("div", { class: "event-storyboard", dataset: { testid: "event-storyboard" } });
  const track = el("div", { class: "event-storyboard-track" });
  if (commands.length === 0) {
    track.append(el("div", { class: "event-storyboard-empty", text: "아직 장면이 없습니다 \u2014 아래에서 시작 유형을 고르세요." }));
  } else {
    commands.forEach((cmd, idx) => {
      const info = summarizeCommand(cmd);
      const branches = branchesOf(cmd);
      const card = el("button", {
        class: "event-storyboard-card",
        attrs: { type: "button" },
        dataset: { testid: `event-storyboard-card-${idx}`, cmdPath: JSON.stringify([idx]) },
        on: { click: () => opts?.onSelect?.([idx]) },
        children: [
          el("span", { class: "event-storyboard-card-thumb", attrs: { style: `background:${info.color}` }, text: String(idx + 1) }),
          el("span", { class: "event-storyboard-card-title", text: info.title }),
          el("span", { class: "event-storyboard-card-detail", text: info.detail }),
        ],
      });
      track.append(card);
      if (branches.length > 0) {
        const shown = branches.slice(0, 2);
        const row = el("div", { class: "event-storyboard-card-branches" });
        for (const br of shown) {
          row.append(el("div", {
            class: "event-storyboard-branch",
            children: [
              el("span", { class: "event-storyboard-branch-label", text: br.label }),
              el("span", { class: "event-storyboard-branch-count", text: `${br.commands.length}개` }),
            ],
          }));
        }
        const remaining = branches.length - shown.length;
        if (remaining > 0) {
          row.append(el("span", { class: "event-storyboard-branch-more", text: `+${remaining}` }));
        }
        card.append(row);
      }
    });
  }
  const addCard = el("button", {
    class: "event-storyboard-add",
    attrs: { type: "button", "aria-label": "장면 추가" },
    dataset: { testid: "event-storyboard-add" },
    on: { click: () => opts?.onAddNext?.() },
    children: [
      el("span", { class: "event-storyboard-add-plus", text: "\uFF0B" }),
      el("span", { class: "event-storyboard-add-label", text: "장면 추가" }),
      el("span", { class: "event-storyboard-add-hint", text: "AI에게 \u201C다음에 뭐 넣을까?\u201D 물어보기" }),
    ],
  });
  track.append(addCard);
  host.append(track);
  host.append(el("div", { class: "event-storyboard-hint", text: "만화처럼 왼쪽\u2192오른쪽으로 읽습니다 \u00B7 카드를 눌러 편집 \u00B7 복잡하면 Graph로 전환" }));
  return host;
}

function branchesOf(cmd: Command): { label: string; commands: readonly Command[] }[] {
  if (cmd.kind === "choices") {
    return [
      ...cmd.options.map(o => ({ label: o.text.slice(0, 12), commands: o.branch })),
      ...(cmd.cancelBranch ? [{ label: "취소", commands: cmd.cancelBranch }] : []),
    ];
  }
  if (cmd.kind === "fork") {
    return [
      { label: "참", commands: cmd.then },
      ...(cmd.else ? [{ label: "거짓", commands: cmd.else }] : []),
    ];
  }
  if (cmd.kind === "loop") return [{ label: "반복", commands: cmd.body }];
  const b = cmd as unknown as { victoryBranch?: Command[]; defeatBranch?: Command[]; escapeBranch?: Command[] };
  if (cmd.kind === "battleProcessing" && b.victoryBranch) {
    return [
      ...(b.victoryBranch ? [{ label: "승리", commands: b.victoryBranch }] : []),
      ...(b.defeatBranch ? [{ label: "패배", commands: b.defeatBranch }] : []),
      ...(b.escapeBranch ? [{ label: "도주", commands: b.escapeBranch }] : []),
    ];
  }
  return [];
}

export function renderViewToggle(
  current: StoryboardMode,
  onChange: (next: StoryboardMode) => void
): HTMLElement {
  const modes: readonly StoryboardMode[] = ["storyboard","list","graph"];
  const labels: Record<StoryboardMode,string> = { storyboard:"Storyboard", list:"List", graph:"Graph" };
  const bar = el("div", { class: "event-view-toggle", dataset: { testid: "event-view-toggle" } });
  for (const m of modes) {
    const btn = el("button", {
      class: `event-view-toggle-btn${m === current ? " is-active" : ""}`,
      text: labels[m],
      attrs: { type: "button", "aria-pressed": m === current ? "true" : "false" },
      dataset: { testid: `event-view-toggle-${m}` },
      on: { click: () => { if (m !== current) { saveStoryboardMode(m); onChange(m); } } },
    });
    bar.append(btn);
  }
  return bar;
}
