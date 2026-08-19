// editor/panels/aiSkillDrawer.ts
// 스킬 서랍 + 인자 폼 + 슬래시 목록 — AI 패널의 "의식적으로 쓰는 스킬" UI.
// 스킬 발견은 입력창 "/"에서 시작하고, 서랍은 전체 보기/저장/삭제 표면으로 남긴다.
import {
  deleteUserSkill,
  filterSkills,
  listAllSkills,
  recordSkillUse,
  saveUserSkill,
  type SkillDef,
  type SkillParam,
  type SkillParamType,
  type SkillRunContext,
  type SkillTilesetContext,
} from "@/ai/skills";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

export interface SkillDrawerOptions {
  getContext(): SkillRunContext;
  onRunPrompt(prompt: string, displayAs: string): void;
  onAction(skillId: string): void;
  getSavePrefill(): string;
}

// 레거시 버튼 testid 호환 — 기존 테스트/사용 습관 유지.
const LEGACY_TESTIDS: Record<string, string> = {
  interview: "ai-interview",
  "learn-structure": "ai-learn-structure",
  "demo-teach": "ai-demo-teach",
};

/**
 * 현재 타일셋 컨텍스트 — SkillRunContext.tileset을 채우는 유일한 구성처.
 * 출처: 현재 맵의 tilesetId(project.maps[*].tilesetId) + 팔레트 선택 타일(editorState.selectedTile,
 * 속한 tileGroups에서 그룹 역산) + 시트 드래그 스탬프(editorState.activePaletteStamp → 시트 rect).
 */
export function currentTilesetSkillContext(): SkillTilesetContext | null {
  const state = editorState.get();
  const project = store.getCurrent();
  const mapId = state.currentMapId ?? project.startMapId ?? null;
  const tilesetId = mapId ? project.maps[mapId]?.tilesetId : undefined;
  const tileset = tilesetId ? project.tilesets[tilesetId] : undefined;
  if (!tilesetId || !tileset) return null;
  const selectedGroupId = tileset.tileGroups?.find((group) => group.tileIds.includes(state.selectedTile))?.id;
  const stamp = state.activePaletteStamp;
  const perRow = Math.max(1, tileset.tilesPerRow);
  const sheetRect = stamp
    ? {
        x: Math.min(stamp.source.startTile % perRow, stamp.source.endTile % perRow),
        y: Math.min(Math.floor(stamp.source.startTile / perRow), Math.floor(stamp.source.endTile / perRow)),
        w: stamp.width,
        h: stamp.height,
      }
    : undefined;
  return {
    id: tilesetId,
    ...(selectedGroupId ? { selectedGroupId } : {}),
    ...(sheetRect ? { sheetRect } : {}),
  };
}

