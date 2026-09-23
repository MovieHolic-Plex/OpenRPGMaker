// editor/panels/databaseEnemyDifficulty.ts
//
// 전투 몬스터 헤더의 「파티 Lv N 기준 쉬움/보통/어려움」 추정.
//
// 숫자를 새로 지어내지 않는다 — 적 그룹 탭의 「난이도 추정」과 같은 헤드리스 전투
// 시뮬레이터(`simulateBattle`)를 이 몬스터 1마리짜리 임시 그룹으로 돌린다. 저장본은 건드리지
// 않는다(임시 그룹은 복사한 project 에만 들어간다). 파티는 시작 파티, 레벨은 몬스터 레벨이다
// — 「이 몬스터를 비슷한 레벨의 파티가 혼자 만나면」이라는 뜻이고, 여러 마리 조합은 적 그룹 탭이 잰다.
import { actorBattlers } from "@/battle/battleBattlers";
import { simulateBattle } from "@/battle/simulate";
import type { EnemyRecord, Project, TroopId } from "@/project/types";
import { uxLevel } from "@/editor/panels/databaseUxLevel";

export type EnemyDifficultyGrade = "easy" | "normal" | "hard";

export interface EnemyDifficultyEstimate {
  readonly grade: EnemyDifficultyGrade;
  readonly label: string;
  readonly partyLevel: number;
  readonly winRate: number;
  /** 전투 뒤 파티에 남은 HP 비율(0..1). */
  readonly hpLeftRatio: number;
  /** 0 = 아주 쉬움, 1 = 아주 어려움. 막대 위 표시 위치. */
  readonly score: number;
  readonly samples: number;
}

const SAMPLES = 8;
const SEED = 12345;

const GRADE_LABEL: Record<EnemyDifficultyGrade, string> = { easy: "쉬움", normal: "보통", hard: "어려움" };

/** 승률·남은 HP → 등급. 경계는 적 그룹 탭 결과(승률 %)를 사람이 읽는 방식 그대로다. */
export function classifyEnemyDifficulty(winRate: number, hpLeftRatio: number): { grade: EnemyDifficultyGrade; score: number } {
  const score = Math.min(1, Math.max(0, (1 - winRate) * 0.6 + (1 - hpLeftRatio) * 0.4));
  if (winRate < 0.5) return { grade: "hard", score: Math.max(score, 0.7) };
  if (winRate < 0.9 || hpLeftRatio < 0.5) return { grade: "normal", score: Math.min(Math.max(score, 0.35), 0.69) };
  return { grade: "easy", score: Math.min(score, 0.34) };
}

/** 시작 파티가 없거나 전투를 꾸릴 수 없으면 null — 그때는 헤더에 아무것도 쓰지 않는다. */
export function estimateEnemyDifficulty(project: Project, enemy: EnemyRecord): EnemyDifficultyEstimate | null {
  const partyActorIds = (project.system.startActorIds.length > 0 ? project.system.startActorIds : project.session.partyActorIds)
    .filter((id) => project.database.actors.some((actor) => actor.id === id));
  if (partyActorIds.length === 0) return null;
  const partyLevel = Math.max(1, Math.min(99, Math.round(enemy.level ?? 1)));
  const troopId = `troop_difficulty_probe_${enemy.id}` as TroopId;
  const probe: Project = {
    ...project,
    database: {
      ...project.database,
      enemies: project.database.enemies.some((entry) => entry.id === enemy.id)
        ? project.database.enemies.map((entry) => (entry.id === enemy.id ? enemy : entry))
        : [...project.database.enemies, enemy],
      troops: [
        ...project.database.troops,
        { id: troopId, name: enemy.name, enemyIds: [enemy.id], members: [{ enemyId: enemy.id, x: 84, y: 52 }], autoAlign: true, battleEventPages: [] },
      ],
    },
  };
  try {
    const levels = Object.fromEntries(partyActorIds.map((id) => [id, partyLevel]));
    const maxHp = actorBattlers(probe, { levels, partyActorIds: [...partyActorIds] }).reduce((sum, battler) => sum + battler.maxHp, 0);
    const outcome = simulateBattle({ project: probe, troopId, heroLevel: partyLevel, partyActorIds, n: SAMPLES, seed: SEED });
    const hpLeftRatio = maxHp > 0 ? Math.min(1, Math.max(0, outcome.avgHpRemaining / maxHp)) : 0;
    const { grade, score } = classifyEnemyDifficulty(outcome.winRate, hpLeftRatio);
    return { grade, label: GRADE_LABEL[grade], partyLevel, winRate: outcome.winRate, hpLeftRatio, score, samples: outcome.samples };
  } catch {
    return null;
  }
}

