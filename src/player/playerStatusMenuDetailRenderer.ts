import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { StatusMenuDetail, StatusMenuDetailEntry, StatusMenuDetailFact } from "@/player/playerStatusMenuDetails";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

export type StatusMenuDetailPanelOptions = {
  readonly selectedActionIndex?: number;
  /** 작업 패널(아이템·스킬·장뱄)에서 커서가 올라간 항목을 목록 옆 쇼케이스(큰 그림 + 이름 + 설명)로 보여준다.
      트레이·확인 카드는 거짓을 넘긴다. */
  readonly showcase?: boolean;
};

const detailContexts = new WeakMap<HTMLElement, { project: Project; detail: StatusMenuDetail; showcase: boolean }>();

/** Cursor movement keeps the list, its focus and its scroll position alive. */
export function updateStatusMenuDetailSelection(panel: HTMLElement, index: number): string | undefined {
  const context = detailContexts.get(panel);
  if (!context) return undefined;
  const { project, detail } = context;
  const tabCount = detail.tabs?.filter((tab) => tab.onActivate).length ?? 0;
  const entry = detail.entries.filter((row) => row.onActivate && !row.disabled)[index - tabCount];
  const existing = panel.querySelector(".status-menu-detail-showcase");
  const next = context.showcase && entry ? renderDetailShowcase(project, entry) : null;
  existing?.remove();
  if (next) panel.append(next);
  panel.classList.toggle("has-showcase", Boolean(next));
  return entry?.unavailableReason ?? entry?.description ?? detail.hint;
}

export function renderStatusMenuDetailPanel(
  project: Project,
  detail: StatusMenuDetail,
  options: StatusMenuDetailPanelOptions = {}
): HTMLElement {
  const selectedActionIndex = options.selectedActionIndex ?? 0;
  const panel = el("section", {
    class: "status-menu-detail",
    attrs: { tabindex: "-1" },
    dataset: { testid: "status-menu-detail" },
  });
  detailContexts.set(panel, { project, detail, showcase: options.showcase ?? false });
  if (detail.tabs?.length) panel.classList.add("life-ledger-detail");
  panel.append(el("h2", {
    class: "status-menu-detail-title",
    text: detail.title,
    dataset: { testid: "status-menu-detail-title" },
  }));
  if (detail.artwork) {
    panel.append(el("figure", {
      class: "life-ledger-artwork",
      children: [el("img", {
        attrs: { src: detail.artwork.src, alt: detail.artwork.alt },
        dataset: { testid: "life-ledger-artwork" },
      })],
    }));
  }
  let enabledActionIndex = 0;
  let selectedEntry: StatusMenuDetailEntry | undefined;
  if (detail.tabs?.length) {
    const tabs = el("div", {
      class: "life-ledger-tabs",
      attrs: { role: "tablist", "aria-label": `${detail.title} 분류` },
    });
    for (const tab of detail.tabs) {
      const actionIndex = tab.onActivate ? enabledActionIndex : undefined;
      const button = el("button", {
        class: "life-ledger-tab status-menu-detail-action",
        text: tab.label,
        attrs: {
          type: "button",
          role: "tab",
          "aria-selected": String(tab.selected),
          "aria-controls": "life-ledger-tab-panel",
        },
        dataset: {
          testid: tab.testId,
          ...(actionIndex === undefined ? {} : { actionIndex: String(actionIndex) }),
        },
        ...(tab.onActivate ? { on: { click: tab.onActivate } } : {}),
      });
      if (tab.selected) button.classList.add("active");
      if (actionIndex === options.selectedActionIndex) button.classList.add("selected");
      tabs.append(button);
      if (actionIndex !== undefined) enabledActionIndex += 1;
    }
    panel.append(tabs);
  }
  if (detail.entries.length === 0) {
    panel.append(el("div", {
      class: "status-menu-detail-empty",
      text: detail.emptyLabel ?? detail.hint ?? "",
      attrs: { id: "life-ledger-tab-panel", role: detail.tabs ? "tabpanel" : "status" },
    }));
    if (detail.hint) panel.append(el("div", { class: "status-menu-detail-hint", text: detail.hint }));
    return panel;
  }
  const interactiveList = detail.entries.some((entry) => Boolean(entry.onActivate));
  const list = el("div", {
    class: "status-menu-detail-list",
    attrs: {
      id: "life-ledger-tab-panel",
      role: detail.tabs ? "tabpanel" : interactiveList ? "menu" : "list",
      tabindex: "0",
    },
  });
  for (const entry of detail.entries) {
    const actionIndex = entry.onActivate && !entry.disabled ? enabledActionIndex : undefined;
    const row = renderDetailEntry({
      project,
      entry,
      selected: actionIndex === selectedActionIndex,
      actionIndex,
      informationalList: !interactiveList,
    });
    list.append(row);
    if (actionIndex === selectedActionIndex) {
      list.setAttribute("aria-activedescendant", detailEntryId(entry, actionIndex));
      selectedEntry = entry;
    }
    if (actionIndex !== undefined) enabledActionIndex += 1;
  }
  panel.append(list);
  // 쇼케이스는 목록 바깥의 별도 영역이다 — 행 안에 설명을 다시 넣으면 행 높이가 두 배가 되는 전력이 있다(위 주석).
  if (options.showcase && interactiveList && selectedEntry) {
    const showcase = renderDetailShowcase(project, selectedEntry);
    if (showcase) {
      panel.classList.add("has-showcase");
      panel.append(showcase);
    }
  }
  // 조작 가능한 목록에서는 힌트 줄을 그리지 않는다 — 힌트가 행 하나 몫(14px)을 먹어
  // 장비 슬롯 5개 중 3.5개만 보이고 넷째 행이 가로로 잘렸다(실측). 안내는 푸터가 맡는다.
  if (detail.hint && !interactiveList) {
    panel.append(el("div", { class: "status-menu-detail-hint", text: detail.hint }));
  }
  return panel;
}

