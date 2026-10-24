import { isDeepStrictEqual } from 'node:util';
import type { Project } from '../../../../project/types';
import {
  MAP, clone, eventOf, fail, mapOf, pass, tidyEvent,
} from '../matrixNativeSpec';
import type { JudgeInput, Verdict } from '../matrixNativeSpec';

/**
 * group-2 (이벤트·분기·변수) 가 공유하는 픽스처와 판정 도우미.
 *
 * 픽스처는 **덧붙이기 전용**이다 — 기존 이벤트·맵·DB 행은 건드리지 않고, group-2 가 판정에 쓰는
 * 이벤트·커먼 이벤트·스위치·변수만 새 id 로 더한다. 그래야 50개 기본 행렬의 판정기가 그대로 산다.
 * (nativeProject 는 이미 ev_utility_npc·ev_test_cutscene·ev_test_shop 을 만든다.)
 */

export const G2 = {
  walkers: { a: 'ev_g2_walker_a', b: 'ev_g2_walker_b', c: 'ev_g2_walker_c' },
  cutscenes: {
    plain: 'ev_g2_cutscene_plain',
    twoFades: 'ev_g2_cutscene_two_fades',
    fadeA: 'ev_g2_cutscene_fade_a',
    fadeB: 'ev_g2_cutscene_fade_b',
    fadeC: 'ev_g2_cutscene_fade_c',
  },
  branches: { choice: 'ev_g2_branch_choice', gate: 'ev_g2_branch_gate' },
  commonEvents: { hello: 'ce_g2_hello', notice: 'ce_g2_notice' },
  switches: { orphan: 'sw_g2_orphan', oldGate: 'sw_g2_old_gate', draft: 'sw_g2_draft' },
  variables: { trust: 'var_g2_trust', met: 'var_g2_met', purse: 'var_g2_purse' },
} as const;

// 모델이 따옴표·마침표를 달리 쓰는 것은 같은 대사다. 뜻(낱말)만 비교한다.
const CORE_NOISE = /[\s"'“”‘’「」『』〈〉《》.,!?~…·:;()\[\]{}<>*_\-–—]/gu;
export const core = (text: unknown): string => String(text ?? '').replace(CORE_NOISE, '');
export const sameWords = (haystack: unknown, needle: unknown): boolean => {
  const h = core(haystack), n = core(needle);
  return n.length > 0 && (h.includes(n) || n.includes(h));
};
export const nonEmptyText = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;

export const commandsAt = (project: Project, eventId: string, page = 0): any[] => eventOf(project, eventId)?.pages?.[page]?.commands ?? [];
export const addedCommands = (was: readonly any[], now: readonly any[]): any[] => now.filter(command => !was.some(old => isDeepStrictEqual(old, command)));

/** What a family may ignore when it asks "everything else is preserved". Each ignored part is judged separately. */
export type Ignore = { events?: readonly string[]; flags?: boolean; system?: boolean; systemFields?: readonly string[]; tiles?: boolean };

const TILE_FIELDS = ['lowerTiles', 'upperTiles', 'lowerOverlayTiles', 'upperOverlayTiles', 'shadowBits', 'lowerTileStacks', 'upperTileStacks', 'doodadGroups', 'terrainDesign', 'relief'];

/**
 * Document comparison without cloning the project: `matrixNativeSpec.normalizeContent` deep-clones, and a
 * 30k-tile bundled tileset makes that ~1s per call while a judge runs several times per variant.
 * `tiles: true` drops the map tile buffers — for a family that never paints, comparing 150k tile numbers
 * per judge call only costs time.
 */
export function contentView(project: Project, ignore: Ignore = {}): any {
  const doc: any = project;
  const skipped = new Set(ignore.events ?? []);
  const view: any = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === 'meta' || key === 'tilesets' || key === 'assets') continue;
    if (ignore.flags && (key === 'switches' || key === 'variables' || key === 'session')) continue;
    if (ignore.system && key === 'system') continue;
    if (key === 'system' && ignore.systemFields?.length) {
      const system: any = { ...value };
      for (const field of ignore.systemFields) delete system[field];
      view[key] = system;
      continue;
    }
    view[key] = value;
  }
  const stripTiles = (map: any) => {
    if (!ignore.tiles) return map;
    const copy: any = { ...map };
    for (const field of TILE_FIELDS) delete copy[field];
    return copy;
  };
  view.maps = Object.fromEntries(Object.entries<any>(doc.maps ?? {}).map(([id, map]) => {
    const next = stripTiles(map);
    return [id, skipped.size ? { ...next, events: (next.events ?? []).filter((event: any) => !skipped.has(event.id)) } : next];
  }));
  return view;
}

