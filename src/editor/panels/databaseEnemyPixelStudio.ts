// 자료집 → 적 「도트 몬스터 공방」: 몸 원형·무기·색·칸 크기·접근 방식을 골라 retro2003 9칸 전투 시트를 만들고,
// 같은 무대(databaseEnemyPixelPreview)에서 대기·공격·스킬·피격·쓰러짐을 돌려 본 뒤 한 번에 이 적에 붙인다.
// 합성은 src/editor/monsterPixelStudio.ts, 저장 계약은 AI 도구 author_enemy_pixel_sheet 와 같은 writeAuthoredMonsterAssets 다.
import type { PixelEnemySheet } from "@/assets/pixelEnemySheets";
import { RETRO_MONSTER_SKILLSETS } from "@/assets/retroMonsterSkills";
import {
  ARCHETYPE_DEFAULTS,
  generateMonsterPixelSheet,
  MONSTER_ARCHETYPE_LABELS,
  MONSTER_ARCHETYPES,
  MONSTER_MOTIONS,
  MONSTER_SHEET_CELLS,
  MONSTER_WEAPON_LABELS,
  MONSTER_WEAPONS,
  MonsterPixelRecipeError,
  type MonsterArchetype,
  type MonsterPixelRecipe,
  type MonsterPixelSheet,
} from "@/editor/monsterPixelStudio";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { currentEnemy } from "@/editor/panels/databaseEnemyRecordSupport";
import { renderEnemyPixelPreview, type EnemyPixelPreview } from "@/editor/panels/databaseEnemyPixelPreview";
import {
  ARCHETYPE_SKILL_SLUGS,
  authoredMonsterResourceId,
  ensureSlugSkills,
  isAuthoredMonsterAsset,
  writeAuthoredMonsterAssets,
} from "@/editor/tools/enemyPixelSheetTools";
import { store } from "@/project/store";
import type { EnemyRecord } from "@/project/types";
import { el } from "@/util/dom";

const MOTION_LABELS: Readonly<Record<string, string>> = {
  hop: "hop · 통통 박치기", swoop: "swoop · 급강하", stomp: "stomp · 내려찍기", dash: "dash · 달려들기",
  float: "float · 스르르", shoot: "shoot · 제자리 사격", breath: "breath · 숨결",
};

/** 원형을 고를 때 채우는 기본 색(주·보조·강조). */
const ARCHETYPE_COLORS: Readonly<Record<MonsterArchetype, readonly [string, string, string]>> = {
  beast: ["#5b3f8f", "#d9c6f2", "#c77dff"],
  "humanoid-knight": ["#3c3f58", "#9aa3b8", "#ff5030"],
  "winged-fiend": ["#8a2a3a", "#e0b080", "#ffcc33"],
  "slime-ooze": ["#3aa860", "#a8f0b0", "#ffffff"],
  "golem-construct": ["#b08a4a", "#7a6a5a", "#ffd040"],
  "plant-hydra": ["#3f7a30", "#d05070", "#ffe060"],
  "dragon-boss": ["#a03020", "#e0c070", "#ff9020"],
  "caster-wraith": ["#403060", "#b0a0d0", "#60e0ff"],
};

type StudioForm = {
  archetype: HTMLSelectElement;
  weapon: HTMLSelectElement;
  primary: HTMLInputElement;
  secondary: HTMLInputElement;
  accent: HTMLInputElement;
  cell: HTMLSelectElement;
  motion: HTMLSelectElement;
  skill: HTMLSelectElement;
  spikes: HTMLInputElement;
  horns: HTMLInputElement;
  actions: HTMLInputElement;
};

function option(value: string, label: string): HTMLOptionElement {
  return el("option", { text: label, attrs: { value } });
}

function field(label: string, control: HTMLElement): HTMLElement {
  return el("label", { class: "db-pixel-studio-field", children: [el("span", { text: label }), control] });
}

function check(label: string, input: HTMLInputElement): HTMLElement {
  return el("label", { class: "db-pixel-studio-check", children: [input, el("span", { text: label })] });
}

function readRecipe(form: StudioForm, name: string): MonsterPixelRecipe {
  return {
    name,
    archetype: form.archetype.value as MonsterArchetype,
    weapon: form.weapon.value as MonsterPixelRecipe["weapon"],
    primaryColor: form.primary.value,
    secondaryColor: form.secondary.value,
    accentColor: form.accent.value,
    cell: Number(form.cell.value) as MonsterPixelRecipe["cell"],
    motion: form.motion.value as MonsterPixelRecipe["motion"],
    spikes: form.spikes.checked,
    horns: form.horns.checked,
  };
}