function renderDetailEntry(options: {
  readonly project: Project;
  readonly entry: StatusMenuDetailEntry;
  readonly selected: boolean;
  readonly actionIndex?: number;
  readonly informationalList: boolean;
}): HTMLElement {
  const { project, entry, selected, actionIndex, informationalList } = options;
  // 조작 가능한 행(아이템/스킬/장비 후보)의 설명은 푸터가 대신 보여준다 → 행을 1줄로 압축해
  // 리스트가 잘린 글자로 끝나는 문제를 없앤다. 정보성 행(상태 화면 등)은 설명을 그대로 붙인다
  // — 그쪽은 푸터로 옮길 대상이 여러 개 동시에 필요해서 대체가 안 된다.
  const inlineDescription = Boolean(entry.description) && !entry.onActivate;
  const rowClasses = [
    "status-menu-detail-row",
    inlineDescription ? "has-description" : "",
    entry.onActivate ? "status-menu-detail-row-compact" : "",
    entry.disabled ? "disabled" : "",
    entry.unavailableReason ? "unavailable" : "",
    entry.vitals ? "with-vitals" : "",
    entry.destructive ? "destructive" : "",
  ].filter(Boolean).join(" ");
  const row = entry.onActivate
    ? el("button", {
        class: `${rowClasses} status-menu-detail-action`,
        attrs: {
          id: detailEntryId(entry, actionIndex),
          type: "button",
          role: "menuitem",
          tabindex: selected ? "0" : "-1",
          "aria-current": selected ? "true" : "false",
          "aria-label": [entry.label, entry.description].filter(Boolean).join(" — "),
          ...(entry.disabled ? { disabled: "true", "aria-disabled": "true" } : {}),
          ...(entry.unavailableReason ? { "aria-disabled": "true" } : {}),
        },
        dataset: detailEntryDataset(entry, actionIndex),
        on: { click: () => { if (!entry.unavailableReason) entry.onActivate?.(); } },
      })
    : el("div", {
        class: rowClasses,
        attrs: informationalList ? { role: "listitem" } : undefined,
        dataset: {
          ...(entry.testId ? { testid: entry.testId } : {}),
          ...(entry.unavailableReason ? { unavailableReason: entry.unavailableReason } : {}),
        },
      });
  if (selected) row.classList.add("selected");
  if (entry.vitals) {
    if (entry.face) row.append(renderDetailFace(project, entry.face, 24));
    row.append(el("span", { class: "status-menu-target-name", text: entry.label }));
    for (const kind of ["hp", "mp"] as const) {
      const current = entry.vitals[kind];
      const max = entry.vitals[kind === "hp" ? "maxHp" : "maxMp"];
      const next = entry.vitals[kind === "hp" ? "hpAfter" : "mpAfter"];
      row.append(el("span", {
        class: `status-menu-target-vital ${kind}`,
        children: [
          el("span", { text: `${kind.toUpperCase()} ${current}/${max}${next > current ? ` → ${next}` : ""}` }),
          el("span", { class: "status-menu-target-track", children: [
            el("span", { class: "status-menu-target-preview", attrs: { style: `width:${max ? next / max * 100 : 0}%` } }),
            el("span", { class: "status-menu-target-fill", attrs: { style: `width:${max ? current / max * 100 : 0}%` } }),
          ] }),
        ],
      }));
    }
    return row;
  }
  if (entry.icon) {
    row.append(renderDetailEntryIcon(project, entry.icon), renderDetailText(entry, inlineDescription));
    return row;
  }
  if (entry.face) {
    row.classList.add("with-face");
    row.append(renderDetailFace(project, entry.face), renderDetailText(entry, inlineDescription));
    return row;
  }
  row.append(...renderDetailTextChildren(entry, inlineDescription));
  return row;
}

