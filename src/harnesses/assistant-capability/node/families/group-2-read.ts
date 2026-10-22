import type { Project } from '../../../../project/types';
import { runTool } from '../../../../editor/tools/toolRunner';
import { MAP, called, fail, pass } from '../matrixNativeSpec';
import { strArg, type Family } from './types';
import { G2, prepareGroup2, readVerdict } from './group-2-shared';

const unusedSwitches: Family = {
  id: 'unused-switches',
  area: 'read',
  mode: 'read',
  title: '쓰이지 않는 스위치 찾기',
  readTools: ['find_switch_usage'],
  variants: [
    { key: 'sw-unused', prompt: '지금 아무 데도 쓰이지 않는 스위치가 있어? 이름으로 알려 줘.', args: { switchId: 'sw_unused' } },
    { key: 'orphan', prompt: '한 번도 참조되지 않는 스위치 하나만 짚어 주세요.', args: { switchId: G2.switches.orphan } },
    { key: 'old-gate', prompt: '옛 성문 스위치, 어디서 쓰여? 안 쓰이면 그렇다고 해.', args: { switchId: G2.switches.oldGate } },
    { key: 'draft-terse', prompt: '미사용 스위치 목록 — 초안 스위치 포함?', args: { switchId: G2.switches.draft } },
    { key: 'explained', prompt: '이 프로젝트에서 이벤트·커먼 이벤트 어디에서도 조건이나 명령으로 쓰이지 않는 스위치를 찾아 이름을 알려 주세요.', args: { switchId: G2.switches.orphan } },
  ],
  prepare: prepareGroup2,
  judge(input, args) {
    const switchId = strArg(args, 'switchId');
    return readVerdict(input, switchId, () => {
      const defined = ((input.before as any).switches ?? []).find((entry: any) => entry.id === switchId);
      const name = String(defined?.name ?? '');
      const named = input.answer.includes(switchId) || (name.length > 0 && input.answer.includes(name));
      return named ? pass(`미사용 스위치 ${switchId}${name ? `(${name})` : ''} 지목`) : fail(`${switchId}${name ? `(${name})` : ''} 를 이름으로 지목하지 않았다`);
    });
  },
  reference(_project: Project, args) {
    const switchId = strArg(args, 'switchId');
    return `${switchId} 스위치는 어떤 이벤트·커먼 이벤트에서도 조건이나 명령으로 쓰이지 않는 미사용 스위치입니다.`;
  },
  wrongs(_project, args) {
    const switchId = strArg(args, 'switchId');
    const other = switchId === 'sw_unused' ? 'sw_ember_q1_started' : 'sw_unused';
    return [
      '쓰이지 않는 스위치는 없습니다. 모든 스위치가 어딘가에서 참조되고 있습니다.',
      `${other} 스위치가 미사용입니다.`,
      '스위치 목록을 확인하려면 데이터베이스 탭을 열어 주세요.',
    ];
  },
};

const reachable = (project: Project, from: { x: number; y: number }, to: { x: number; y: number }): boolean => {
  // check_reachability is a read tool: runTool hands it the project as-is and never drafts a copy,
  // so cloning the 30k-tile document here would only cost time.
  const context: any = { project, currentMapId: MAP, assistantRun: false };
  const result: any = runTool(context, 'check_reachability', { mapId: MAP, from, targets: [to] });
  if (!result.ok) throw new Error(`check_reachability 실패: ${result.summary}`);
  return Boolean(result.data?.reachable);
};

// 「막힌 칸은 없습니다」는 도달 가능 주장이지 막힘 주장이 아니다. 부정 문구를 먼저 걷어낸 뒤 판정한다.
const NEGATED_BLOCKAGE = /(막힌|막힘|막혀)\s*(칸|곳|데|부분|것)?\s*(은|는|이|가|도)?\s*(없|않)/gu;
const says = {
  reachable: /도달\s*가능|도달할 수 있|갈 수 있|걸어\s*갈 수 있|이동 가능/u,
  blocked: /도달\s*불가|도달할 수 없|갈 수 없|걸어\s*갈 수 없|이동 불가|막혀 있|막혀 있어|막힘/u,
};
const claims = (answer: string) => {
  const text = answer.replace(NEGATED_BLOCKAGE, ' ');
  return { reachable: says.reachable.test(text), blocked: says.blocked.test(text) };
};