export const sameDoc = (a: Project, b: Project, ignore: Ignore = {}): boolean => isDeepStrictEqual(contentView(a, ignore), contentView(b, ignore));

/**
 * 명령 트리에서 `drop` 에 맞는 명령을 걷어낸 사본. 중첩 분기 검사에 쓴다 —
 * "추가된 것 말고는 그대로인가" 를 비교하려면 추가된 종류만 빼고 견줘야 한다.
 */
export function stripCommands(list: readonly any[], drop: (command: any) => boolean): any[] {
  const walk = (commands: readonly any[]): any[] => commands
    .filter(command => !drop(command))
    .map(command => {
      if (!command || typeof command !== 'object') return command;
      if (command.kind === 'choices') {
        return {
          ...command,
          options: (command.options ?? []).map((option: any) => ({ ...option, branch: walk(option.branch ?? []) })),
          ...(Array.isArray(command.cancelBranch) ? { cancelBranch: walk(command.cancelBranch) } : {}),
        };
      }
      if (command.kind === 'presentItem') {
        return {
          ...command,
          options: (command.options ?? []).map((option: any) => ({ ...option, branch: walk(option.branch ?? []) })),
          ...(Array.isArray(command.otherwiseBranch) ? { otherwiseBranch: walk(command.otherwiseBranch) } : {}),
          ...(Array.isArray(command.cancelBranch) ? { cancelBranch: walk(command.cancelBranch) } : {}),
        };
      }
      if (command.kind === 'fork') {
        return { ...command, then: walk(command.then ?? []), ...(Array.isArray(command.else) ? { else: walk(command.else) } : {}) };
      }
      if (command.kind === 'loop') return { ...command, body: walk(command.body ?? []) };
      if (command.kind === 'battleProcessing') {
        return {
          ...command,
          ...(Array.isArray(command.victoryBranch) ? { victoryBranch: walk(command.victoryBranch) } : {}),
          ...(Array.isArray(command.defeatBranch) ? { defeatBranch: walk(command.defeatBranch) } : {}),
          ...(Array.isArray(command.escapeBranch) ? { escapeBranch: walk(command.escapeBranch) } : {}),
        };
      }
      return command;
    });
  return walk(list);
}

// ── 판정 도우미 ─────────────────────────────────────────────────────────────

/**
 * `matrixNativeSpec.eventEdit` 과 같은 계약이다. 이벤트 하나 밖이 그대로인지 보고, 그 안의 변화는 판정기가 본다.
 * 무시하는 부분(플래그·system 등)은 각 판정기가 따로 검사하므로 사라진 스위치를 숨기지 않는다.
 */
export function editEvent(
  input: JudgeInput,
  eventId: string,
  check: (before: any, after: any) => Verdict,
  ignore: Ignore = { tiles: true },
): Verdict {
  if (!sameDoc(input.before, input.after, { ...ignore, events: [eventId] })) return fail(`${eventId} 밖의 내용이 바뀌었다`);
  const before = tidyEvent(eventOf(input.before, eventId));
  const after = tidyEvent(eventOf(input.after, eventId));
  if (!before || !after) return fail(`${eventId} 이벤트가 사라졌다`);
  return check(before, after);
}

export const FLAGS_IGNORED: Ignore = { flags: true, tiles: true };
export const FLAGS_AND_SYSTEM_IGNORED: Ignore = { flags: true, system: true, tiles: true };
export const EVENTS_ONLY: Ignore = { tiles: true };

/**
 * 읽기 가족의 판정 계약: 문서는 그대로이고, 성공한 조회 도구 호출과 빈 답이 아닌 답이 있어야 한다.
 * `matrixNativeSpec.readOnly` 와 같은 뜻이지만 프로젝트를 깊은 복사하지 않는다.
 */
