// start/playFeed/playFeed.ts
// 시작 화면의 「내 월드」 — 이 컴퓨터의 게임 폴더(최근 목록)를 그림 카드로(2026-10-17, 플레이·만들기 런처).
// 두 갈래가 같은 카드를 쓰고 단추 무게만 바꾼다: 플레이 갈래는 「플레이」가 주, 「편집」이 곁. 만들기 갈래는 반대.
// 공유 월드(store.openrpgmaker.com)는 아직 잇지 않는다 — 빈 줄을 미리 그려 두지 않는다.
import { el } from "@/util/dom";
import type { RecentProjectEntry } from "../../../electron/shared/start";
import { startIcon, type StartIconName } from "../icons";

export const PLAYED_KEY = "oprn:start-played";
/** 기억하는 플레이 기록 수. 최근 목록보다 넉넉하면 된다. */
const MAX_PLAYED = 40;

/** 폴더 → 시작 화면에서 마지막으로 「플레이」를 누른 시각(ISO). 이 컴퓨터의 localStorage 에만 둔다. */
export type PlayedLog = Readonly<Record<string, string>>;

export function readPlayedLog(storage: Pick<Storage, "getItem"> | null): PlayedLog {
  let parsed: unknown;
  try { parsed = JSON.parse(storage?.getItem(PLAYED_KEY) ?? "{}"); } catch { return {}; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return Object.fromEntries(Object.entries(parsed).filter(([, at]) => typeof at === "string" && Number.isFinite(Date.parse(at))));
}

export function recordPlayed(storage: Pick<Storage, "getItem" | "setItem"> | null, projectDir: string, now = Date.now()): void {
  const next = { ...readPlayedLog(storage), [projectDir]: new Date(now).toISOString() };
  const kept = Object.entries(next).sort(([, a], [, b]) => Date.parse(b) - Date.parse(a)).slice(0, MAX_PLAYED);
  try { storage?.setItem(PLAYED_KEY, JSON.stringify(Object.fromEntries(kept))); } catch { /* 기록을 못 남겨도 플레이는 열린다. */ }
}

/** 플레이한 적 있는 항목만, 최근에 플레이한 순서로. */
export function worldsByLastPlayed(entries: readonly RecentProjectEntry[], log: PlayedLog): readonly RecentProjectEntry[] {
  const at = (entry: RecentProjectEntry): number => Date.parse(log[entry.projectDir] ?? "");
  return entries.filter((entry) => Number.isFinite(at(entry))).sort((a, b) => at(b) - at(a));
}

/** 카드 그림. 아직 없으면 제목 첫 글자 — 시작 화면이 곧 굽고(data-cover-for 로 이 칸만 바꾼다), 그릴 수 없는 맵이면 그대로 둔다. */
export function coverArt(entry: RecentProjectEntry): HTMLElement {
  const art = el("span", { class: "ln-art", attrs: { "aria-hidden": "true" }, dataset: { coverFor: entry.projectDir } });
  if (entry.cover) {
    art.append(el("img", { attrs: { src: entry.cover, alt: "", decoding: "async", draggable: "false" } }));
  } else {
    art.classList.add("is-empty");
    art.append(el("span", { text: Array.from(entry.title.trim())[0] ?? "?" }));
  }
  return art;
}

export type WorldAction = {
  readonly label: string;
  readonly testid: string;
  readonly icon?: StartIconName;
  readonly run: (entry: RecentProjectEntry) => void;
};

function actionButton(entry: RecentProjectEntry, action: WorldAction, className: string, index: number): HTMLButtonElement {
  return el("button", {
    class: className,
    attrs: { type: "button" },
    dataset: { testid: `${action.testid}-${index}` },
    on: { click: () => action.run(entry) },
    children: [...(action.icon ? [startIcon(action.icon, "ln-icon")] : []), action.label],
  });
}

/** 그림·제목 칸. 누르면 그 갈래의 주 동작(open)을 한다. 번호는 갈래 안에서 위에서부터 0, 1, 2… */
function hit(entry: RecentProjectEntry, open: WorldAction, className: string, cardTestid: string, index: number, children: readonly Node[]): HTMLButtonElement {
  return el("button", {
    class: className,
    attrs: { type: "button", title: entry.projectDir },
    dataset: { testid: `${cardTestid}-${index}` },
    on: { click: () => open.run(entry) },
    children,
  });
}

function worldTitle(entry: RecentProjectEntry, className: string): HTMLElement {
  return el("span", { class: className, text: entry.title, attrs: { translate: "no" } });
}

export type WorldListOptions = {
  /** 항목마다 한 줄 — 「어제 편집 · 맵 7개」. */
  readonly meta: (entry: RecentProjectEntry) => string;
  /** 그림·제목을 눌렀을 때. 그 갈래의 주 동작이다. */
  readonly open: WorldAction;
  /** 곁 동작 — 카드 오른쪽의 글자 단추. */
  readonly aside: WorldAction;
  /** 그림 칸의 data-testid 앞부분. 뒤에 순번이 붙는다. */
  readonly cardTestid: string;
};

/**
 * 맨 위 한 판: 큰 그림 + 제목 + 단추 둘, 오른쪽에 다음 몇 개를 줄로.
 * 주 단추(primary)는 open 과 같은 일이고, 보조 단추는 aside 와 같은 일이다.
 */
export function worldLead(entry: RecentProjectEntry, options: WorldListOptions & {
  readonly side: { readonly title: string; readonly entries: readonly RecentProjectEntry[] } | null;
}): HTMLElement {
  const { meta, open, aside, cardTestid } = options;
  const side = options.side && options.side.entries.length > 0 ? options.side : null;
  // 큰 그림은 주 단추와 같은 일을 하는 마우스용 넓은 과녁이다 — 키보드·화면 읽기는 주 단추 하나만 만난다.
  const art = hit(entry, open, "ln-lead-art", cardTestid, 0, [coverArt(entry)]);
  art.tabIndex = -1;
  art.setAttribute("aria-hidden", "true");
  return el("div", { class: "ln-lead" + (side ? "" : " is-solo"), children: [
    art,
    el("div", { class: "ln-lead-copy", children: [
      el("h3", { text: entry.title, attrs: { translate: "no" } }),
      el("p", { class: "ln-meta", text: meta(entry) }),
      el("div", { class: "ln-lead-actions", children: [
        actionButton(entry, open, "ln-btn ln-btn-primary", 0),
        actionButton(entry, aside, "ln-btn ln-btn-secondary", 0),
      ] }),
    ] }),
    ...(side ? [el("div", { class: "ln-lead-side", children: [
      el("h4", { text: side.title }),
      ...side.entries.map((other, offset) => el("div", { class: "ln-row", children: [
        hit(other, open, "ln-row-hit", cardTestid, offset + 1, [
          coverArt(other),
          el("span", { class: "ln-row-copy", children: [worldTitle(other, "ln-world-title"), el("small", { text: meta(other) })] }),
        ]),
        actionButton(other, aside, "ln-link", offset + 1),
      ] })),
    ] })] : []),
  ] });
}

/** 카드 격자. firstIndex 는 그림 칸 번호의 시작(위 판이 0…n 을 이미 썼으면 n+1). */
export function worldGrid(entries: readonly RecentProjectEntry[], options: WorldListOptions & { readonly firstIndex: number }): HTMLElement {
  const { meta, open, aside, cardTestid, firstIndex } = options;
  return el("div", { class: "ln-grid", children: entries.map((entry, offset) => el("article", {
    class: "ln-card" + (entry.hiddenReason ? " is-hidden-entry" : ""),
    children: [
      hit(entry, open, "ln-card-hit", cardTestid, firstIndex + offset, [coverArt(entry), worldTitle(entry, "ln-world-title")]),
      el("div", { class: "ln-card-meta", children: [
        el("span", { text: meta(entry) }),
        actionButton(entry, aside, "ln-link", firstIndex + offset),
      ] }),
    ],
  })) });
}