const walkabilityCheck: Family = {
  id: 'walkability-check',
  area: 'read',
  mode: 'read',
  title: '도달 가능 여부 확인',
  readTools: ['check_reachability', 'get_map_region'],
  variants: [
    { key: 'east-door', prompt: '시작 지점 (8,8)에서 동쪽 문 (20,8)까지 걸어갈 수 있어?', args: { from: { x: 8, y: 8 }, to: { x: 20, y: 8 } } },
    { key: 'south-gate', prompt: '(8,8)에서 남쪽 출입구 (12,17)까지 갈 수 있는지 확인해 줘.', args: { from: { x: 8, y: 8 }, to: { x: 12, y: 17 } } },
    { key: 'barrels-terse', prompt: '8,8 → 3,12 도달?', args: { from: { x: 8, y: 8 }, to: { x: 3, y: 12 } } },
    { key: 'far-barrel-explained', prompt: '주인공 시작 자리에서 (21,15) 근처 통까지 걸어서 갈 수 있는지 알려 주세요. 막혀 있으면 막혔다고 해 주세요.', args: { from: { x: 8, y: 8 }, to: { x: 21, y: 15 } } },
    { key: 'gate-to-door', prompt: '남쪽 출입구에서 동쪽 문까지 걸어갈 수 있나?', args: { from: { x: 12, y: 17 }, to: { x: 20, y: 8 } } },
  ],
  judge(input, args) {
    const from = args.from as { x: number; y: number };
    const to = args.to as { x: number; y: number };
    const truth = reachable(input.before, from, to);
    return readVerdict(input, 'walkability', () => {
      if (!called(input.tools, 'check_reachability', 'run_scene_test', 'get_map_region')) return fail('도달성 검사 도구 호출이 없다');
      const { reachable: claimsReachable, blocked: claimsBlocked } = claims(input.answer);
      if (claimsReachable && claimsBlocked) return fail('도달 가능과 불가를 함께 말해 결론이 모호하다');
      if (!claimsReachable && !claimsBlocked) return fail('도달 가능 여부에 대한 결론이 없다');
      if (truth) {
        return claimsReachable ? pass(`(${from.x},${from.y}) → (${to.x},${to.y}) 도달 가능 보고`) : fail(`실제로는 (${to.x},${to.y}) 에 도달할 수 있는데 불가라고 답했다`);
      }
      return claimsBlocked ? pass(`(${from.x},${from.y}) → (${to.x},${to.y}) 도달 불가 보고`) : fail(`실제로는 (${to.x},${to.y}) 에 도달할 수 없는데 가능하다고 답했다`);
    });
  },
  reference(project, args) {
    const from = args.from as { x: number; y: number };
    const to = args.to as { x: number; y: number };
    const truth = reachable(project, from, to);
    return truth
      ? `check_reachability 로 확인했습니다. (${from.x},${from.y}) 에서 (${to.x},${to.y}) 까지 걸어서 갈 수 있습니다 — 도달 가능합니다.`
      : `check_reachability 로 확인했습니다. (${from.x},${from.y}) 에서 (${to.x},${to.y}) 로는 갈 수 없습니다 — 중간이 막혀 있어 도달 불가입니다.`;
  },
  wrongs(project, args) {
    const from = args.from as { x: number; y: number };
    const to = args.to as { x: number; y: number };
    const truth = reachable(project, from, to);
    const opposite = truth
      ? `(${to.x},${to.y}) 로는 갈 수 없습니다. 중간에 막힌 칸이 있습니다.`
      : `(${to.x},${to.y}) 까지 걸어서 갈 수 있습니다. 막힌 칸은 없습니다.`;
    return [opposite, '이 맵은 24×18 크기이고 이벤트가 여러 개 있습니다.', `(${to.x},${to.y}) 칸에는 나무가 있습니다.`];
  },
};

export const GROUP_2_READ: readonly Family[] = [unusedSwitches, walkabilityCheck];