export function renderSkillParamForm(
  skill: SkillDef,
  ctx: SkillRunContext,
  onSubmit: (prompt: string, displayAs: string) => void,
  onCancel: () => void
): HTMLElement {
  const inputs = new Map<string, HTMLInputElement | HTMLSelectElement>();
  const rows = skill.params.map((param) => {
    const control = paramControl(param, ctx);
    inputs.set(param.key, control);
    return el("label", { class: "ai-skill-param-row", children: [el("span", { class: "ai-skill-param-label", text: param.label }), control] });
  });
  const run = (): void => {
    const args: Record<string, string | number> = {};
    for (const param of skill.params) {
      const control = inputs.get(param.key);
      if (!control) continue;
      if (param.type === "number") {
        const value = Number(control.value);
        const min = param.min ?? Number.MIN_SAFE_INTEGER;
        const max = param.max ?? Number.MAX_SAFE_INTEGER;
        args[param.key] = Math.min(max, Math.max(min, Number.isFinite(value) ? Math.round(value) : Number(param.defaultValue ?? min)));
      } else {
        args[param.key] = control.value;
      }
    }
    const prompt = skill.buildPrompt?.(args, ctx) ?? "";
    if (!prompt.trim()) {
      toast("프롬프트를 만들 수 없습니다 — 인자를 확인하세요.", "info");
      return;
    }
    onSubmit(prompt, skillCommandLine(skill));
  };
  return el("div", {
    class: "ai-skill-param-form",
    dataset: { testid: "ai-skill-param-form" },
    children: [
      el("div", { class: "ai-skill-param-title", text: skillCommandLine(skill) }),
      ...rows,
      el("div", {
        class: "ai-skill-param-actions",
        children: [
          // 라벨을 "스킬 실행"으로 구체화(도그푸딩 결함 ③): 상단 툴바의 테스트 플레이 버튼도
          // "실행"이라 텍스트 기반 클릭(드라이버/사용자)이 풀스크린 테스트 플레이를 여는 오클릭이
          // 발생했다 — p5/p6에서 스킬 제출이 아예 시작되지 않은 채 7분+ 대기한 근본 원인.
          el("button", {
            class: "ai-assistant-action ai-proposal-accept",
            text: "▶ 스킬 실행",
            attrs: { type: "button" },
            dataset: { testid: "skill-param-run" },
            on: { click: run },
          }),
          el("button", { class: "ai-assistant-action", text: "뒤로", attrs: { type: "button" }, dataset: { testid: "skill-param-cancel" }, on: { click: onCancel } }),
        ],
      }),
    ],
  });
}

function paramControl(param: SkillParam, ctx: SkillRunContext): HTMLInputElement | HTMLSelectElement {
  // 자동 주입: autoFill이 컨텍스트에서 값을 내면 초기값으로 쓴다(사용자 편집 가능).
  // 컨텍스트가 없어 undefined면 defaultValue/placeholder 현행 동작 유지.
  const autoFilled = param.autoFill?.(ctx);
  const initialValue = autoFilled ?? param.defaultValue;
  if (param.type === "enum") {
    const select = el("select", { class: "ai-skill-param-input" }) as HTMLSelectElement;
    for (const option of param.options ?? []) {
      const optionEl = el("option", { text: option.label, value: option.value }) as HTMLOptionElement;
      select.append(optionEl);
    }
    select.value = String(initialValue ?? param.options?.[0]?.value ?? "");
    select.dataset.testid = `skill-param-${param.key}`;
    return select;
  }
  const input = el("input", {
    class: "ai-skill-param-input",
    attrs: {
      type: param.type === "number" ? "number" : "text",
      ...(param.min !== undefined ? { min: String(param.min) } : {}),
      ...(param.max !== undefined ? { max: String(param.max) } : {}),
      ...(param.placeholder ? { placeholder: param.placeholder } : {}),
    },
    value: initialValue !== undefined ? String(initialValue) : "",
  }) as HTMLInputElement;
  input.dataset.testid = `skill-param-${param.key}`;
  return input;
}

export interface SlashListOptions {
  readonly activeIndex?: number;
  readonly onViewAll?: () => void;
}

/** 보이는 명령 줄 — 아이콘 + 한글 이름. 실행 키는 skill.id. */
export function skillCommandLine(skill: SkillDef): string {
  const icon = skill.icon.trim();
  return icon ? `${icon} ${skill.name}` : skill.name;
}

/**
 * 한 줄 예시 힌트 — `# 예: …` 형태.
 * 마케팅 문장 대신 "이렇게 쓰면 됨" 예시를 짧게(한글).
 */
