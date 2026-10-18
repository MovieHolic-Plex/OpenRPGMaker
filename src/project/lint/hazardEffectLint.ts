import type { Command, GameEvent, Project } from '../types';
import { collectCommands } from '../mapInspection';
import { PLAYER_MOVE_TARGET } from '../moveRouteTarget';
import type { LintIssue } from './projectLint';

/**
 * 위험지대 사망 연출(열풍·독안개 등)이 정지 화면에서도 읽히는지 보는 검토 경고.
 *
 * 왜(2026-10-16 JRPG 파일럿 20~21차): 조수가 붉은/보라 tint + 짧은 불·연기 입자(400~700ms, 플레이어 한 칸)만 쓴
 * 열풍·독안개 사망 이벤트는 «열풍이 안 보인다»·«안개가 피어오르지 않는다» 로 매번 감점됐다. tint 는 화면 색일 뿐
 * 위험의 «원천» 이 아니다. 미적 판정이 아니라 «효과가 너무 약하다» 는 알림이며 의도적 연출을 막지 않는다.
 */

const MIN_VISIBLE_PARTICLE_MS = 1000;
/** 생존(무사 통과) 분기가 «위험 구역을 건넜다» 로 읽히려면 플레이어가 이만큼은 걸어야 한다. */
const MIN_SURVIVAL_STEPS = 3;

type Fields = Record<string, unknown>;
const fieldsOf = (c: Command): Fields => ((c as { fields?: Fields }).fields ?? {}) as Fields;
const commandIdOf = (c: Command): string => String((c as { commandId?: unknown }).commandId ?? '');

const isParticle = (c: Command) => commandIdOf(c) === 'm2-224-particle-effect' || (c.kind as string) === 'particles';
const isWeather = (c: Command) => {
  const id = commandIdOf(c);
  if (id === 'm2-050-set-weather-effects') return String(fieldsOf(c).weather ?? fieldsOf(c).value ?? 'none') !== 'none';
  if (id === 'm2-202-screen-effect' && fieldsOf(c).effect === 'weather') return String(fieldsOf(c).value ?? 'none') !== 'none';
  // 컷씬 weather 비트는 setWeather 로 컴파일된다(2026-10-17 jrpg_003 실측) — 이것을 빼면 안개를 깐 이벤트에도 hazard-no-fog 가 떴다.
  if (c.kind === 'setWeather') return c.weather !== 'none';
  return (c.kind as string) === 'weather' && 'weather' in c && String(c.weather ?? 'none') !== 'none';
};
const isDeath = (c: Command) => c.kind === 'gameOver' || (c.kind as string) === 'killPlayer';

function tintFamily(c: Command): 'heat' | 'poison' | undefined {
  const m = /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/u.exec(String(fieldsOf(c).value ?? ''));
  if (!m) return undefined;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (r >= 180 && g <= 120 && b <= 90) return 'heat';
  if ((b >= 120 && r >= 90 && g <= 100) || (g >= 140 && r <= 120 && b <= 120)) return 'poison';
  return undefined;
}

const playerSteps = (commands: readonly Command[]) =>
  commands.reduce((n, c) => (c.kind === 'moveEvent' && c.eventId === PLAYER_MOVE_TARGET ? n + c.route.moves.length : n), 0);

/**
 * 사망이 있는 이벤트의 «생존 분기» 명령 묶음들. 조건 분기(fork)는 한쪽만 사망이면 다른 쪽, 쪽수 분기(스위치 조건 페이지)는
 * 사망이 없고 대사·색조·안개가 있는 페이지다(1회성 빈 페이지는 뺀다).
 *
 * 왜(2026-10-17 jrpg_003 심판 45점): 방독면 페이지가 «대사 + 색조만» 이라 주인공이 한 칸에 서 있었고, 심판은
 * «무사 통과 연출이 전달되지 않는다» 고 했다. 정지 화면에서 통과는 위치가 바뀌어야만 보인다.
 */