/** 선택된 항목의 그림(아이콘/얼굴)을 크게, 이름·수치·설명 전문을 그린다. 그릴 것이 없으면(동작 확인문 등) null. */
function renderDetailShowcase(project: Project, entry: StatusMenuDetailEntry): HTMLElement | null {
  if (!entry.icon && !entry.face && !entry.description && !entry.unavailableReason && !entry.statDelta && !entry.facts?.length) return null;
  const art = entry.icon
    ? renderDetailEntryIcon(project, { ...entry.icon, testId: "status-menu-showcase-art" })
    : entry.face
      ? renderDetailFace(project, { ...entry.face, testId: "status-menu-showcase-art" })
      : null;
  const children: HTMLElement[] = [];
  if (art) {
    art.classList.add("status-menu-showcase-art");
    children.push(el("div", { class: "status-menu-showcase-frame", children: [art] }));
  }
  children.push(el("div", {
    class: "status-menu-showcase-name",
    text: entry.label,
    dataset: { testid: "status-menu-showcase-name" },
  }));
  if (entry.value) {
    children.push(el("div", { class: "status-menu-showcase-value", text: entry.value }));
  }
  if (entry.unavailableReason || entry.description) {
    children.push(el("p", {
      class: "status-menu-showcase-description",
      text: entry.unavailableReason ?? (entry.statDelta ? entry.description?.split("/")[0]?.trim() : entry.description),
      dataset: { testid: "status-menu-showcase-description" },
    }));
  }
  if (entry.statDelta?.length) {
    children.push(el("section", {
      class: "status-menu-stat-delta", dataset: { testid: "status-menu-stat-delta" },
      children: entry.statDelta.map((delta) => el("div", {
        class: `status-menu-stat-delta-row${delta.next > delta.current ? " up" : delta.next < delta.current ? " down" : ""}`,
        dataset: { testid: `status-menu-stat-delta-${delta.label}` },
        children: [
          el("span", { class: "status-menu-stat-delta-label", text: delta.label }),
          el("span", { class: "status-menu-stat-delta-value", text: `${delta.current} → ${delta.next}` }),
        ],
      })),
    }));
  }
  if (entry.facts?.length) {
    children.push(el("section", {
      class: "status-menu-stat-delta status-menu-item-facts",
      dataset: { testid: "status-menu-item-facts" },
      children: entry.facts.flatMap((fact) => renderItemFactRows(project, fact)),
    }));
  }
  return el("aside", {
    class: `status-menu-detail-showcase${entry.statDelta || entry.facts?.length ? " has-stat-delta" : ""}${entry.facts?.length ? " has-item-facts" : ""}`,
    attrs: { "aria-live": "polite" },
    dataset: { testid: "status-menu-detail-showcase" },
    children,
  });
}

const ITEM_FACT_LABEL: Record<string, string> = {
  type: "종류",
  effects: "효과",
  eligibility: "사용",
  target: "대상",
  consumption: "소모",
};

const ITEM_TYPE_LABEL: Record<string, string> = {
  medicine: "약",
  normalGoods: "일반",
  book: "책",
  seed: "씨앗",
  special: "특수",
  switch: "장치",
  weapon: "무기",
  shield: "방패",
  body: "몸",
  head: "머리",
  accessory: "장신구",
};

const ITEM_ELIGIBILITY_LABEL: Record<string, string> = {
  usable: "가능",
  battle: "전투 중만",
  unusable: "불가",
  restricted: "일부만",
};

const ITEM_TARGET_LABEL = { none: "대상 없음", ally: "아군 1명", allAllies: "아군 전체", enemy: "적 1명", partyMonster: "파티 몬스터 1마리" };
const ITEM_SEED_LABEL: Record<string, string> = { attack: "공격", defense: "방어", mind: "정신", agility: "민첩" };