const SKILL_TUI_HINTS: Readonly<Record<string, string>> = {
  interview: "예: 모르는 타일 의미 Q&A로 배우기",
  "learn-structure": "예: 선택 영역 → 구조 템플릿",
  "cluster-edit": "예: groupId=roof_main",
  "range-classify": "예: 범위 0,0,4,4 · 타일 12,13",
  "unclassified-analysis": "예: 첫 배치 12,13,14",
  "demo-teach": "예: 샌드박스에 직접 칠해서 가르치기",
  "build-house": "예: 10×10 회벽 직사각 집",
  "map-audit": "예: 린트 + 도달성 검사",
  "build-village": "예: 강가 어촌 · 집 3 · NPC 2",
  "quest-builder": "예: 반지 찾기 → 100G",
  "build-road": "예: 남문 → 광장 모래길",
  "place-npcs": "예: 시장에 상인 2명",
  "npc-motion": "예: 주민은 랜덤 배회",
  "make-items": "예: 화염 물약 2종",
};

export function skillTuiHint(skill: SkillDef): string {
  const fixed = SKILL_TUI_HINTS[skill.id];
  if (fixed) return fixed;
  // 사용자 스킬: description 또는 placeholder 한 조각을 압축
  const fromParam = skill.params.find((p) => p.placeholder)?.placeholder?.replace(/^예:\s*/u, "");
  if (fromParam) return `예: ${fromParam.length > 36 ? `${fromParam.slice(0, 34)}…` : fromParam}`;
  const d = skill.description.trim();
  if (!d) return "";
  return d.length > 40 ? `${d.slice(0, 38)}…` : d;
}

function renderSkillListBody(skill: SkillDef): HTMLElement[] {
  return [
    el("span", { class: "ai-slash-item-mark", text: ">", attrs: { "aria-hidden": "true" } }),
    el("div", {
      class: "ai-slash-item-body",
      children: [el("span", { class: "ai-slash-item-name", text: skillCommandLine(skill) })],
    }),
  ];
}

// 슬래시 자동완성 목록 — 입력창 위에 뜬다.
export function slashSkillMatches(query: string): SkillDef[] {
  return filterSkills(query).slice(0, 8);
}

export function renderSlashList(query: string, onPick: (skill: SkillDef) => void, options: SlashListOptions = {}): HTMLElement {
  const matches = slashSkillMatches(query);
  const activeIndex = Math.max(0, Math.min(options.activeIndex ?? 0, Math.max(0, matches.length - 1)));
  const skillItems = matches.map((skill, index) =>
    el("button", {
      class: `ai-slash-item${index === activeIndex ? " is-active" : ""}`,
      attrs: {
        type: "button",
        title: [skill.name, skill.description, skillTuiHint(skill)].filter(Boolean).join(" — "),
        "aria-selected": String(index === activeIndex),
        "aria-label": skillCommandLine(skill),
      },
      dataset: { testid: `ai-slash-item-${skill.id}` },
      children: renderSkillListBody(skill),
      on: { click: () => onPick(skill) },
    })
  );
  const footer = options.onViewAll
    ? [el("button", {
        class: "ai-slash-item ai-slash-view-all",
        attrs: { type: "button", title: "스킬 전체 목록", "aria-label": "/skills" },
        dataset: { testid: "ai-slash-view-all" },
        children: [
          el("span", { class: "ai-slash-item-mark", text: ">", attrs: { "aria-hidden": "true" } }),
          el("div", {
            class: "ai-slash-item-body",
            children: [
              el("span", { class: "ai-slash-item-name", text: "/skills" }),
              el("span", { class: "ai-slash-item-hint", text: "# 예: 전체 스킬 목록" }),
            ],
          }),
        ],
        on: { click: options.onViewAll },
      })]
    : [];
  return el("div", {
    class: "ai-slash-list",
    dataset: { testid: "ai-slash-list" },
    attrs: { role: "listbox", "aria-label": "스킬 검색" },
    children: matches.length > 0
      ? [...skillItems, ...footer]
      : [el("div", { class: "ai-slash-empty", text: "일치 없음" }), ...footer],
  });
}

