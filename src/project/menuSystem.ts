// project/menuSystem.ts
// 「메뉴·시스템」 저작의 공용 규칙 — ESC 메뉴(oprnFieldMenu)·대사창 읽기 보조(oprnDialogueSystem)·갤러리/엔딩/저장 카드(oprnVnExtras)를
// 한 화면에서 만지는 자료집 칸과 조수 도구(configure_field_menu·set_dialogue_system·set_vn_extras)가 **같은 검증·같은 연동 규칙**을 쓰게 하는 잎 모듈(2026-10-17, 미연시 3단계).
// 화면도 도구도 여기의 validate*/merge*/sync*/issues 를 거친다 — 규칙을 두 곳에 베끼지 않는다.
import { backlogEnabled, mergeDialogueSystem, resolveDialogueSystem, validateDialogueSystem, type AuthoredDialogueSystem } from "./dialogueSystem";
import { FIELD_MENU_COMMANDS, collectorFieldMenu, fieldMenu, romanceFieldMenu, validateFieldMenu, type AuthoredFieldMenu, type FieldMenuCommand } from "./fieldMenu";
import { galleryActive, listGallerySlots, mergeVnExtras, resolveVnExtras, validateVnExtras, type AuthoredVnExtras } from "./vnExtras";
import { validateVnLook, type AuthoredVnLook } from "./vnLook";
import type { Project } from "./types";

/** 메뉴 항목을 새로 넣을 때 쓰는 기본 이름(12자 이하). 플레이어 기본 이름과 같은 말을 쓴다. */
export const FIELD_MENU_DEFAULT_LABELS: Readonly<Record<FieldMenuCommand, string>> = {
  items: "소지품", skills: "스킬", equipment: "장비", monsters: "동료", save: "저장", load: "불러오기", status: "상태", row: "열 바꾸기",
  formation: "진형", "monster-dex": "도감", "region-map": "지도", "campaign-progress": "배지·목표", "trainer-card": "원정 수첩",
  "battle-reports": "전투 기록", quests: "일정", journal: "일지", relationships: "호감도", gallery: "갤러리", endings: "엔딩", "life-ledger": "생활 장부",
  backlog: "백로그", options: "설정", wait: "전투 대기", "to-title": "타이틀로",
};

/** 화면에서 항목을 고를 때 보이는 한 줄 설명. */
export const FIELD_MENU_COMMAND_HELP: Readonly<Record<FieldMenuCommand, string>> = {
  items: "가진 물건을 보고 씁니다.", skills: "주인공의 스킬을 봅니다.", equipment: "장비를 갈아입힙니다.", monsters: "함께 다니는 몬스터를 봅니다.",
  save: "진행을 저장 칸에 저장합니다.", load: "저장한 진행을 불러옵니다.", status: "능력치와 상태를 봅니다.", row: "전열·후열을 바꿉니다.",
  formation: "파티 진형을 바꿉니다.", "monster-dex": "만난 몬스터 도감.", "region-map": "지역 지도.", "campaign-progress": "배지와 진행 목표.",
  "trainer-card": "주인공 원정 수첩.", "battle-reports": "최근 전투 기록.", quests: "받은 임무·일정.", journal: "이야기 일지(이벤트가 한 줄씩 적는다).", relationships: "인물과의 호감도.",
  gallery: "본 그림(CG)을 다시 봅니다.", endings: "엔딩 목록과 달성 체크리스트.", "life-ledger": "출하·수집·박물관 기록.",
  backlog: "지난 대사를 다시 읽습니다.", options: "음량·대사 속도 등 기기 설정.", wait: "전투 중 시간 정지 설정.", "to-title": "타이틀 화면으로 돌아갑니다(항상 맨 끝).",
};

export type MenuSystemIssue = {
  readonly id: string;
  /** 화면(사람)에 보이는 문장 — 도구 이름이 없다. */
  readonly ui: string;
  /** 조수 review_game_systems 가 보는 문장 — 고치는 도구 호출 예가 들어 있다. */
  readonly tool: string;
};

