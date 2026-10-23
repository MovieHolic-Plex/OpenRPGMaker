import { bindEmeraldBattleSurface } from '@/player/emeraldSurfaces';
import { playBattleCue } from '@/player/battleJuice';
import { MONSTER_SKILL_MAX } from '@/project/monsterCollection';
import type { Project } from '@/project/types';
import { withJosa } from '@/util/josa';
import '@/styles/runtime/emeraldEvolution.css';
import '@/styles/runtime/emeraldMoveLearn.css';

/** 칸이 가득 차 새 기술을 배울 수 없는 몬스터 한 마리의 한 기술. activeSkillIds 는 이 장면 시작 때의 익힌 기술(순서 유지). */
export interface EmeraldMoveLearnRequest {
  readonly instanceId: string;
  readonly name: string;
  readonly pendingSkillId: string;
  readonly activeSkillIds: readonly string[];
}

/** replaceSkillId 가 있으면 그 기술을 잊고 새 기술을 배운다. 없으면 미룸(보류로 남아 메뉴에서 다시 정한다). */
export interface EmeraldMoveLearnDecision {
  readonly instanceId: string;
  readonly pendingSkillId: string;
  readonly replaceSkillId?: string;
}

const TYPE_MS = 28;
const sleep = (ms: number, signal?: AbortSignal): Promise<void> => new Promise((resolve) => {
  const timer = window.setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { window.clearTimeout(timer); resolve(); }, { once: true });
});

interface MenuRow { readonly label: string; readonly sub?: string; readonly disabled?: boolean }

/**
 * 레벨업으로 배울 기술이 있는데 칸이 가득 찼을 때의 3세대식 「잊게 할까?」 장면(전투 승리 뒤, 필드로 돌아가기 전).
 * 전투 화면 위에 문장 창과 선택 상자만 얹는다. 결정만 돌려주고 세션은 건드리지 않는다 — 반영은 호출자가 보상 적용 뒤에 한다.
 * 취소(중단 신호)면 아직 정하지 않은 항목은 미룸으로 돌려준다(보류로 남아 데이터를 잃지 않는다).
 */
