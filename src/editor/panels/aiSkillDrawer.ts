// editor/panels/aiSkillDrawer.ts
// 스킬 서랍 + 인자 폼 + 슬래시 목록 — AI 패널의 "의식적으로 쓰는 스킬" UI.
// 서랍은 항상 DOM에 존재하고(hidden 토글) 카드를 누르면 인자 폼 → 킥오프 프롬프트 전송.
import {
  deleteUserSkill,
  filterSkills,
  listAllSkills,
  recordSkillUse,
  saveUserSkill,
  type SkillDef,
  type SkillParam,
  type SkillRunContext,
} from "@/ai/skills";
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

export function renderSkillParamForm(
  skill: SkillDef,
  ctx: SkillRunContext,
  onSubmit: (prompt: string, displayAs: string) => void,
  onCancel: () => void
): HTMLElement {
  const inputs = new Map<string, HTMLInputElement | HTMLSelectElement>();
  const rows = skill.params.map((param) => {
    const control = paramControl(param);
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
    onSubmit(prompt, skill.displayAs?.(args) ?? `${skill.icon} ${skill.name}`);
  };
  return el("div", {
    class: "ai-skill-param-form",
    dataset: { testid: "ai-skill-param-form" },
    children: [
      el("div", { class: "ai-skill-param-title", text: `${skill.icon} ${skill.name}` }),
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

function paramControl(param: SkillParam): HTMLInputElement | HTMLSelectElement {
  if (param.type === "enum") {
    const select = el("select", { class: "ai-skill-param-input" }) as HTMLSelectElement;
    for (const option of param.options ?? []) {
      const optionEl = el("option", { text: option.label, value: option.value }) as HTMLOptionElement;
      select.append(optionEl);
    }
    select.value = String(param.defaultValue ?? param.options?.[0]?.value ?? "");
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
    value: param.defaultValue !== undefined ? String(param.defaultValue) : "",
  }) as HTMLInputElement;
  input.dataset.testid = `skill-param-${param.key}`;
  return input;
}

// 슬래시 자동완성 목록 — 입력창 위에 뜬다.
export function renderSlashList(query: string, onPick: (skill: SkillDef) => void): HTMLElement {
  const matches = filterSkills(query).slice(0, 8);
  return el("div", {
    class: "ai-slash-list",
    dataset: { testid: "ai-slash-list" },
    children: matches.length > 0
      ? matches.map((skill) =>
          el("button", {
            class: "ai-slash-item",
            attrs: { type: "button", title: skill.description },
            dataset: { testid: `ai-slash-item-${skill.id}` },
            children: [
              el("span", { class: "ai-slash-item-name", text: `${skill.icon} ${skill.name}` }),
              el("span", { class: "ai-slash-item-desc", text: skill.description }),
            ],
            on: { click: () => onPick(skill) },
          })
        )
      : [el("div", { class: "ai-slash-empty", text: "일치하는 스킬이 없습니다" })],
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
    class: "database-modal-backdrop ai-skill-palette-backdrop",
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
    options.onRunPrompt(prompt, skill.displayAs?.({}) ?? `${skill.icon} ${skill.name}`);
  };

  const openSkill = (skill: SkillDef): void => {
    element.hidden = false;
    body.replaceChildren(
      renderSkillParamForm(
        skill,
        options.getContext(),
        (prompt, displayAs) => {
          recordSkillUse(skill.id);
          element.hidden = true;
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
      attrs: { rows: "5", placeholder: "프롬프트 템플릿 — {{맵}}, {{맵id}}, {{영역}} 플레이스홀더 사용 가능" },
      text: options.getSavePrefill(),
      dataset: { testid: "ai-user-skill-template" },
    }) as HTMLTextAreaElement;
    body.replaceChildren(
      el("div", {
        class: "ai-skill-param-form",
        children: [
          el("div", { class: "ai-skill-param-title", text: "💾 내 스킬로 저장" }),
          el("label", { class: "ai-skill-param-row", children: [el("span", { class: "ai-skill-param-label", text: "이름" }), nameInput] }),
          el("label", { class: "ai-skill-param-row", children: [el("span", { class: "ai-skill-param-label", text: "아이콘" }), iconInput] }),
          templateInput,
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
                    saveUserSkill({ name, icon: iconInput.value.trim() || "⭐", description: "사용자 정의 스킬", template });
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
    const children: HTMLElement[] = [
      el("span", { class: "ai-skill-card-icon", text: skill.icon }),
      el("span", { class: "ai-skill-card-name", text: skill.name }),
      el("span", { class: "ai-skill-card-desc", text: skill.description }),
    ];
    const card = el("button", {
      class: `ai-skill-card${skill.source === "user" ? " is-user" : ""}`,
      attrs: { type: "button", title: skill.description },
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
      if (!element.hidden) renderCards();
    },
    run: runSkill,
    openSkill,
    refresh: renderCards,
  };
}
