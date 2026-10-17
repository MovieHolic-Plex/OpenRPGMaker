import type { Command, Project } from '../types';
import { collectCommands } from '../mapInspection';
import type { LintIssue } from './projectLint';

/**
 * 위험지대 사망 연출(열풍·독안개 등)이 정지 화면에서도 읽히는지 보는 검토 경고.
 *
 * 왜(2026-10-16 JRPG 파일럿 20~21차): 조수가 붉은/보라 tint + 짧은 불·연기 입자(400~700ms, 플레이어 한 칸)만 쓴
 * 열풍·독안개 사망 이벤트는 «열풍이 안 보인다»·«안개가 피어오르지 않는다» 로 매번 감점됐다. tint 는 화면 색일 뿐
 * 위험의 «원천» 이 아니다. 미적 판정이 아니라 «효과가 너무 약하다» 는 알림이며 의도적 연출을 막지 않는다.
 */

const MIN_VISIBLE_PARTICLE_MS = 1000;

type Fields = Record<string, unknown>;
const fieldsOf = (c: Command): Fields => ((c as { fields?: Fields }).fields ?? {}) as Fields;
const commandIdOf = (c: Command): string => String((c as { commandId?: unknown }).commandId ?? '');

const isParticle = (c: Command) => commandIdOf(c) === 'm2-224-particle-effect' || (c.kind as string) === 'particles';
const isWeather = (c: Command) => {
  const id = commandIdOf(c);
  if (id === 'm2-050-set-weather-effects') return String(fieldsOf(c).weather ?? fieldsOf(c).value ?? 'none') !== 'none';
  if (id === 'm2-202-screen-effect' && fieldsOf(c).effect === 'weather') return String(fieldsOf(c).value ?? 'none') !== 'none';
  return (c.kind as string) === 'weather' && String((c as { weather?: unknown }).weather ?? 'none') !== 'none';
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

export function lintHazardEffects(project: Project): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      const commands = collectCommands([event]);
      if (!commands.some(isDeath)) continue;
      const family = commands.map(tintFamily).find((f) => f !== undefined);
      if (!family) continue;
      const particles = commands.filter(isParticle);
      const longest = Math.max(0, ...particles.map((c) => Number(fieldsOf(c).durationMs ?? 0)));
      const spots = new Set(particles.map((c) => `${fieldsOf(c).target ?? ''}:${fieldsOf(c).x ?? ''},${fieldsOf(c).y ?? ''}`));
      const weather = commands.some(isWeather);
      const add = (code: string, message: string) =>
        issues.push({ severity: 'warning', code: `authoring:${code}`, mapId: map.id, eventId: event.id, x: event.x, y: event.y, message });
      const hazard = family === 'heat' ? '열풍' : '독기';
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