function draftSheet(sheet: MonsterPixelSheet, skillSlug: string): PixelEnemySheet {
  return {
    resourceId: "draft-pixel-monster",
    path: "uploaded/draft-pixel-monster.png",
    url: sheet.sheetDataUrl,
    motion: sheet.motion,
    idleFrameMs: sheet.idleFrameMs,
    cell: sheet.cell,
    skillCell: true,
    skillSlug,
    projectAuthored: true,
  };
}

type StudioDraft = { sheet: MonsterPixelSheet; recipe: MonsterPixelRecipe; skillSlug: string };
type StudioSession = {
  open: boolean;
  form?: { recipe: MonsterPixelRecipe; skillSlug: string; actions: boolean };
  draft?: StudioDraft;
  applied?: string;
};
/**
 * 자료집 본문은 store 가 바뀔 때마다(이름 커밋·AI 도구·적용 자체) 탭을 통째로 다시 그린다.
 * 공방의 열림·입력값·아직 적용하지 않은 초안을 적 id 별로 여기 두어, 다시 그려도 접히거나 초안이 사라지지 않게 한다.
 */
const sessions = new Map<string, StudioSession>();

/** 공방 패널. 적용하면 루트에 change 를 쏘아 스튜디오가 도트 미리보기 카드를 새로 그리게 한다. */
export function renderEnemyPixelStudio(record: EnemyRecord): HTMLElement {
  const toggle = el("button", {
    class: "db-ws-btn db-pixel-studio-toggle",
    text: "+ 9칸 도트 시트 생성·편집",
    attrs: { type: "button", "aria-expanded": "false" },
    dataset: { testid: "db-enemy-pixel-studio-toggle" },
  });
  const body = el("div", { class: "db-pixel-studio-body", dataset: { testid: "db-enemy-pixel-studio" } });
  body.hidden = true;
  const root = el("section", {
    class: "db-pixel-studio",
    attrs: { "aria-label": "도트 몬스터 공방" },
    children: [toggle, body],
  });

  const session = sessions.get(record.id) ?? { open: false };
  sessions.set(record.id, session);
  let built = false;
  const setOpen = (open: boolean): void => {
    if (open && !built) { build(); built = true; }
    body.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    session.open = open;
  };
  toggle.addEventListener("click", () => setOpen(!session.open));

  function build(): void {
    const live = currentEnemy(record);
    const project = store.getCurrent();
    const authoredId = live.monsterResourceId && isAuthoredMonsterAsset(project, live.monsterResourceId) ? live.monsterResourceId : undefined;
    const saved = authoredId ? project.assets.uploaded[authoredId]!.meta.pixelEnemySheet : undefined;
    const prior = (saved?.recipe ?? {}) as Partial<MonsterPixelRecipe>;

    const form: StudioForm = {
      archetype: el("select", { dataset: { testid: "db-pixel-studio-archetype" }, children: MONSTER_ARCHETYPES.map((id) => option(id, MONSTER_ARCHETYPE_LABELS[id])) }),
      weapon: el("select", { dataset: { testid: "db-pixel-studio-weapon" }, children: MONSTER_WEAPONS.map((id) => option(id, MONSTER_WEAPON_LABELS[id])) }),
      primary: el("input", { attrs: { type: "color", "aria-label": "주색" }, dataset: { testid: "db-pixel-studio-primary" } }),
      secondary: el("input", { attrs: { type: "color", "aria-label": "보조색" }, dataset: { testid: "db-pixel-studio-secondary" } }),
      accent: el("input", { attrs: { type: "color", "aria-label": "강조색" }, dataset: { testid: "db-pixel-studio-accent" } }),
      cell: el("select", { dataset: { testid: "db-pixel-studio-cell" }, children: MONSTER_SHEET_CELLS.map((size) => option(String(size), `${size}px`)) }),
      motion: el("select", { dataset: { testid: "db-pixel-studio-motion" }, children: MONSTER_MOTIONS.map((id) => option(id, MOTION_LABELS[id] ?? id)) }),
      skill: el("select", { dataset: { testid: "db-pixel-studio-skill" }, children: Object.keys(RETRO_MONSTER_SKILLSETS).map((slug) => option(slug, slug)) }),
      spikes: el("input", { attrs: { type: "checkbox" }, dataset: { testid: "db-pixel-studio-spikes" } }),
      horns: el("input", { attrs: { type: "checkbox" }, dataset: { testid: "db-pixel-studio-horns" } }),
      actions: el("input", { attrs: { type: "checkbox" }, dataset: { testid: "db-pixel-studio-actions" } }),
    };
    const applyArchetypeDefaults = (archetype: MonsterArchetype): void => {
      const defaults = ARCHETYPE_DEFAULTS[archetype];
      const [p, s, a] = ARCHETYPE_COLORS[archetype];
      form.weapon.value = defaults.weapon;
      form.cell.value = String(defaults.cell);
      form.motion.value = defaults.motion;
      form.skill.value = ARCHETYPE_SKILL_SLUGS[archetype];
      form.primary.value = p;
      form.secondary.value = s;
      form.accent.value = a;
      form.spikes.checked = archetype === "beast" || archetype === "golem-construct";
      form.horns.checked = archetype === "winged-fiend" || archetype === "dragon-boss";
    };
    const kept = session.form;
    const initial = kept?.recipe.archetype ?? (prior.archetype && MONSTER_ARCHETYPES.includes(prior.archetype) ? prior.archetype : "beast");
    form.archetype.value = initial;
    applyArchetypeDefaults(initial);
    if (prior.weapon) form.weapon.value = prior.weapon;
    if (prior.cell) form.cell.value = String(prior.cell);
    if (prior.motion) form.motion.value = prior.motion;
    if (prior.primaryColor) form.primary.value = prior.primaryColor;
    if (prior.secondaryColor) form.secondary.value = prior.secondaryColor;
    if (prior.accentColor) form.accent.value = prior.accentColor;
    if (prior.spikes !== undefined) form.spikes.checked = prior.spikes;
    if (prior.horns !== undefined) form.horns.checked = prior.horns;
    if (saved?.skillSlug) form.skill.value = saved.skillSlug;
    // 행동이 기본 공격 하나뿐인 적만 스킬 행동을 기본으로 붙인다 — 손으로 짠 행동표는 건드리지 않는다.
    form.actions.checked = live.actions.length <= 1;
    if (kept) {
      const { recipe } = kept;
      form.weapon.value = recipe.weapon ?? form.weapon.value;
      form.cell.value = String(recipe.cell);
      form.motion.value = recipe.motion ?? form.motion.value;
      form.primary.value = recipe.primaryColor ?? form.primary.value;
      form.secondary.value = recipe.secondaryColor ?? form.secondary.value;
      form.accent.value = recipe.accentColor ?? form.accent.value;
      form.spikes.checked = recipe.spikes === true;
      form.horns.checked = recipe.horns === true;
      form.skill.value = kept.skillSlug;
      form.actions.checked = kept.actions;
    }
    form.archetype.addEventListener("change", () => applyArchetypeDefaults(form.archetype.value as MonsterArchetype));
    const remember = (): void => {
      session.form = { recipe: readRecipe(form, ""), skillSlug: form.skill.value, actions: form.actions.checked };
    };

    const status = el("p", { class: "db-pixel-studio-status", attrs: { "aria-live": "polite" }, dataset: { testid: "db-pixel-studio-status" }, text: "원형과 색을 고르고 「9칸 도트 시트 생성」을 누르세요." });
    if (session.applied) {
      status.textContent = `적용됨 — ${session.applied} (위 도트 미리보기·실제 전투가 이 시트를 씁니다)`;
      status.dataset.applied = session.applied;
    }
    const strip = el("div", { class: "db-pixel-studio-strip", dataset: { testid: "db-pixel-studio-strip" } });
    const stageSlot = el("div", { class: "db-pixel-studio-stage", dataset: { testid: "db-pixel-studio-draft" } });
    const generate = el("button", { class: "db-ws-btn db-ws-btn-primary", text: "9칸 도트 시트 생성", attrs: { type: "button" }, dataset: { testid: "db-pixel-studio-generate" } });
    const apply = el("button", { class: "db-ws-btn db-ws-btn-primary", text: "이 적에 적용", attrs: { type: "button", disabled: "" }, dataset: { testid: "db-pixel-studio-apply" } });

    let draft: StudioDraft | undefined;
    let preview: EnemyPixelPreview | null = null;

    const showDraft = (next: StudioDraft): void => {
      draft = next;
      const { sheet } = next;
      const image = el("img", { attrs: { src: sheet.sheetDataUrl, alt: `${sheet.name} 9칸 시트`, width: String(sheet.cell * 3), height: String(sheet.cell * 3) } });
      image.style.width = `${Math.min(288, sheet.cell * 3 * 2)}px`;
      strip.replaceChildren(image);
      preview?.stop();
      preview = renderEnemyPixelPreview({ name: sheet.name }, draftSheet(sheet, next.skillSlug));
      stageSlot.replaceChildren(...(preview ? [preview.element] : []));
      status.textContent = `${sheet.cell}px · ${sheet.colors}색 · 가장 비슷한 두 칸도 ${sheet.minPairDiff.pixels}px 다름`
        + (sheet.errors.length ? ` · 경고 ${sheet.errors.join(" / ")}` : " · 계약 검사 통과");
      delete status.dataset.applied;
      apply.disabled = false;
    };

    generate.addEventListener("click", () => {
      const enemy = currentEnemy(record);
      const recipe = readRecipe(form, enemy.name || "도트 몬스터");
      let sheet: MonsterPixelSheet;
      try {
        sheet = generateMonsterPixelSheet(recipe);
      } catch (error) {
        status.textContent = error instanceof MonsterPixelRecipeError ? error.message : String(error);
        apply.disabled = true;
        return;
      }
      remember();
      session.draft = { sheet, recipe, skillSlug: form.skill.value };
      session.applied = undefined;
      showDraft(session.draft);
    });

    apply.addEventListener("click", () => {
      if (!draft) return;
      const { sheet, recipe, skillSlug } = draft;
      const enemy = currentEnemy(record);
      const latest = store.getCurrent();
      const resourceId = enemy.monsterResourceId && isAuthoredMonsterAsset(latest, enemy.monsterResourceId)
        ? enemy.monsterResourceId
        : authoredMonsterResourceId(enemy.id, sheet.name);
      const withActions = form.actions.checked;
      try {
        recordProjectSnapshot(`도트 몬스터 공방: ${sheet.name}`);
        store.update((project) => {
          writeAuthoredMonsterAssets(project, resourceId, sheet, { recipe, skillSlug, generatedBy: "monster-pixel-studio:editor" });
          const target = project.database.enemies.find((entry) => entry.id === enemy.id);
          if (!target) return;
          target.monsterResourceId = resourceId;
          if (withActions) {
            const actions = ensureSlugSkills(project, skillSlug);
            if (actions?.length) {
              target.actions = actions;
              target.skillIds = [...new Set(actions.map((action) => action.skillId))];
            }
          }
        }, { scope: "database", collection: "enemies" });
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : String(error);
        return;
      }
      preview?.stop();
      preview = null;
      stageSlot.replaceChildren();
      apply.disabled = true;
      draft = undefined;
      session.draft = undefined;
      session.applied = resourceId;
      status.textContent = `적용됨 — ${resourceId} (위 도트 미리보기·실제 전투가 이 시트를 씁니다)`;
      status.dataset.applied = resourceId;
      root.dispatchEvent(new Event("change", { bubbles: true }));
    });

    body.replaceChildren(
      el("div", { class: "db-enemy-stage-heading", children: [el("span", { text: "도트 몬스터 공방" }), el("span", { class: "db-enemy-stage-status", text: "retro2003 9칸 시트" })] }),
      el("div", {
        class: "db-pixel-studio-form",
        on: { change: remember, input: remember },
        children: [
          field("몸 원형", form.archetype),
          field("무기·부위", form.weapon),
          field("칸 크기", form.cell),
          field("접근 방식", form.motion),
          field("스킬 묶음", form.skill),
          el("div", { class: "db-pixel-studio-colors", children: [field("주색", form.primary), field("보조색", form.secondary), field("강조색", form.accent)] }),
          el("div", { class: "db-pixel-studio-checks", children: [check("가시", form.spikes), check("뿔", form.horns), check("몬스터 스킬 행동 붙이기", form.actions)] }),
        ],
      }),
      el("div", { class: "db-pixel-studio-buttons", children: [generate, apply] }),
      status,
      strip,
      stageSlot,
    );
    if (session.draft) showDraft(session.draft);
  }

  if (session.open) setOpen(true);
  return root;
}