export function readVerdict(input: JudgeInput, label: string, check: () => Verdict): Verdict {
  if (!sameDoc(input.before, input.after, EVENTS_ONLY)) return fail(`${label}: 읽기 명령이 문서를 바꿨다`);
  if (!input.tools.some(tool => tool.ok === true)) return fail(`${label}: 성공한 조회 도구 호출이 없다`);
  if (!input.answer.trim()) return fail(`${label}: 답변이 비었다`);
  return check();
}

/** 명령을 고치는 가족은 페이지 하나만 바뀌어야 한다 — 다른 페이지의 조건·그림·대사까지 사라지면 안 된다. */
export function otherPagesPreserved(before: any, after: any, index: number): boolean {
  const beforePages = (before.pages ?? []) as any[];
  const afterPages = (after.pages ?? []) as any[];
  if (beforePages.length !== afterPages.length) return false;
  return beforePages.every((page: any, at: number) => at === index || isDeepStrictEqual(page, afterPages[at]));
}

/** 기존 스위치·변수가 사라졌는가 — 덧붙이기만 했는지. */
export function lostFlags(before: Project, after: Project): string | undefined {
  const lostSwitches = ((before as any).switches ?? []).filter((entry: any) => !((after as any).switches ?? []).some((next: any) => next.id === entry.id));
  if (lostSwitches.length) return `기존 스위치 ${lostSwitches.length}개가 사라졌다(${lostSwitches.map((entry: any) => entry.id).join(', ')})`;
  const lostVariables = ((before as any).variables ?? []).filter((entry: any) => !((after as any).variables ?? []).some((next: any) => next.id === entry.id));
  if (lostVariables.length) return `기존 변수 ${lostVariables.length}개가 사라졌다(${lostVariables.map((entry: any) => entry.id).join(', ')})`;
  return undefined;
}

export const newSwitches = (before: Project, after: Project): any[] => ((after as any).switches ?? []).filter((entry: any) => !((before as any).switches ?? []).some((old: any) => old.id === entry.id));
export const newVariables = (before: Project, after: Project): any[] => ((after as any).variables ?? []).filter((entry: any) => !((before as any).variables ?? []).some((old: any) => old.id === entry.id));

const pageBase = (project: Project): any => {
  const page = eventOf(project, 'ev_utility_npc')?.pages?.[0];
  if (!page) throw new Error('fixture 에 ev_utility_npc 페이지가 없다');
  return clone(page);
};

const moveRoute = (dir: string) => ({ moves: [{ kind: 'move', dir }], repeat: false });

const text = (body: string, speaker?: string) => ({ kind: 'text', body, ...(speaker ? { speaker } : {}) });
const hideScreen = { kind: 'm2Command', commandId: 'm2-044-hide-screen', fields: {} };
const showScreen = { kind: 'm2Command', commandId: 'm2-045-show-screen', fields: {} };

function addEvent(
  project: Project,
  spec: { id: string; name: string; x: number; y: number; trigger?: string; commands: any[]; conditions?: any[] },
): Project {
  const map = mapOf(project);
  if (map.events.some((event: any) => event.id === spec.id)) return project;
  const page = pageBase(project);
  page.id = `${spec.id}_page`;
  page.name = spec.name;
  page.trigger = { kind: spec.trigger ?? 'action' };
  page.conditions = spec.conditions ?? [];
  page.commands = spec.commands;
  map.events.push({ id: spec.id, name: spec.name, x: spec.x, y: spec.y, trigger: page.trigger, commands: [], pages: [page] });
  return project;
}

/**
 * group-2 픽스처: 멱등이고 덧붙이기만 한다 — 기존 이벤트·맵·DB 행은 그대로 두고 새 id 만 더한다.
 */
