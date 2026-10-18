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
      const family = commands.map(tintFamily).find((f) => f !== undefined);
      const add = (code: string, message: string) =>
        issues.push({ severity: 'warning', code: `authoring:${code}`, mapId: map.id, eventId: event.id, x: event.x, y: event.y, message });
      const hazard = family === 'heat' ? '열풍' : family === 'poison' ? '독기' : '함정';
      const hazardous = family !== undefined || commands.some((c) => isWeather(c) || isParticle(c) || commandIdOf(c) === 'm2-048-shake-screen');
      const lines = commands.flatMap((c) => (c.kind === 'text' ? [c.body] : [])).join(' ');
      const tileChanged = commands.some((c) => c.kind === 'changeTile');
      // 2026-10-18 jrpg_002(45점): 조건 분기 함정인데 사망·붕괴가 통째로 빠져 «다리 붕괴와 사망 모션이 없다» 로 떨어졌다.
      const conditional = (event.pages?.length ?? 0) > 1 || commands.some((c) => c.kind === 'fork');
      if (family !== undefined && conditional && !commands.some(isDeath)) {
        add('hazard-missing-gameover', `${event.id}: ${hazard} 조건부 함정인데 어느 분기에도 게임오버가 없습니다. 요청이 사망을 말하면 실패 분기 끝에 look{target:"player",pose:"fallen"} → gameOver 를 넣으세요.`);
      }
      if (hazardous && /다리|붕괴|무너/u.test(lines) && !tileChanged) {
        add('hazard-collapse-missing-tile-change', `${event.id}: 붕괴를 말하지만 바뀌는 타일이 없어 다리가 온전히 보입니다. 사망 분기에서 build_scene_setting 결과 data.collapse.cells 를 changeTile{mapId,layer:"upper",x,y,tile} 로 적용하세요.`);
      }
      // 2026-10-18 jrpg_046(48점): 성검을 뽑는다고 말하는데 칼이 바위에 그대로였다.
      const swordScene = /검|칼|sword/iu.test(lines) && /뽑|치켜|들어\s*올/u.test(lines);
      if (swordScene && !tileChanged) {
        add('shrine-sword-not-pulled', `${event.id}: 검을 뽑는 장면인데 바위의 칼 칸이 그대로라 뽑힌 것이 보이지 않습니다. 섬광·흔들림·효과음·sparkle 과 함께 build_scene_setting 결과 data.swordPull.cells 를 changeTile 로 적용하세요.`);
      }
      // 2026-10-18 jrpg_046(48점 «검을 치켜드는 동작 누락»): 칼을 바위에서 지우기만 하면(changeTile 1번) 칼이 사라질 뿐 인물이 든 모습이
      // 없다. 캐릭터 도트에 검을 든 자세가 없으므로 칼 그림을 인물 머리 위 칸에 다시 찍어야(changeTile 2번째) 치켜든 것으로 읽힌다.
      if (swordScene && /치켜|들어\s*올|높이/u.test(lines) && commands.filter((c) => c.kind === 'changeTile').length < 2) {
        add('shrine-sword-not-raised', `${event.id}: «치켜들었다» 고 말하지만 칼이 바위에서 사라지기만 하고 인물 손에 보이지 않습니다. 인물을 정면(turn down)으로 돌리고 build_scene_setting 결과 data.swordPull.raise 를 changeTile 로 찍어 머리 위 칸에 칼을 솟게 한 뒤, sparkle + 금빛 색조 + 치켜드는 대사를 같은 순간에 두세요.`);
      }
      // 2026-10-18 jrpg_046(45점 «개구리 기사가 남쪽으로 이탈하고 검만 허공에 떠 있음»): NPC moveEvent 의 jump{dx:0,dy:0} 는 바라보는 방향으로
      // 2칸 점프하므로 인물이 성검(data.swordPull.raise) 밑에서 벗어나 버린다.
      if (
        swordScene
        && commands.some(
          (c) =>
            c.kind === 'moveEvent'
            && c.eventId !== PLAYER_MOVE_TARGET
            && c.route.moves.some((m) => m.kind === 'jump' || m.kind === 'move' || m.kind === 'stepForward'),
        )
      ) {
        add('shrine-sword-actor-moved', `${event.id}: 성검을 뽑는 인물에 jump 나 move 를 쓰면 인물이 2칸 이동해 머리 위에 찍힌 성검(data.swordPull.raise) 밑에서 이탈합니다. 인물 이동은 {kind:"turn",dir:"right"} 와 {kind:"turn",dir:"down"} 방향 전환만 쓰고 제자리(fixed)에 유지하세요.`);
      }
      if (!commands.some(isDeath)) continue;
      // 2026-10-18 jrpg_002(48점 «불길을 버텨내는 컷씬이 누락»): 조건 아이템·스위치 쪽이 있는데 생존 분기가 비었거나 대사가 없거나,
      // 위험 입자·색조가 대사 전에 다 꺼져 대사 화면에 «버티는 모습» 이 안 남았다.
      const conditionalPage = (event.pages ?? []).some((p) => p.conditions.some((c) => c.kind !== 'selfSwitch'));
      const survivals = hazardous ? survivalBranches(event) : [];
      if (hazardous && (conditionalPage || commands.some((c) => c.kind === 'fork')) && survivals.length === 0) {
        add('hazard-survival-static', `${event.id}: ${hazard} 조건부 함정인데 생존(무사 통과) 분기가 없거나 비어 있습니다. 조건(아이템·스위치) 페이지 또는 분기에 같은 위험 색조·입자로 시작해 버팀 대사를 치고, moveActor{target:"player"} 로 ${MIN_SURVIVAL_STEPS}~5칸 걸어 건너는 컷씬을 넣으세요(build_scene_setting 결과 data.survivalWalk.moves).`);
      }
      for (const branch of survivals) {
        const firstText = branch.findIndex((c) => c.kind === 'text');
        const enduring = branch.some((c, i) => isParticle(c) && (Number(fieldsOf(c).durationMs ?? 0) >= 3000 || (firstText >= 0 && i > firstText)));
        if (firstText >= 0 && !enduring) {
          add('hazard-survival-static', `${event.id}: ${hazard} 생존 분기의 입자가 대사 전에 모두 꺼져, 대사 화면에는 위험을 «버티는» 모습이 없습니다. 첫 대사 직전에 particles(${family === 'poison' ? 'smoke' : 'fire'}, 인물 둘레 2곳, durationMs 4500 이상, wait:false) + particles{preset:"sparkle",target:"player",durationMs:4500}(보호막)를 다시 쏘고, 색조·안개는 주인공 걷기가 끝난 뒤에 푸세요.`);
        }
        // 걷는 도중에(moveEvent wait:false 뒤 m2-058-wait-for-all-movement 앞) 색조나 안개를 먼저 끄면 통과 장면에 위험·방어 효과가 사라진다.
        const moveIdx = branch.findIndex((c) => c.kind === 'moveEvent' && c.eventId === PLAYER_MOVE_TARGET);
        const waitMoveIdx = branch.findIndex((c, i) => i > moveIdx && commandIdOf(c) === 'm2-058-wait-for-all-movement');
        const clearIdx = branch.findIndex(
          (c, i) =>
            i > moveIdx
            && ((commandIdOf(c) === 'm2-046-tint-screen' && String(fieldsOf(c).value ?? '').trim() === '')
              || (c.kind === 'setWeather' && c.weather === 'none')),
        );
        if (moveIdx >= 0 && waitMoveIdx > moveIdx && clearIdx > moveIdx && clearIdx < waitMoveIdx) {
          add('hazard-survival-static', `${event.id}: ${hazard} 생존 분기에서 주인공 이동과 동시에(parallel 안에서) 색조·안개를 해제해 통과 장면에 위험·방어 효과가 사라집니다. moveActor{target:"player",moves:data.survivalWalk.moves,wait:true} 를 단독 비트로 먼저 실행해 다 건넌 뒤에 tint neutral 과 weather none 을 실행하세요.`);
        }
      }
      // 생존 분기 걷기는 색조 종류와 무관하다(다리 붕괴는 섬광·흔들림만 쓰기도 한다). 화면 효과가 없는 사망 이벤트(대화 끝 게임오버 등)는 함정이 아니다.
      for (const branch of survivals) {
        const steps = playerSteps(branch);
        if (steps < MIN_SURVIVAL_STEPS) {
          add('hazard-survival-static', `${event.id}: ${hazard} 생존(무사 통과) 분기에서 플레이어가 ${steps}칸만 움직여 제자리에 서 있는 것처럼 보입니다. moveActor{target:"player",moves:[…],wait:true}(이벤트 명령이면 moveEvent eventId:"${PLAYER_MOVE_TARGET}")로 이벤트 칸을 지나 ${MIN_SURVIVAL_STEPS}~5칸 걸어 위험 구역을 먼저 다 건넌 뒤에 색조를 되돌리고 weather none 으로 안개를 걷으세요. build_scene_setting 결과의 data.survivalWalk.moves 를 그대로 쓰면 막힌 칸이 없습니다.`);
        }
      }
      if (!hazardous) continue;
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