/** 메뉴 항목과 기능 설정이 어긋난 곳(조용히 안 보이는 항목·열 수 없는 기능). 화면과 조수가 같은 목록을 본다. */
export function menuSystemIssues(project: Project): readonly MenuSystemIssue[] {
  const out: MenuSystemIssue[] = [];
  const menu = fieldMenu(project);
  const entries = menu?.entries;
  const has = (command: FieldMenuCommand): boolean => entries?.some((entry) => entry.command === command) === true;
  const vn = resolveVnExtras(project);
  const backlog = backlogEnabled(project);
  if (has("backlog") && !backlog) out.push({ id: "backlog-entry-off", ui: "ESC 메뉴에 백로그 항목이 있지만 대사창의 백로그가 꺼져 있어 항목이 보이지 않습니다. 아래 「대사창」에서 백로그를 켜거나 메뉴에서 빼세요.", tool: "ESC 메뉴에 백로그 항목이 있지만 대사 시스템의 백로그가 꺼져 있어 항목이 보이지 않습니다. set_dialogue_system {backlog:true} 로 켜거나 메뉴에서 빼세요." });
  if (backlog && menu && !has("backlog")) out.push({ id: "backlog-on-no-entry", ui: "백로그는 켜져 있지만 ESC 메뉴에 백로그 항목이 없습니다. 대사창 단추·L 키로는 열리지만 메뉴로는 못 엽니다. 메뉴에 「백로그」를 추가하세요.", tool: "대사 시스템의 백로그는 켜져 있지만 저작된 ESC 메뉴에 백로그 항목이 없습니다. 대사창 단추·L 키로는 열리지만 메뉴로는 못 엽니다. configure_field_menu {preset:\"custom\", add:[{command:\"backlog\",label:\"백로그\"}]} 로 넣으세요." });
  if (has("gallery") && !galleryActive(project)) out.push({ id: "gallery-entry-off", ui: "ESC 메뉴에 갤러리 항목이 있지만 갤러리가 꺼져 있어 항목이 보이지 않습니다. 아래 「갤러리·엔딩·저장 카드」에서 갤러리를 켜거나 메뉴에서 빼세요.", tool: "ESC 메뉴에 갤러리 항목이 있지만 갤러리가 꺼져 있어 항목이 보이지 않습니다. set_vn_extras {gallery:true} 로 켜거나 메뉴에서 빼세요." });
  if (has("endings") && !vn?.endings.enabled) out.push({ id: "endings-entry-off", ui: "ESC 메뉴에 엔딩 항목이 있지만 엔딩 목록이 꺼져 있어 항목이 보이지 않습니다. 아래에서 엔딩 목록을 켜거나 메뉴에서 빼세요.", tool: "ESC 메뉴에 엔딩 항목이 있지만 엔딩 목록이 꺼져 있어 항목이 보이지 않습니다. set_vn_extras {endings:true} 로 켜거나 메뉴에서 빼세요." });
  if (entries && vn?.endings.enabled && !has("endings")) out.push({ id: "endings-on-no-entry", ui: "엔딩 목록은 켜져 있지만 ESC 메뉴에 엔딩 항목이 없어 열 수 없습니다. 메뉴에 「엔딩」을 추가하세요.", tool: "엔딩 목록은 켜져 있지만 저작된 ESC 메뉴에 엔딩 항목이 없어 열 수 없습니다. configure_field_menu {preset:\"custom\", add:[{command:\"endings\",label:\"엔딩\"}]} 로 넣으세요." });
  if (vn?.endings.enabled && (project.endings ?? []).length === 0) out.push({ id: "endings-none", ui: "엔딩 목록은 켜져 있지만 엔딩 정의가 없어 빈 목록만 보입니다. 엔딩을 먼저 만드세요.", tool: "엔딩 목록은 켜져 있지만 엔딩 정의가 없어 빈 목록만 보입니다. 엔딩을 먼저 저작하세요." });
  if (vn?.saveCards.enabled && !backlog) out.push({ id: "savecard-no-backlog", ui: "저장 카드는 켜져 있지만 대사창의 백로그가 꺼져 있어 저장 칸의 마지막 대사 한 줄이 비어 보입니다(날짜만 나옵니다). 백로그를 켜세요.", tool: "세이브 카드는 켜져 있지만 대사 백로그가 꺼져 있어 저장 칸에 마지막 대사 한 줄이 비어 보입니다(날짜만 나옵니다). set_dialogue_system {backlog:true} 로 켜세요." });
  // 옛 저작 메뉴(갤러리 항목 없음)에서는 갤러리를 열 수 없다 — 열 내용(CG 칸·본 엔딩 회상)이 있을 때만 짚는다(2026-10-17 리뷰 C1·조합 O).
  if (entries && vn?.gallery.enabled && !has("gallery") && (listGallerySlots(project).length > 0 || (project.endings ?? []).length > 0)) out.push({ id: "gallery-on-no-entry", ui: "갤러리는 켜져 있지만 ESC 메뉴에 갤러리 항목이 없어 열 수 없습니다. 메뉴에 「갤러리」를 추가하세요.", tool: "갤러리는 켜져 있지만 저작된 ESC 메뉴에 갤러리 항목이 없어 열 수 없습니다. configure_field_menu {preset:\"custom\", add:[{command:\"gallery\",label:\"갤러리\"}]} 로 넣으세요." });
  // 연애 기본 구성(저작 없음)은 CG 없이도 정상이다 — 갤러리 항목이 비면 스스로 숨는다. 작가가 갤러리를 직접 켠 경우에만 짚는다(리뷰 C1).
  if (project.meta.oprnVnExtras?.gallery.enabled && listGallerySlots(project).length === 0) out.push({ id: "gallery-no-cg", ui: "갤러리는 켜져 있지만 「갤러리에 기록」을 켠 그림 표시 명령이 없어 CG 칸이 비어 있습니다.", tool: "갤러리는 켜져 있지만 recordInGallery 로 기록되는 그림(showPicture)이 없어 CG 칸이 비어 있습니다." });
  return out;
}