// Ctrl+K 스킬 팔레트 — 검색 + 첫 항목 Enter 실행. 마우스 없이 스킬을 부른다.
export function openSkillPalette(onRun: (skill: SkillDef) => void): HTMLElement {
  document.querySelector("[data-testid='ai-skill-palette']")?.remove();
  const listHost = el("div", { class: "ai-skill-palette-list" });
  const search = el("input", {
    class: "ai-skill-param-input",
    attrs: { type: "text", placeholder: "스킬 검색… (Enter=첫 항목 실행, Esc=닫기)" },
    dataset: { testid: "ai-skill-palette-search" },
  }) as HTMLInputElement;

  const backdrop = el("div", {
    class: "ai-skill-palette-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "ai-skill-palette" },
    children: [
      el("section", {
        class: "ai-skill-palette-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "스킬 팔레트" },
        children: [search, listHost],
      }),
    ],
  });
  const close = (): void => backdrop.remove();
  const pick = (skill: SkillDef): void => {
    close();
    onRun(skill);
  };
  const refresh = (): void => {
    listHost.replaceChildren(renderSlashList(search.value || "/", pick));
  };
  search.addEventListener("input", refresh);
  search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
    if (event.key === "Enter") {
      const first = filterSkills(search.value || "/")[0];
      if (first) pick(first);
    }
  });
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  refresh();
  document.body.append(backdrop);
  search.focus();
  return backdrop;
}

export interface SkillDrawerHandle {
  element: HTMLElement;
  toggle(): void;
  /** 스킬 실행(인자 있으면 폼, 없으면 즉시) — 슬래시 목록에서 호출. */
  run(skill: SkillDef): void;
  openSkill(skill: SkillDef): void;
  refresh(): void;
}