function survivalBranches(event: GameEvent): (readonly Command[])[] {
  const out: (readonly Command[])[] = [];
  // 명령 묶음 하나를 중첩까지 펼친다 — 쪽수 없는 같은 이벤트로 감싸 collectCommands 의 걷기를 그대로 쓴다.
  const flat = (list: readonly Command[]) => collectCommands([{ ...event, pages: [], commands: [...list] }]);
  const lists = event.pages?.length ? event.pages.map((p) => p.commands) : [event.commands];
  const hasDeath = (list: readonly Command[]) => flat(list).some(isDeath);
  if (lists.length > 1 && lists.some(hasDeath)) {
    for (const list of lists) {
      const all = flat(list);
      if (!all.some(isDeath) && all.some((c) => c.kind === 'text' || tintFamily(c) !== undefined || isWeather(c))) out.push(list);
    }
  }
  for (const c of collectCommands([event])) {
    if (c.kind !== 'fork') continue;
    const thenDeath = hasDeath(c.then), elseDeath = hasDeath(c.else ?? []);
    if (thenDeath !== elseDeath) out.push(thenDeath ? c.else ?? [] : c.then);
  }
  return out.filter((list) => list.length > 0).map(flat);
}

export function lintHazardEffects(project: Project): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      const commands = collectCommands([event]);
      if (!commands.some(isDeath)) continue;
      const family = commands.map(tintFamily).find((f) => f !== undefined);
      const add = (code: string, message: string) =>
        issues.push({ severity: 'warning', code: `authoring:${code}`, mapId: map.id, eventId: event.id, x: event.x, y: event.y, message });
      const hazard = family === 'heat' ? '열풍' : family === 'poison' ? '독기' : '함정';
      // 생존 분기 걷기는 색조 종류와 무관하다(다리 붕괴는 섬광·흔들림만 쓰기도 한다). 화면 효과가 없는 사망 이벤트(대화 끝 게임오버 등)는 함정이 아니다.
      const hazardous = family !== undefined || commands.some((c) => isWeather(c) || isParticle(c) || commandIdOf(c) === 'm2-048-shake-screen');
      for (const branch of hazardous ? survivalBranches(event) : []) {
        const steps = playerSteps(branch);
        if (steps < MIN_SURVIVAL_STEPS) {
          add('hazard-survival-static', `${event.id}: ${hazard} 생존(무사 통과) 분기에서 플레이어가 ${steps}칸만 움직여 제자리에 서 있는 것처럼 보입니다. moveActor{target:"player",moves:[…]}(이벤트 명령이면 moveEvent eventId:"${PLAYER_MOVE_TARGET}")로 이벤트 칸을 지나 ${MIN_SURVIVAL_STEPS}~5칸 걸어 위험 구역을 건너게 하고, 걷는 동안 색조를 되돌리고 weather none 으로 안개를 걷으세요. build_scene_setting 결과의 data.survivalWalk.moves 를 그대로 쓰면 막힌 칸이 없습니다.`);
        }
      }
      if (!family) continue;
      const particles = commands.filter(isParticle);
      const longest = Math.max(0, ...particles.map((c) => Number(fieldsOf(c).durationMs ?? 0)));
      const spots = new Set(particles.map((c) => `${fieldsOf(c).target ?? ''}:${fieldsOf(c).x ?? ''},${fieldsOf(c).y ?? ''}`));
      const weather = commands.some(isWeather);
      if (particles.length === 0) {
        add('hazard-no-particles', `${event.id}: ${hazard} 사망 연출인데 입자가 없고 화면색만 바꿉니다. 위험의 원천이 보이도록 particles(${family === 'heat' ? 'fire' : 'smoke'})를 최고 연출 순간에 겹치세요.`);
      } else if (longest < MIN_VISIBLE_PARTICLE_MS && spots.size < 2) {
        add('hazard-weak-particles', `${event.id}: ${hazard} 입자가 ${longest}ms·한 곳뿐이라 정지 화면에 거의 안 잡힙니다. durationMs ${MIN_VISIBLE_PARTICLE_MS} 이상으로 늘리거나 서로 다른 칸 2곳 이상에 쏘세요.`);
      }
      if (family === 'poison' && !weather) {
        add('hazard-no-fog', `${event.id}: 독안개 연출에 안개가 없습니다. weather{weather:"fog"}(장면 끝에 none 으로 되돌림)를 함께 깔면 «피어오르는 안개» 로 읽힙니다.`);
      }
    }
  }
  return issues;
}