function renderItemFactRow(id: string, display: string, machineValue: string): HTMLElement {
  return el("div", {
    class: "status-menu-stat-delta-row",
    dataset: { testid: `status-menu-item-fact-${id}`, factId: id, factValue: machineValue },
    children: [
      el("span", { class: "status-menu-stat-delta-label", text: ITEM_FACT_LABEL[id] ?? id }),
      el("span", { class: "status-menu-stat-delta-value", text: display }),
    ],
  });
}

function renderItemFactRows(project: Project, fact: StatusMenuDetailFact): HTMLElement[] {
  if (fact.id !== "eligibility") {
    return [renderItemFactRow(fact.id, itemFactDisplay(project, fact), fact.value)];
  }
  const rows = [renderItemFactRow("eligibility", ITEM_ELIGIBILITY_LABEL[fact.value] ?? fact.value, fact.value)];
  if (fact.targeting) {
    const display = [ITEM_TARGET_LABEL[fact.targeting.scope], fact.targeting.deadOnly ? "전투불능만" : ""]
      .filter(Boolean).join(" · ");
    rows.push(renderItemFactRow("target", display, fact.targeting.scope));
  }
  if (fact.consumption) {
    const display = fact.consumption.consumable
      ? `현재 ${fact.consumption.remainingCopyUses}/${fact.consumption.usesPerCopy}회 · 총 ${fact.consumption.remainingUses}회`
      : "재사용";
    rows.push(renderItemFactRow(
      "consumption",
      display,
      fact.consumption.consumable ? `${fact.consumption.remainingCopyUses}/${fact.consumption.usesPerCopy}` : "reusable",
    ));
  }
  return rows;
}

function itemFactDisplay(project: Project, fact: StatusMenuDetailFact): string {
  if (fact.id === "type") return ITEM_TYPE_LABEL[fact.value] ?? fact.value;
  return formatItemEffectTokens(project, fact.value.split(",").filter(Boolean));
}

function formatItemEffectTokens(project: Project, tokens: readonly string[]): string {
  const parts: string[] = [];
  const healNames: string[] = [];
  const flushHeals = () => {
    if (healNames.length === 0) return;
    parts.push(`치료 ${healNames.join(" · ")}`);
    healNames.length = 0;
  };
  for (const token of tokens) {
    if (token === "none") {
      flushHeals();
      parts.push(itemEffectTokenLabel(project, token));
      continue;
    }
    const [kind, raw] = token.split(":");
    if (kind === "heal") {
      const value = decodeURIComponent(raw ?? "");
      healNames.push(project.database.states.find((state) => state.id === value)?.name ?? value);
      continue;
    }
    flushHeals();
    parts.push(itemEffectTokenLabel(project, token));
  }
  flushHeals();
  return parts.join(" · ");
}

function itemEffectTokenLabel(project: Project, token: string): string {
  if (token === "none") return "없음";
  const [kind, raw, amount, extra] = token.split(":");
  const value = decodeURIComponent(raw ?? "");
  switch (kind) {
    case "hp": return `HP +${value}`;
    case "hp%": return `HP ${value}%`;
    case "mp": return `MP +${value}`;
    case "mp%": return `MP ${value}%`;
    case "heal": return `치료 ${project.database.states.find((state) => state.id === value)?.name ?? value}`;
    case "state": return `상태 ${project.database.states.find((state) => state.id === value)?.name ?? value} ${amount}%`;
    case "learn": return `습득 ${project.database.skills.find((skill) => skill.id === value)?.name ?? value}`;
    case "skill": return `스킬 ${project.database.skills.find((skill) => skill.id === value)?.name ?? value}`;
    case "switch": return `장치 ${project.switches.find((entry) => entry.id === value)?.name || value}`;
    case "care": return `${value === "toy" ? "장난감" : "먹이"} · 친밀도 ${signedItemAmount(Number(amount))} · EXP ${signedItemAmount(Number(extra))}`;
    case "capture": return `포획 ×${value}`;
    case "capture-class": return `포획 ${value}`;
    case "seed": return `${ITEM_SEED_LABEL[value] ?? value} ${signedItemAmount(Number(amount))}`;
    default: return token;
  }
}