export function renderSkillDrawer(options: SkillDrawerOptions): SkillDrawerHandle {
  const body = el("div", { class: "ai-skill-drawer-body" });
  const element = el("div", { class: "ai-skill-drawer", dataset: { testid: "ai-skill-drawer" } });
  element.hidden = true;
  element.inert = element.hidden;
  element.append(body);

  const runSkill = (skill: SkillDef): void => {
    const ctx = options.getContext();
    if (skill.needsSelection && !ctx.selection) {
      toast("맵에서 선택 도구로 영역을 먼저 지정하세요.", "info");
      return;
    }
    if (skill.kind === "action") {
      recordSkillUse(skill.id);
      element.hidden = true;
      element.inert = element.hidden;
      options.onAction(skill.id);
      return;
    }
    if (skill.params.length > 0) {
      openSkill(skill);
      return;
    }
    const prompt = skill.buildPrompt?.({}, ctx) ?? "";
    if (!prompt.trim()) return;
    recordSkillUse(skill.id);
    element.hidden = true;
    element.inert = element.hidden;
    options.onRunPrompt(prompt, skillCommandLine(skill));
  };

  const openSkill = (skill: SkillDef): void => {
    element.hidden = false;
    element.inert = element.hidden;
    body.replaceChildren(
      renderSkillParamForm(
        skill,
        options.getContext(),
        (prompt, displayAs) => {
          recordSkillUse(skill.id);
          element.hidden = true;
          element.inert = element.hidden;
          options.onRunPrompt(prompt, displayAs);
        },
        () => renderCards()
      )
    );
  };

  const openSaveForm = (): void => {
    const nameInput = el("input", { class: "ai-skill-param-input", attrs: { type: "text", placeholder: "스킬 이름" }, dataset: { testid: "ai-user-skill-name" } }) as HTMLInputElement;
    const iconInput = el("input", { class: "ai-skill-param-input ai-skill-icon-input", attrs: { type: "text", placeholder: "⭐" }, value: "⭐", dataset: { testid: "ai-user-skill-icon" } }) as HTMLInputElement;
    const templateInput = el("textarea", {
      class: "ai-skill-param-input",
      attrs: { rows: "5", placeholder: "프롬프트 템플릿 — {{맵}}, {{맵id}}, {{영역}} + {{인자키}}(아래 파라미터) 사용 가능" },
      text: options.getSavePrefill(),
      dataset: { testid: "ai-user-skill-template" },
    }) as HTMLTextAreaElement;
    const needsSelectionInput = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "ai-user-skill-needs-selection" } }) as HTMLInputElement;
    // 파라미터 편집 행 — key/label/type(+enum 옵션). "파라미터 추가"로 행을 늘린다.
    type UserParamRow = { key: HTMLInputElement; label: HTMLInputElement; type: HTMLSelectElement; options: HTMLInputElement };
    const paramRows: UserParamRow[] = [];
    const paramList = el("div", { class: "ai-user-skill-params", dataset: { testid: "ai-user-skill-params" } });
    const addParamRow = (): void => {
      const index = paramRows.length;
      const keyInput = el("input", { class: "ai-skill-param-input", attrs: { type: "text", placeholder: "키(예: 재료)" }, dataset: { testid: `ai-user-skill-param-key-${index}` } }) as HTMLInputElement;
      const labelInput = el("input", { class: "ai-skill-param-input", attrs: { type: "text", placeholder: "라벨(비우면 키)" }, dataset: { testid: `ai-user-skill-param-label-${index}` } }) as HTMLInputElement;
      const typeSelect = el("select", { class: "ai-skill-param-input", dataset: { testid: `ai-user-skill-param-type-${index}` } }) as HTMLSelectElement;
      for (const type of ["text", "number", "enum"] as const) typeSelect.append(el("option", { text: type, value: type }) as HTMLOptionElement);
      typeSelect.value = "text";
      const optionsInput = el("input", { class: "ai-skill-param-input", attrs: { type: "text", placeholder: "enum 옵션(콤마 구분)" }, dataset: { testid: `ai-user-skill-param-options-${index}` } }) as HTMLInputElement;
      paramRows.push({ key: keyInput, label: labelInput, type: typeSelect, options: optionsInput });
      paramList.append(el("div", { class: "ai-skill-param-row", children: [keyInput, labelInput, typeSelect, optionsInput] }));
    };
    const collectParams = (): SkillParam[] => {
      const params: SkillParam[] = [];
      for (const row of paramRows) {
        const key = row.key.value.trim();
        if (!key) continue;
        const type = (["text", "number", "enum"] as const).includes(row.type.value as SkillParamType) ? (row.type.value as SkillParamType) : "text";
        const enumOptions = row.options.value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
          .map((value) => ({ value, label: value }));
        params.push({
          key,
          label: row.label.value.trim() || key,
          type,
          ...(type === "enum" && enumOptions.length > 0 ? { options: enumOptions } : {}),
        });
      }
      return params;
    };
    body.replaceChildren(
      el("div", {
        class: "ai-skill-param-form",
        children: [
          el("div", { class: "ai-skill-param-title", text: "💾 내 스킬로 저장" }),
          el("label", { class: "ai-skill-param-row", children: [el("span", { class: "ai-skill-param-label", text: "이름" }), nameInput] }),
          el("label", { class: "ai-skill-param-row", children: [el("span", { class: "ai-skill-param-label", text: "아이콘" }), iconInput] }),
          templateInput,
          paramList,
          el("div", {
            class: "ai-skill-param-actions",
            children: [
              el("button", {
                class: "ai-assistant-action",
                text: "+ 파라미터 추가",
                attrs: { type: "button", title: "템플릿에서 {{키}}로 치환되는 인자 폼을 추가" },
                dataset: { testid: "ai-user-skill-param-add" },
                on: { click: addParamRow },
              }),
            ],
          }),
          el("label", {
            class: "ai-skill-param-row",
            children: [needsSelectionInput, el("span", { class: "ai-skill-param-label", text: "선택 영역 필수" })],
          }),
          el("div", { class: "ai-skill-param-note", text: "저장하면 슬래시(/)와 이 서랍에서 언제든 다시 실행할 수 있습니다." }),
          el("div", {
            class: "ai-skill-param-actions",
            children: [
              el("button", {
                class: "ai-assistant-action ai-proposal-accept",
                text: "저장",
                attrs: { type: "button" },
                dataset: { testid: "ai-user-skill-save" },
                on: {
                  click: () => {
                    const name = nameInput.value.trim();
                    const template = templateInput.value.trim();
                    if (!name || !template) {
                      toast("이름과 프롬프트 템플릿을 채워주세요.", "info");
                      return;
                    }
                    const params = collectParams();
                    saveUserSkill({
                      name,
                      icon: iconInput.value.trim() || "⭐",
                      description: "사용자 정의 스킬",
                      template,
                      ...(params.length > 0 ? { params } : {}),
                      ...(needsSelectionInput.checked ? { needsSelection: true } : {}),
                    });
                    toast(`스킬 '${name}' 저장됨`, "ok");
                    renderCards();
                  },
                },
              }),
              el("button", { class: "ai-assistant-action", text: "뒤로", attrs: { type: "button" }, on: { click: () => renderCards() } }),
            ],
          }),
        ],
      })
    );
  };

  const skillCard = (skill: SkillDef): HTMLElement => {
    const hint = skillTuiHint(skill);
    const children: HTMLElement[] = [
      el("span", { class: "ai-skill-card-icon", text: ">", attrs: { "aria-hidden": "true" } }),
      el("div", {
        class: "ai-skill-card-body",
        children: [
          el("span", { class: "ai-skill-card-name", text: skillCommandLine(skill) }),
          ...(hint ? [el("span", { class: "ai-skill-card-hint", text: `# ${hint}` })] : []),
        ],
      }),
    ];
    const card = el("button", {
      class: `ai-skill-card${skill.source === "user" ? " is-user" : ""}`,
      attrs: { type: "button", title: `${skill.name} — ${skill.description}` },
      dataset: { testid: LEGACY_TESTIDS[skill.id] ?? `ai-skill-${skill.id}` },
      children,
      on: { click: () => runSkill(skill) },
    });
    if (skill.source === "user") {
      const remove = el("button", {
        class: "ai-skill-card-remove",
        text: "×",
        attrs: { type: "button", title: "스킬 삭제" },
        dataset: { testid: `ai-skill-remove-${skill.id}` },
        on: {
          click: (event) => {
            event.stopPropagation?.();
            deleteUserSkill(skill.id);
            renderCards();
          },
        },
      });
      return el("div", { class: "ai-skill-card-wrap", children: [card, remove] });
    }
    return card;
  };

  const renderCards = (): void => {
    const skills = listAllSkills();
    const system = skills.filter((skill) => skill.source === "system");
    const user = skills.filter((skill) => skill.source === "user");
    body.replaceChildren(
      el("div", { class: "ai-skill-drawer-title", text: "스킬 — 입력창에 /를 쳐도 찾을 수 있습니다" }),
      el("div", { class: "ai-skill-grid", dataset: { testid: "ai-skill-grid" }, children: system.map(skillCard) }),
      ...(user.length > 0
        ? [
            el("div", { class: "ai-skill-drawer-title", text: "내 스킬" }),
            el("div", { class: "ai-skill-grid", children: user.map(skillCard) }),
          ]
        : []),
      el("div", {
        class: "ai-skill-drawer-utils",
        children: [
          el("button", {
            class: "ai-assistant-action",
            text: "💾 내 스킬로 저장",
            attrs: { type: "button", title: "마지막 요청을 재사용 가능한 스킬로 저장" },
            dataset: { testid: "ai-user-skill-open" },
            on: { click: openSaveForm },
          }),
        ],
      })
    );
  };

  renderCards();
  return {
    element,
    toggle: () => {
      element.hidden = !element.hidden;
      element.inert = element.hidden;
      if (!element.hidden) renderCards();
    },
    run: runSkill,
    openSkill,
    refresh: renderCards,
  };
}
