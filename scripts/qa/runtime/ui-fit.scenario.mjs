// ESC 메뉴(8명령)와 전투 명령 창의 긴 거절 사유가 해상도마다 화면 안에 들어가는지 찍는 시나리오.
//
//   UIFIT_PROJECT=<player.json> UIFIT_RES=320x240 UIFIT_VIEW=960x720 [UIFIT_MENU_SKIN=workbench] npm run qa:runtime -- --scenario ui-fit --out <dir>
//
// 사본에 「QA 스위치가 켜지면 도주 불가 보스전을 여는 자동 실행 이벤트」를 시작 맵에 하나 더한다.
// 원본 게임(보스 troop·시작 맵)은 그대로 둔다. troop 은 프로젝트의 첫 도주 불가 전투를, 없으면 첫 troop 을 쓴다.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = process.env.UIFIT_PROJECT;
if (!source) throw new Error('UIFIT_PROJECT=<player.json> 가 필요하다');
const [resW, resH] = (process.env.UIFIT_RES ?? '320x240').split('x').map(Number);
const [viewW, viewH] = (process.env.UIFIT_VIEW ?? '960x720').split('x').map(Number);

async function writeFixture() {
  const project = JSON.parse(await readFile(source, 'utf8'));
  project.system = { ...project.system, playResolution: { width: resW, height: resH }, ...(process.env.UIFIT_MENU_SKIN ? { menuUiStyle: process.env.UIFIT_MENU_SKIN } : {}) };
  let troopId = null;
  const walk = (node) => {
    if (troopId || !node || typeof node !== 'object') return;
    if (node.kind === 'battleProcessing' && node.canEscape === false) { troopId = node.troopId; return; }
    for (const value of Array.isArray(node) ? node : Object.values(node)) walk(value);
  };
  walk(project.maps);
  troopId ??= project.database.troops[0].id;
  const qaEvent = {
    id: 'ev_qa_ui_fit_boss', x: 0, y: 0, trigger: { kind: 'auto' }, commands: [],
    pages: [{
      id: 'ev_qa_ui_fit_boss_page', name: 'qa', conditions: [{ kind: 'switch', switchId: 'sw_qa_ui_fit', value: true }],
      graphic: { transparent: true }, trigger: { kind: 'auto' }, priority: 'below', overlapForbidden: false,
      movement: { type: 'fixed', speed: 3, frequency: 3 },
      commands: [
        { kind: 'setSwitch', switchId: 'sw_qa_ui_fit', value: false },
        { kind: 'battleProcessing', troopId, canEscape: false, canLose: true },
      ],
    }],
  };
  // 오프닝이 다른 맵으로 옮길 수 있으니 모든 맵에 둔다(스위치를 먼저 끄므로 한 번만 돈다).
  for (const map of Object.values(project.maps)) {
    const copy = structuredClone(qaEvent);
    if (Array.isArray(map.events)) map.events.push(copy); else map.events[copy.id] = copy;
  }
  if (Array.isArray(project.switches) && !project.switches.some((s) => s.id === 'sw_qa_ui_fit')) {
    project.switches.push({ id: 'sw_qa_ui_fit', name: 'qa ui fit' });
  }
  const path = resolve(`verify-shots/runtime-qa/_fixtures/ui-fit-${resW}x${resH}.json`);
  await mkdir(resolve('verify-shots/runtime-qa/_fixtures'), { recursive: true });
  await writeFile(path, JSON.stringify(project));
  return path;
}


// 화면 배치 실측 — 메뉴 레일·명령·도움말, 전투 사유 글자의 상자와 계산값을 out 폴더에 남긴다.
const LAYOUT_FN = `() => {
  const pick = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); const s = getComputedStyle(n);
    return { cls: String(n.className).slice(0, 90), testid: n.dataset?.testid ?? null, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
      sw: n.scrollWidth, cw: n.clientWidth, sh: n.scrollHeight, ch: n.clientHeight, font: s.fontSize, lh: s.lineHeight, pos: s.position, disp: s.display, ov: s.overflow, ws: s.whiteSpace, transform: s.transform, gtr: s.gridTemplateRows, flex: s.flex, minH: s.minHeight, maxH: s.maxHeight, pad: s.padding, gap: s.gap, top: s.top, bottom: s.bottom }; };
  const all = (sel) => [...document.querySelectorAll(sel)].map(pick);
  const chain = (n) => { const out = []; while (n && out.length < 9) { out.push(pick(n)); n = n.parentElement; } return out; };
  return {
    stage: pick(document.querySelector('.play-stage')),
    panel: pick(document.querySelector('.oprn-status-menu.main-menu')),
    panelData: { ...(document.querySelector('.oprn-status-menu.main-menu')?.dataset ?? {}) },
    dockChain: chain(document.querySelector('.status-menu-command-rail')),
    commands: all('.status-menu-command-rail > .status-menu-command'),
    footer: pick(document.querySelector('.status-menu-footer')),
    footerKids: all('.status-menu-footer > *'),
    reason: chain(document.querySelector('.battle-command-reason')),
  };
}`;
const key = (k, times = 1) => ({ kind: 'key', key: k, times });
export default {
  id: 'ui-fit',
  viewport: { width: viewW, height: viewH },
  projectFixture: await writeFixture(),
  beats: [
    { id: 'title', expect: { testidPresent: ['title-screen'] } },
    { id: 'field', ops: [key('Enter'), { kind: 'waitForRuntime' }], expect: { testidAbsent: ['title-screen'] } },
    { id: 'menu', ops: [{ kind: 'pressUntil', key: 'Escape', testid: 'main-menu', state: 'present', maxPresses: 15, timeoutMs: 2000 }, { kind: 'evalToFile', fn: LAYOUT_FN, out: `verify-shots/runtime-qa/_layout/ui-fit-${resW}x${resH}-${viewW}x${viewH}-menu.json` }], shot: true },
    { id: 'menu-last', note: '마지막 명령(타이틀로)까지 내려간다.', ops: [key('ArrowUp')], shot: true },
    { id: 'battle', ops: [key('Escape'), { kind: 'waitFor', testid: 'main-menu', state: 'absent' }, { kind: 'setSwitch', switchId: 'sw_qa_ui_fit', value: true }, { kind: 'waitFor', testid: 'battle-scene', state: 'present', timeoutMs: 60000 }, { kind: 'waitForVisible', testid: 'actor-command-escape' }, { kind: 'evalToFile', fn: LAYOUT_FN, out: `verify-shots/runtime-qa/_layout/ui-fit-${resW}x${resH}-${viewW}x${viewH}-battle.json` }], shot: true },
  ],
};