function signedItemAmount(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function detailEntryId(entry: StatusMenuDetailEntry, actionIndex?: number): string {
  return entry.testId ?? `status-menu-detail-action-${actionIndex ?? "disabled"}`;
}

function detailEntryDataset(entry: StatusMenuDetailEntry, actionIndex?: number): Record<string, string> | undefined {
  const fromAttributes = Object.fromEntries(
    Object.entries(entry.attributes ?? {}).map(([key, value]) => {
      const bare = key.startsWith("data-") ? key.slice(5) : key;
      const camel = bare.replace(/-([a-z])/gu, (_, ch: string) => ch.toUpperCase());
      return [camel, value];
    }),
  );
  if (!entry.testId && actionIndex === undefined && Object.keys(fromAttributes).length === 0) return undefined;
  return {
    ...(entry.testId ? { testid: entry.testId } : {}),
    ...(actionIndex === undefined ? {} : { actionIndex: String(actionIndex) }),
    ...(entry.unavailableReason ? { unavailableReason: entry.unavailableReason } : {}),
    ...fromAttributes,
  };
}

function renderDetailText(entry: StatusMenuDetailEntry, inlineDescription: boolean): HTMLElement {
  return el("span", {
    class: "status-menu-detail-copy",
    children: renderDetailTextChildren(entry, inlineDescription),
  });
}

// 조작 가능한 행은 설명 노드를 아예 만들지 않는다. 만들어 두고 CSS 로 접으면
// 실측처럼 둘째 줄이 생겨 행 높이가 두 배가 되고(실측: 88px vs 54px) 81px 목록에
// 아이템 7개 중 2개만 온전히 들어갔다 — 셋째 행은 문장 중간에서 잘렸다.
// 전문은 푸터(status-menu-message)가 보여주므로 행 안의 사본은 높이만 먹는다.
function renderDetailTextChildren(entry: StatusMenuDetailEntry, inlineDescription: boolean): HTMLElement[] {
  const children = [
    el("span", { class: "status-menu-detail-label", text: entry.label }),
    el("span", { class: "status-menu-detail-value", text: entry.value }),
  ];
  if (entry.description && inlineDescription) {
    children.push(el("span", { class: "status-menu-detail-description", text: entry.description }));
  }
  return children;
}

function renderDetailEntryIcon(project: Project, icon: NonNullable<StatusMenuDetailEntry["icon"]>): HTMLElement {
  const url = resolveAssetResourceUrl(icon.resourceId, { project });
  if (!url) {
    return el("span", {
      class: "status-menu-entry-icon missing",
      attrs: { role: "img", "aria-label": `${icon.alt} missing` },
      dataset: { testid: icon.testId },
    });
  }
  if (icon.sheet) {
    const { frameWidth, frameHeight, columns } = icon.sheet;
    const longestSide = Math.max(frameWidth, frameHeight);
    return el("span", {
      class: "status-menu-entry-icon",
      attrs: { role: "img", "aria-label": icon.alt, style: "display:grid;place-items:center" },
      dataset: { testid: icon.testId },
      children: [el("span", {
        attrs: {
          "aria-hidden": "true",
          style: [
            `width:${frameWidth / longestSide * 100}%`,
            `height:${frameHeight / longestSide * 100}%`,
            `background-image:url("${url}")`,
            `background-size:${columns * 100}% auto`,
            "background-position:0 0",
            "background-repeat:no-repeat",
            "image-rendering:pixelated",
          ].join(";"),
        },
      })],
    });
  }
  return el("span", {
    class: "status-menu-entry-icon",
    attrs: {
      role: "img",
      "aria-label": icon.alt,
      style: [
        `background-image:url("${url}")`,
        "background-size:contain",
        "background-repeat:no-repeat",
        "background-position:center",
        "image-rendering:pixelated",
      ].join(";"),
    },
    dataset: { testid: icon.testId },
  });
}

function renderDetailFace(project: Project, face: NonNullable<StatusMenuDetailEntry["face"]>, size = 32): HTMLElement {
  const url = resolveAssetResourceUrl(face.resourceId, { project });
  if (!url) {
    return el("span", {
      class: "status-menu-detail-face missing",
      text: "Face",
      attrs: { role: "img", "aria-label": `${face.alt} missing` },
      dataset: { testid: face.testId },
    });
  }
  // 얼굴은 낱장 파일 한 장이다 — 32px 상자에 그대로 맞춘다(시트 크롭 없음).
  return el("span", {
    class: "status-menu-detail-face",
    attrs: {
      role: "img",
      "aria-label": face.alt,
      style: [
        `background-image:url("${url}")`,
        `background-size:${size}px ${size}px`,
        "background-repeat:no-repeat",
        "image-rendering:pixelated",
        `width:${size}px`,
        `height:${size}px`,
      ].join(";"),
    },
    dataset: { testid: face.testId },
  });
}