export async function playEmeraldMoveLearns(host: HTMLElement, project: Project, requests: readonly EmeraldMoveLearnRequest[], signal?: AbortSignal): Promise<EmeraldMoveLearnDecision[]> {
  const decisions: EmeraldMoveLearnDecision[] = [];
  const active = new Map<string, string[]>();
  for (const request of requests) {
    if (!active.has(request.instanceId)) active.set(request.instanceId, [...request.activeSkillIds]);
  }
  if (requests.length === 0) return decisions;
  const root = document.createElement('div');
  root.className = 'battle-scene emerald-evolution emerald-movelearn';
  root.dataset.battleUiStyle = 'pokemon';
  root.dataset.battleSkin = 'pokemon';
  root.dataset.monsterStyle = 'emerald';
  root.dataset.testid = 'emerald-movelearn';
  const box = document.createElement('div');
  box.className = 'emerald-evolution-message';
  const line = document.createElement('div');
  line.className = 'battle-message-line';
  box.append(line);
  const menu = document.createElement('div');
  menu.className = 'emerald-movelearn-menu';
  menu.dataset.testid = 'emerald-movelearn-menu';
  menu.hidden = true;
  root.append(menu, box);
  host.append(root);
  // 아래 결과 창의 능력치 상자가 이 장면의 문장 창에 반쯤 가려 보이지 않게 표시해 둔다(emeraldMoveLearn.css).
  const underlying = [...host.querySelectorAll<HTMLElement>('.battle-scene:not(.emerald-movelearn)')];
  for (const node of underlying) node.dataset.movelearnOpen = 'true';
  const surface = bindEmeraldBattleSurface(host, root);
  const controller = new AbortController();
  const stop = (): void => controller.abort();
  signal?.addEventListener('abort', stop, { once: true });
  let skip = false;
  let menuKeys: ((event: KeyboardEvent) => void) | undefined;
  const onKey = (event: KeyboardEvent): void => {
    if (menuKeys) { event.preventDefault(); event.stopPropagation(); menuKeys(event); return; }
    if (!/^(z|Z|Enter| |e|E)$/u.test(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    skip = true;
  };
  const onClick = (): void => { if (!menuKeys) skip = true; };
  window.addEventListener('keydown', onKey, true);
  root.addEventListener('click', onClick);

  const skillName = (skillId: string): string => project.database.skills.find((skill) => skill.id === skillId)?.name ?? skillId;
  const skillType = (skillId: string): string | undefined => {
    const elementId = project.database.skills.find((skill) => skill.id === skillId)?.elementId;
    return elementId ? (project.database.elements ?? []).find((element) => element.id === elementId)?.name ?? elementId : undefined;
  };

  const typeText = async (text: string): Promise<void> => {
    skip = false;
    line.replaceChildren();
    const shown = document.createElement('span');
    const rest = document.createElement('span');
    rest.className = 'battle-message-untyped';
    rest.textContent = text;
    line.append(shown, rest);
    for (let i = 1; i <= text.length && !skip && !controller.signal.aborted; i += 1) {
      shown.textContent = text.slice(0, i);
      rest.textContent = text.slice(i);
      await sleep(TYPE_MS, controller.signal);
    }
    shown.textContent = text;
    rest.textContent = '';
    skip = false;
  };
  /** 문장을 치고 확인키(또는 hold ms)까지 기다린다. */
  const say = async (text: string, hold: number): Promise<void> => {
    await typeText(text);
    const end = performance.now() + hold;
    while (performance.now() < end && !skip && !controller.signal.aborted) await sleep(40, controller.signal);
    skip = false;
  };
  /** 선택 상자: 위·아래로 고르고 Z/Enter 로 정한다. X/Esc 는 null(뒤로). 비활성 줄도 고를 수 있고 호출자가 거절 문장을 말한다. */
  const pick = (rows: readonly MenuRow[], initial = 0): Promise<number | null> => new Promise((resolve) => {
    if (controller.signal.aborted) { resolve(null); return; }
    let cursor = Math.max(0, Math.min(rows.length - 1, initial));
    menu.replaceChildren();
    menu.dataset.rows = String(rows.length);
    const nodes = rows.map((row, index) => {
      const node = document.createElement('div');
      node.className = 'emerald-movelearn-row';
      node.dataset.testid = `emerald-movelearn-row-${index}`;
      if (row.disabled) node.dataset.disabled = 'true';
      const label = document.createElement('span');
      label.className = 'emerald-movelearn-label';
      label.textContent = row.label;
      node.append(label);
      if (row.sub) {
        const sub = document.createElement('span');
        sub.className = 'emerald-movelearn-sub';
        sub.textContent = row.sub;
        node.append(sub);
      }
      node.addEventListener('click', (event) => { event.stopPropagation(); finish(index); });
      menu.append(node);
      return node;
    });
    const paint = (): void => nodes.forEach((node, index) => { node.dataset.cursor = String(index === cursor); });
    const finish = (value: number | null): void => {
      menuKeys = undefined;
      controller.signal.removeEventListener('abort', onAbort);
      menu.hidden = true;
      resolve(value);
    };
    const onAbort = (): void => finish(null);
    controller.signal.addEventListener('abort', onAbort, { once: true });
    menuKeys = (event) => {
      if (/^(ArrowDown|s|S)$/u.test(event.key)) { cursor = (cursor + 1) % rows.length; paint(); }
      else if (/^(ArrowUp|w|W)$/u.test(event.key)) { cursor = (cursor + rows.length - 1) % rows.length; paint(); }
      else if (/^(z|Z|Enter| )$/u.test(event.key)) finish(cursor);
      else if (/^(x|X|Escape|Backspace)$/u.test(event.key)) finish(null);
    };
    paint();
    menu.hidden = false;
  });

  try {
    await sleep(200, controller.signal);
    for (const request of requests) {
      const moves = active.get(request.instanceId) ?? [];
      const newName = skillName(request.pendingSkillId);
      const who = withJosa(request.name, '은/는');
      if (controller.signal.aborted) { decisions.push({ instanceId: request.instanceId, pendingSkillId: request.pendingSkillId }); continue; }
      await say(`${who} ${withJosa(newName, '을/를')} 배우고 싶어 한다!\n하지만 기술이 ${MONSTER_SKILL_MAX}개라 더 배울 수 없다!`, 1500);
      let replaced: string | undefined;
      let forgetting = true;
      while (forgetting && !controller.signal.aborted) {
        await typeText(`${withJosa(newName, '을/를')} 배우려면\n다른 기술을 잊어야 한다. 잊게 할까?`);
        // 3세대처럼 커서는 「예」에서 시작한다 — 「아니오」 기본이면 확인키만 누르는 플레이어가 Lv10 위력 55 기술을 늘 놓쳤다(2026-10-21 아스트라 적대 검수 r9).
        const yes = await pick([{ label: '예' }, { label: '아니오' }], 0);
        if (yes !== 0) break;
        await typeText('어떤 기술을 잊게 할까?');
        const rows: MenuRow[] = moves.map((moveId) => ({
          label: skillName(moveId),
          sub: skillType(moveId),
          disabled: project.database.skills.find((skill) => skill.id === moveId)?.unforgettable === true,
        }));
        const chosen = await pick(rows, 0);
        if (chosen === null) continue;
        const forgottenId = moves[chosen];
        if (forgottenId === undefined) continue;
        if (rows[chosen]?.disabled) {
          await say(`${withJosa(skillName(forgottenId), '은/는')}\n중요한 기술이라 잊게 할 수 없다!`, 1400);
          continue;
        }
        replaced = forgottenId;
        forgetting = false;
      }
      if (replaced !== undefined) {
        const index = moves.indexOf(replaced);
        if (index >= 0) moves[index] = request.pendingSkillId;
        decisions.push({ instanceId: request.instanceId, pendingSkillId: request.pendingSkillId, replaceSkillId: replaced });
        playBattleCue('victory');
        await say(`${who} ${withJosa(skillName(replaced), '을/를')} 잊고\n${withJosa(newName, '을/를')} 배웠다!`, 1700);
      } else {
        decisions.push({ instanceId: request.instanceId, pendingSkillId: request.pendingSkillId });
        if (!controller.signal.aborted) await say(`${who} ${newName} 배우기를 미뤘다.\n(메뉴의 몬스터 화면에서 정할 수 있다)`, 1800);
      }
    }
  } finally {
    window.removeEventListener('keydown', onKey, true);
    signal?.removeEventListener('abort', stop);
    surface.cleanup();
    for (const node of underlying) delete node.dataset.movelearnOpen;
    root.remove();
  }
  return decisions;
}