/**
 * 메뉴에 백로그·갤러리·엔딩 항목이 들어갔는데 그 기능이 꺼져 있으면 같이 켠다(조용히 안 보이는 항목을 만들지 않는다).
 * project 를 직접 고치고, 무엇을 켰는지 문장 목록을 돌려준다.
 * 작가가 이미 저작해 둔 갤러리·엔딩 설정(`oprnVnExtras`)은 메뉴를 다시 적용한다는 이유로 조용히 뒤집지 않는다 — 꺼 둔 기능은 알리기만 한다(리뷰 C6).
 */
export function syncMenuFeatures(project: Project, menu: AuthoredFieldMenu | undefined): string[] {
  const notices: string[] = [];
  if (!menu) return notices;
  const has = (command: FieldMenuCommand): boolean => menu.entries.some((entry) => entry.command === command);
  if (has("backlog") && !backlogEnabled(project)) {
    project.meta.oprnDialogueSystem = mergeDialogueSystem(resolveDialogueSystem(project), { backlog: true });
    notices.push("메뉴에 백로그가 있어 대사 시스템의 백로그를 켰습니다");
  }
  if (has("gallery") || has("endings")) {
    const vn = resolveVnExtras(project);
    const wantGallery = has("gallery") && !galleryActive(project);
    const wantEndings = has("endings") && !vn?.endings.enabled;
    if (wantGallery || wantEndings) {
      const keepOff = project.meta.oprnVnExtras !== undefined;
      const enableGallery = wantGallery && !keepOff;
      const enableEndings = wantEndings && !keepOff;
      const keptNames = [wantGallery && !enableGallery ? "갤러리" : "", wantEndings && !enableEndings ? "엔딩" : ""].filter(Boolean).join("·");
      if (enableGallery || enableEndings) {
        project.meta.oprnVnExtras = mergeVnExtras(vn, { ...(enableGallery ? { gallery: true } : {}), ...(enableEndings ? { endings: true } : {}) });
        notices.push(`메뉴에 ${[enableGallery ? "갤러리" : "", enableEndings ? "엔딩" : ""].filter(Boolean).join("·")} 항목이 있어 해당 기능을 켰습니다`);
      }
      if (keptNames) notices.push(`메뉴에 ${keptNames} 항목이 있지만 저작에서 꺼 둔 상태라 그대로 두었습니다(항목은 안 보임)`);
    }
  }
  return notices;
}