export function prepareGroup2(project: Project): Project {
  addEvent(project, {
    id: G2.walkers.a, name: '산책하는 주민', x: 2, y: 8,
    commands: [text('산책 중이에요.'), { kind: 'moveEvent', eventId: G2.walkers.a, route: moveRoute('right') }, text('바람이 좋네요.')],
  });
  addEvent(project, {
    id: G2.walkers.b, name: '짐꾼', x: 4, y: 9,
    commands: [
      text('짐을 나르는 중입니다.'),
      { kind: 'moveEvent', eventId: G2.walkers.b, route: moveRoute('up') },
      { kind: 'moveEvent', eventId: G2.walkers.b, route: moveRoute('down') },
      text('무겁군요.'),
    ],
  });
  addEvent(project, {
    id: G2.walkers.c, name: '길 잃은 아이', x: 9, y: 4,
    commands: [{ kind: 'moveEvent', eventId: G2.walkers.c, route: moveRoute('left') }, text('어디로 가야 하지?')],
  });
  addEvent(project, {
    id: G2.cutscenes.plain, name: '노을 장면', x: 16, y: 4,
    commands: [text('해가 진다.'), { kind: 'wait', ms: 200 }, text('바람이 분다.')],
  });
  addEvent(project, {
    id: G2.cutscenes.twoFades, name: '두 번 암전', x: 18, y: 4,
    commands: [text('첫 장면.'), hideScreen, { kind: 'wait', ms: 200 }, showScreen, text('둘째 장면.'), hideScreen, { kind: 'wait', ms: 400 }, showScreen],
  });
  addEvent(project, {
    id: G2.cutscenes.fadeA, name: '불이 꺼지는 장면', x: 10, y: 4,
    commands: [text('촛불이 꺼진다.'), hideScreen, { kind: 'wait', ms: 300 }, showScreen],
  });
  addEvent(project, {
    id: G2.cutscenes.fadeB, name: '어둠에서 시작하는 장면', x: 12, y: 4,
    commands: [hideScreen, { kind: 'wait', ms: 250 }, showScreen, text('어둠 속에서 목소리가 들린다.'), hideScreen, { kind: 'wait', ms: 300 }, showScreen],
  });
  addEvent(project, {
    id: G2.cutscenes.fadeC, name: '끝에 암전하는 장면', x: 14, y: 4,
    commands: [text('연출.'), hideScreen, { kind: 'wait', ms: 500 }, showScreen, text('끝.')],
  });
  addEvent(project, {
    id: G2.branches.choice, name: '문 앞의 선택', x: 6, y: 4,
    commands: [
      text('문 앞에 섰다.'),
      { kind: 'choices', prompt: '어떻게 할까?', options: [
        { text: '문을 두드린다', branch: [text('쿵쿵.')] },
        { text: '돌아선다', branch: [text('발길을 돌렸다.')] },
      ], cancelBehavior: 'disallow' },
    ],
  });
  addEvent(project, {
    id: G2.branches.gate, name: '성문의 경비', x: 8, y: 4,
    commands: [
      text('경비가 물었다.'),
      { kind: 'choices', prompt: '어떻게 답할까?', options: [
        { text: '통행증을 보여준다', branch: [text('통행증을 꺼냈다.'), { kind: 'setSwitch', switchId: 'sw_ember_q1_started', value: true }] },
        { text: '아무 말 없이 선다', branch: [text('경비가 눈을 가늘게 떴다.'), { kind: 'wait', ms: 300 }] },
      ], cancelBehavior: 'disallow' },
    ],
  });
  for (const [id, name, body] of [[G2.commonEvents.hello, '마을 소식', '마을 소식입니다.'], [G2.commonEvents.notice, '축제 안내', '곧 축제가 열립니다.']] as const) {
    if (!project.commonEvents.some(entry => entry.id === id)) project.commonEvents.push({ id, name, trigger: 'none', commands: [text(body)] });
  }
  for (const [id, name] of [[G2.switches.orphan, '잊힌 스위치'], [G2.switches.oldGate, '옛 성문 스위치'], [G2.switches.draft, '초안 스위치']] as const) {
    if (!(project as any).switches.some((entry: any) => entry.id === id)) (project as any).switches.push({ id, name });
    (project as any).session.switches[id] ??= false;
  }
  for (const [id, name] of [[G2.variables.trust, '신뢰'], [G2.variables.met, '만남 횟수'], [G2.variables.purse, '가진 돈']] as const) {
    if (!(project as any).variables.some((entry: any) => entry.id === id)) (project as any).variables.push({ id, name });
    (project as any).session.variables[id] ??= 0;
  }
  return project;
}

export { MAP, clone, fail, pass, mapOf, eventOf };