// ── 헤더 배지 ────────────────────────────────────────────────────────────────
// 모의 전투는 몬스터 하나에 수~수십 ms 라 입력마다 돌리지 않는다: 마지막 입력 250ms 뒤, 브라우저가
// 한가할 때 한 번 돌리고 같은 레코드 내용이면 캐시를 쓴다. requestIdleCallback 이 없는 환경
// (헤드리스 단위 테스트 DOM)에서는 배지를 만들지 않는다 — 계산은 위 순수 함수가 테스트한다.
const difficultyCache = new Map<string, EnemyDifficultyEstimate | null>();
let pendingEstimate: ReturnType<typeof setTimeout> | undefined;

/** 전체 다시 그리기(레코드 전환·다른 탭 편집 뒤)에서 부른다. 직업 곡선·스킬이 바뀌었을 수 있다. */
export function clearEnemyDifficultyCache(): void {
  difficultyCache.clear();
}

function difficultyKey(project: Project, enemy: EnemyRecord): string {
  return JSON.stringify([enemy, project.system.startActorIds, project.session.partyActorIds]);
}

function renderDifficulty(node: HTMLElement, estimate: EnemyDifficultyEstimate | null): void {
  if (!estimate) {
    node.hidden = true;
    node.replaceChildren();
    return;
  }
  node.hidden = false;
  node.dataset.state = "ready";
  node.dataset.grade = estimate.grade;
  const marker = document.createElement("i");
  marker.style.left = `${Math.round(estimate.score * 100)}%`;
  const bar = document.createElement("span");
  bar.className = "db-enemy-difficulty-bar";
  bar.setAttribute("aria-hidden", "true");
  bar.append(marker);
  const basis = document.createElement("span");
  basis.textContent = `파티 Lv${estimate.partyLevel} 기준`;
  const label = document.createElement("strong");
  label.textContent = estimate.label;
  const winPercent = Math.round(estimate.winRate * 100);
  const hpPercent = Math.round(estimate.hpLeftRatio * 100);
  node.title = `시작 파티가 Lv${estimate.partyLevel}일 때 이 몬스터 1마리와 ${estimate.samples}번 모의 전투: 이긴 비율 ${winPercent}%, 끝난 뒤 남은 HP ${hpPercent}%. 여러 마리 조합은 적 그룹 탭에서 잽니다.`;
  node.setAttribute("aria-label", `강도: 파티 Lv${estimate.partyLevel} 기준 ${estimate.label}`);
  // 숫자는 전문가 모드에서만(monster-ux.css). 나머지 모드는 말과 막대로 읽는다.
  const numbers = uxLevel(document.createElement("small"), "expert");
  numbers.textContent = `승률 ${winPercent}% · 남은 HP ${hpPercent}%`;
  node.replaceChildren(basis, bar, label, numbers);
}

export function enemyDifficultyBadge(enemy: EnemyRecord, project: Project): HTMLElement | null {
  if (typeof requestIdleCallback !== "function") return null;
  const node = document.createElement("div");
  node.className = "db-enemy-difficulty";
  node.dataset.testid = "db-enemy-difficulty";
  node.setAttribute("role", "status");
  const key = difficultyKey(project, enemy);
  if (difficultyCache.has(key)) {
    renderDifficulty(node, difficultyCache.get(key) ?? null);
    return node;
  }
  node.dataset.state = "pending";
  node.textContent = "강도 재는 중…";
  if (pendingEstimate !== undefined) clearTimeout(pendingEstimate);
  pendingEstimate = setTimeout(() => {
    pendingEstimate = undefined;
    requestIdleCallback(() => {
      if (!node.isConnected) return;
      const estimate = difficultyCache.has(key) ? difficultyCache.get(key) ?? null : estimateEnemyDifficulty(project, enemy);
      difficultyCache.set(key, estimate);
      renderDifficulty(node, estimate);
    }, { timeout: 1500 });
  }, 250);
  return node;
}