/** 메뉴 저작 반영: 검증 → 저장(없으면 삭제=기본 메뉴) → 연동 켜기. 검증 실패는 던진다(프로젝트는 손대지 않는다). */
export function applyFieldMenuAuthoring(project: Project, menu: AuthoredFieldMenu | undefined): string[] {
  if (menu) validateFieldMenu(menu);
  if (menu) project.meta.oprnFieldMenu = menu;
  else delete project.meta.oprnFieldMenu;
  return syncMenuFeatures(project, menu);
}

/** 대사창 저작 반영: 검증 후 저장. undefined 면 저작을 지워 자동 판정으로 돌린다. */
export function applyDialogueSystemAuthoring(project: Project, next: AuthoredDialogueSystem | undefined): void {
  if (next) validateDialogueSystem(next);
  if (next) project.meta.oprnDialogueSystem = next;
  else delete project.meta.oprnDialogueSystem;
}

/** 갤러리·엔딩·저장 카드 저작 반영. */
export function applyVnExtrasAuthoring(project: Project, next: AuthoredVnExtras | undefined): void {
  if (next) validateVnExtras(next);
  if (next) project.meta.oprnVnExtras = next;
  else delete project.meta.oprnVnExtras;
}

/** 메뉴 항목 하나를 넣는다 — 저장·불러오기·타이틀 앞(없으면 끝), to-title 은 늘 맨 끝. 이미 있으면 그대로. */
export function menuWithEntry(menu: AuthoredFieldMenu, command: FieldMenuCommand, label = FIELD_MENU_DEFAULT_LABELS[command]): AuthoredFieldMenu {
  if (menu.entries.some((entry) => entry.command === command)) return menu;
  const entries = menu.entries.map((entry) => ({ ...entry }));
  if (command === "to-title") entries.push({ command, label });
  else {
    const at = entries.findIndex((entry) => entry.command === "save" || entry.command === "to-title");
    entries.splice(at < 0 ? entries.length : at, 0, { command, label });
  }
  return { version: 1, entries };
}

/** 항목을 위(-1)·아래(+1)로 옮긴다. 타이틀 항목은 움직이지 않고, 다른 항목도 그 뒤로 못 간다. */
export function menuWithMove(menu: AuthoredFieldMenu, command: FieldMenuCommand, delta: -1 | 1): AuthoredFieldMenu {
  const entries = menu.entries.map((entry) => ({ ...entry }));
  const from = entries.findIndex((entry) => entry.command === command);
  if (from < 0 || command === "to-title") return menu;
  const to = from + delta;
  if (to < 0 || to >= entries.length) return menu;
  if (entries[to]!.command === "to-title") return menu;
  [entries[from], entries[to]] = [entries[to]!, entries[from]!];
  return { version: 1, entries };
}

export function menuWithoutEntry(menu: AuthoredFieldMenu, command: FieldMenuCommand): AuthoredFieldMenu {
  return { version: 1, entries: menu.entries.filter((entry) => entry.command !== command).map((entry) => ({ ...entry })) };
}

export function menuWithLabel(menu: AuthoredFieldMenu, command: FieldMenuCommand, label: string): AuthoredFieldMenu {
  return { version: 1, entries: menu.entries.map((entry) => (entry.command === command ? { command, label } : { ...entry })) };
}

/** 아직 메뉴에 없는 항목(추가 후보). */
export function menuAddableCommands(menu: AuthoredFieldMenu): readonly FieldMenuCommand[] {
  const used = new Set(menu.entries.map((entry) => entry.command));
  return FIELD_MENU_COMMANDS.filter((command) => !used.has(command));
}

/** 메뉴를 처음 저작하면(또는 지우면) 창 모양을 같이 맞춘다 — 저작 메뉴는 평탄 목록(field-list), 기본 메뉴는 옛 pixel. 이미 저작한 메뉴를 고칠 때는 건드리지 않는다. */
export function syncMenuUiStyle(project: Project, authored: boolean, style?: Project["system"]["menuUiStyle"]): void {
  project.system.menuUiStyle = style ?? (authored ? "field-list" : "pixel");
  if (project.system.fieldHud) project.system.fieldHud.menuStyle = project.system.menuUiStyle === "field-list" ? "field-list" : "project";
}

