// 끝맺음 단계·기본값이 스스로 쓴 데이터베이스 칸의 기록 — 출하 관문 「[게임 검사 부작용]」이 모델이 한 일과 단계가 한 일을 가른다.
// 왜(2026-11-10 treasure 두 판, 80분 측정): 길 위 전투 예산·장르 기본값이 쓴 값(곡선·이름·그림·적 체력)을 관문이 «요청에 없는 변경» 으로 짚었고,
// 모델은 옛 값을 몰라 되돌릴 수 없어 13건이 «막힘» 으로 닫혔다. 기록은 값까지 담는다: 단계가 쓴 뒤 모델이 다른 값으로 바꾸면 그 칸은 다시 짚힌다.
import type { Project } from "@/project/types";

export type StageWrites = Map<string, string>;

type Row = Record<string, unknown>;

const STAGE_WRITE_SECTIONS = ["items", "weapons", "armors", "enemies", "skills", "classes", "actors"] as const;

export const stageWriteKey = (section: string, id: unknown, key: string): string => `${section}:${String(id)}:${key}`;

const rowsOf = (project: Project, section: string): Row[] => ((project.database as unknown as Record<string, Row[] | undefined>)[section] ?? []);

function snapshot(project: Project): Map<string, Map<string, Row>> {
  const out = new Map<string, Map<string, Row>>();
  for (const section of STAGE_WRITE_SECTIONS) {
    const rows = new Map<string, Row>();
    for (const row of rowsOf(project, section)) rows.set(String(row.id), structuredClone(row));
    out.set(section, rows);
  }
  return out;
}

/** fn 이 쓴 데이터베이스 칸을 writes 에 기록한다 — 단계 코드를 고치지 않고 모든 쓰기를 잡는다. 새로 만든 행은 «기존 데이터» 가 아니라 기록하지 않는다. */
export function recordStageWrites<T>(project: Project | (() => Project), writes: StageWrites | undefined, fn: () => T): T {
  const current = typeof project === "function" ? project : () => project;
  if (!writes) return fn();
  const before = snapshot(current());
  const result = fn();
  if (result instanceof Promise) return result.then((value) => { collect(current(), writes, before); return value; }) as T;
  collect(current(), writes, before);
  return result;
}

function collect(project: Project, writes: StageWrites, before: Map<string, Map<string, Row>>): void {
  for (const section of STAGE_WRITE_SECTIONS) {
    const old = before.get(section) ?? new Map<string, Row>();
    for (const row of rowsOf(project, section)) {
      const prev = old.get(String(row.id));
      if (!prev) continue;
      for (const key of new Set([...Object.keys(prev), ...Object.keys(row)])) {
        const was = JSON.stringify(prev[key]);
        const now = JSON.stringify(row[key]);
        if (was !== now) writes.set(stageWriteKey(section, row.id, key), now ?? "null");
      }
    }
  }
}

export function isStageWrite(writes: StageWrites | undefined, section: string, row: Row, key: string): boolean {
  if (!writes) return false;
  const recorded = writes.get(stageWriteKey(section, row.id, key));
  return recorded !== undefined && recorded === (JSON.stringify(row[key]) ?? "null");
}