/** 새로 직접 꾸미기를 시작할 때의 출발 메뉴(일반 게임용) — 저장 앞에 설정, 타이틀로는 맨 끝. */
export function starterFieldMenu(): AuthoredFieldMenu {
  return { version: 1, entries: (["items", "skills", "equipment", "status", "save", "load", "options", "to-title"] as const).map((command) => ({ command, label: FIELD_MENU_DEFAULT_LABELS[command] })) };
}

export const MENU_STARTERS = { romance: romanceFieldMenu, collector: collectorFieldMenu, custom: starterFieldMenu } as const;
export type MenuStarter = keyof typeof MENU_STARTERS;

/** 한 번의 편집이 세 저작 칸을 함께 바꿀 수 있다. 값이 null 이면 그 칸의 저작을 지운다(자동 판정으로 복귀). 없으면 그대로. */
export type MenuSystemEdit = {
  readonly menu?: AuthoredFieldMenu | null;
  readonly dialogue?: AuthoredDialogueSystem | null;
  readonly vn?: AuthoredVnExtras | null;
  /** 대사창 룩(스킨) — `meta.oprnVnLook`. 지우면 연애 게임은 소재별 기본 룩, 그 밖은 옛 대사창. */
  readonly look?: AuthoredVnLook | null;
};

/** 프로젝트를 건드리기 전에 편집 전체를 검증한다. 어긋나면 던진다 — 화면은 이 메시지를 그대로 보인다. */
export function validateMenuSystemEdit(edit: MenuSystemEdit): void {
  if (edit.menu) validateFieldMenu(edit.menu);
  if (edit.dialogue) validateDialogueSystem(edit.dialogue);
  if (edit.vn) validateVnExtras(edit.vn);
  if (edit.look) validateVnLook(edit.look);
}

/** 검증된 편집을 반영하고, 연동으로 켠 기능 안내를 돌려준다. 메뉴가 새로 생기거나 사라질 때만 창 모양을 맞춘다. */
export function applyMenuSystemEdit(project: Project, edit: MenuSystemEdit): string[] {
  validateMenuSystemEdit(edit);
  const notices: string[] = [];
  if (edit.dialogue !== undefined) applyDialogueSystemAuthoring(project, edit.dialogue ?? undefined);
  if (edit.vn !== undefined) applyVnExtrasAuthoring(project, edit.vn ?? undefined);
  if (edit.look !== undefined) {
    if (edit.look) project.meta.oprnVnLook = edit.look;
    else delete project.meta.oprnVnLook;
  }
  if (edit.menu !== undefined) {
    const was = project.meta.oprnFieldMenu !== undefined;
    notices.push(...applyFieldMenuAuthoring(project, edit.menu ?? undefined));
    if (was !== (edit.menu !== null)) syncMenuUiStyle(project, edit.menu !== null);
  }
  return notices;
}

/** 저장 검증 오류(영문 내부 문장)를 화면용 한국어로 바꾼다. 모르는 문장은 그대로 보인다. */
export function describeMenuSystemError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/fieldMenu: label/.test(message)) return "메뉴 이름은 1~12자여야 하고 앞뒤 공백·줄바꿈이 없어야 합니다.";
  if (/fieldMenu: version1 and 1\.\.12/.test(message)) return "메뉴 항목은 1~12개여야 합니다.";
  if (/fieldMenu: invalid or duplicate/.test(message)) return "같은 항목을 두 번 넣을 수 없습니다.";
  if (/fieldMenu: title return must be last/.test(message)) return "「타이틀로」는 항상 맨 끝에 있어야 합니다.";
  if (/vnLook: preset must be/.test(message)) return "대사창 룩 프리셋이 목록에 없습니다.";
  if (/vnLook: /.test(message)) return "대사창 룩 설정 값이 올바르지 않습니다.";
  const limit = /backlog\.limit integer (\d+)\.\.(\d+)/.exec(message);
  if (limit) return `백로그 줄 수는 ${limit[1]}~${limit[2]} 사이 정수여야 합니다.`;
  const opacity = /windowOpacity ([\d.]+)\.\.([\d.]+)/.exec(message);
  if (opacity) return `대사창 불투명도는 ${opacity[1]}~${opacity[2]} 사이여야 합니다.`;
  return message;
}
