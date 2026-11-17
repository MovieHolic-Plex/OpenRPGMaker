// 넷째 묶음(small-jobs-4.json «자료집 고치기»)의 판정 — 2026-11-16 자료집 적대 리뷰 B 의 오너 문장 여섯 + 목록 비우기 + 자동 전투 끄기.
// 첫 묶음과 같은 규칙: 저장 문서 전/후만 본다. 어느 도구로 했는지는 보지 않는다.
import { isDeepStrictEqual } from 'node:util';
import { referenceIndex, outsideRecord } from '../../../../editor/tools/dbReferenceIndex';
import type { Project } from '../../../../project/types';
import { no, ok, squash, valueAt, type CheckSpec, type Doc, type Result } from './checkSupport';

const rows = (doc: Doc, table: string): any[] => (table === 'commonEvents' ? doc.commonEvents : doc.database?.[table]) ?? [];
const same = (a: unknown, b: unknown): boolean => isDeepStrictEqual(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null)));
const byName = (doc: Doc, table: string, name: string): any[] => rows(doc, table).filter(row => squash(row.name) === squash(name));
/** 레코드가 쓰이는 곳(자기 자리 밖) 수. */
function uses(doc: Doc, table: string, ids: ReadonlySet<string>): Map<string, number> {
  const index = referenceIndex(doc as unknown as Project, ids);
  const out = new Map<string, number>();
  rows(doc, table).forEach((row, i) => { if (ids.has(row.id)) out.set(row.id, outsideRecord(index.get(row.id) ?? [], table === 'commonEvents' ? [table, i] : ['database', table, i]).length); });
  return out;
}
/** 지워진 id 를 아직 가리키는 자리(끊긴 참조). */
function dangling(after: Doc, gone: readonly string[]): string[] {
  if (!gone.length) return [];
  const index = referenceIndex(after as unknown as Project, new Set(gone));
  return gone.filter(id => (index.get(id) ?? []).length > 0);
}
/** 그 id 를 가리키던 자리가 모두 «지금은 없는 자료집 레코드» 안이었나. */
function onlyUsedByDeleted(before: Doc, after: Doc, id: string): boolean {
  const sites = referenceIndex(before as unknown as Project, new Set([id])).get(id) ?? [];
  return sites.every(site => {
    const p = site.path;
    if (p[0] !== 'database' || typeof p[1] !== 'string' || typeof p[2] !== 'number') return false;
    const owner = before.database?.[p[1]]?.[p[2]];
    if (owner?.id === id) return true;
    return !!owner && !rows(after, p[1]).some(row => row.id === owner.id);
  });
}
/** 배수: 바닥·천장·반올림 어느 쪽이든 받는다(1.3배 · 절반에 정수 값). */
const scaled = (from: number, factor: number, got: unknown): boolean => typeof got === 'number' && [Math.floor(from * factor), Math.ceil(from * factor), Math.round(from * factor)].includes(got);

export const DB_KINDS: Record<string, (spec: CheckSpec, before: Doc, after: Doc) => Result> = {
  /**
   * 안 쓰는 레코드 지우기: 요청 전에 아무 데서도 안 쓰던 레코드(tables)가 모두 사라지고, 쓰이던 레코드는 하나도 사라지지 않고, 끊긴 참조가 없다.
   * engine = 엔진이 이름으로 쓰는 레코드(지우지 않아도 된다).
   */
  unusedRemoved(spec, before, after) {
    const notes: string[] = [];
    let removed = 0;
    for (const table of spec.tables as string[]) {
      const ids = new Set(rows(before, table).map(row => row.id as string));
      const count = uses(before, table, ids);
      const engine = new Set<string>(spec.engine ?? []);
      const unused = [...count].filter(([id, n]) => n === 0 && !engine.has(id)).map(([id]) => id);
      const now = new Set(rows(after, table).map(row => row.id as string));
      const left = unused.filter(id => now.has(id));
      // 쓰이던 레코드를 지웠어도, 그것을 쓰던 곳이 모두 함께 지워진 레코드면 괜찮다(아이템을 지워 그 아이템만 쓰던 효과 스킬이 안 쓰는 것이 됨 — 이어 지우기).
      const lost = [...count].filter(([id, n]) => n > 0 && !now.has(id) && !onlyUsedByDeleted(before, after, id)).map(([id]) => id);
      if (!unused.length) return no(`픽스처의 ${table} 에 안 쓰는 레코드가 없다`);
      if (lost.length) return no(`${table}: 쓰이던 레코드 ${lost.length}개를 지웠다(${lost.slice(0, 4).join(', ')})`);
      if (left.length) return no(`${table}: 안 쓰는 ${unused.length}개 중 ${left.length}개가 남았다(${left.slice(0, 4).join(', ')})`);
      const broken = dangling(after, unused);
      if (broken.length) return no(`${table}: 지운 ${broken.slice(0, 4).join(', ')} 을(를) 아직 가리키는 곳이 있다`);
      removed += unused.length;
      notes.push(`${table} ${unused.length}개`);
    }
    return removed ? ok(`안 쓰는 레코드 지움: ${notes.join(', ')}`) : no('지운 것이 없다');
  },
  /** 한 표의 모든 레코드에서 칸마다 배수(fields[{path, factor}]). 레코드가 빠지거나 늘면 안 된다. */
  scaleAll(spec, before, after) {
    const was = rows(before, spec.table), now = new Map(rows(after, spec.table).map(row => [row.id, row]));
    if (now.size !== was.length) return no(`${spec.table} 수가 ${was.length} → ${now.size}`);
    const bad: string[] = [];
    for (const row of was) {
      const got = now.get(row.id);
      if (!got) { bad.push(`${row.name} 없어짐`); continue; }
      for (const field of spec.fields as Array<{ path: string; factor: number }>) {
        const from = Number(valueAt(row, field.path) ?? 0);
        if (!scaled(from, field.factor, valueAt(got, field.path))) bad.push(`${row.name}.${field.path} ${from} → ${JSON.stringify(valueAt(got, field.path))}(기대 ${from * field.factor})`);
      }
    }
    return bad.length ? no(`${bad.length}곳이 어긋났다: ${bad.slice(0, 4).join(' · ')}`) : ok(`${spec.table} ${was.length}개 모두 ${(spec.fields as any[]).map(f => `${f.path}×${f.factor}`).join(', ')}`);
  },
  /**
   * 레코드 여럿: targets[{table, name, expect?, scale?{path,factor}}] 가 모두 맞고, untouched[{table, name}] 는 그대로다.
   * 이름을 바꾸는 일이면 expect.name 으로 새 이름을 본다(옛 이름으로 찾은 레코드의 id 로 따라간다).
   */
  recordsEdited(spec, before, after) {
    const notes: string[] = [];
    for (const target of spec.targets as any[]) {
      const found = byName(before, target.table, target.name);
      if (found.length !== 1) return no(`픽스처의 ${target.table} 에 「${target.name}」이 ${found.length}개다`);
      const was = found[0], got = rows(after, target.table).find(row => row.id === was.id);
      if (!got) return no(`「${target.name}」(${was.id})이 사라졌다`);
      for (const [path, want] of Object.entries<unknown>(target.expect ?? {})) if (!same(valueAt(got, path), want)) return no(`「${target.name}」의 ${path} = ${JSON.stringify(valueAt(got, path))} — 기대 ${JSON.stringify(want)}`);
      if (target.scale && valueAt(got, target.scale.path) !== Number(valueAt(was, target.scale.path)) * target.scale.factor) return no(`「${target.name}」의 ${target.scale.path} = ${JSON.stringify(valueAt(got, target.scale.path))} — 기대 ${Number(valueAt(was, target.scale.path)) * target.scale.factor}`);
      notes.push(`${target.table} 「${target.name}」 ${[...Object.keys(target.expect ?? {}), ...(target.scale ? [target.scale.path] : [])].map(path => `${path}=${JSON.stringify(valueAt(got, path))}`).join(', ')}`);
    }
    for (const keep of (spec.untouched ?? []) as any[]) {
      for (const was of byName(before, keep.table, keep.name)) {
        const got = rows(after, keep.table).find(row => row.id === was.id);
        if (!same(got, was)) return no(`요청하지 않은 「${keep.name}」(${was.id})이 바뀌었다${got ? `(이름 ${JSON.stringify(got.name)})` : '(사라짐)'}`);
      }
    }
    return ok(notes.join(' · '));
  },
  /**
   * 주인공의 직업을 바꾸고 새 스킬 n 개를 처음부터 배우게: 주인공 직업 이름이 className 낱말 중 하나를 품고(새 직업이어도 된다), 새 스킬이 newSkills 개 이상이며
   * 그 스킬을 주인공이 레벨 1(이하)에 배운다(배우 자신의 learnedSkills 또는 직업의 learnedSkills). 있던 직업을 썼다면 그 직업의 배움표가 줄지 않는다.
   */
  classAndSkills(spec, before, after) {
    const leadId = before.system?.startActorIds?.[0];
    const lead = rows(after, 'actors').find(row => row.id === leadId), was = rows(before, 'actors').find(row => row.id === leadId);
    if (!lead || !was) return no('주인공 레코드가 없다');
    const cls = rows(after, 'classes').find(row => row.id === lead.classId);
    if (!cls) return no(`주인공의 직업 ${lead.classId} 가 자료집에 없다`);
    if (lead.classId === was.classId) return no(`주인공 직업이 그대로다(${cls.name})`);
    if (!(spec.className as string[]).some(word => String(cls.name).includes(word))) return no(`주인공 직업 「${cls.name}」 — ${(spec.className as string[]).join('/')} 가 아니다`);
    const had = new Set(rows(before, 'skills').map(row => row.id));
    const fresh = rows(after, 'skills').filter(row => !had.has(row.id));
    const atStart = new Set([...(lead.learnedSkills ?? []), ...(cls.learnedSkills ?? [])].filter((entry: any) => Number(entry.level ?? 1) <= 1).map((entry: any) => entry.skillId));
    const learned = fresh.filter(row => atStart.has(row.id));
    if (learned.length < spec.newSkills) return no(`새 스킬 ${fresh.length}개 중 주인공이 처음부터 배우는 것 ${learned.length}개 — ${spec.newSkills}개여야 한다`);
    const old = rows(before, 'classes').find(row => row.id === cls.id);
    if (old && (cls.learnedSkills?.length ?? 0) < (old.learnedSkills?.length ?? 0)) return no(`있던 직업 「${cls.name}」의 배움표가 ${old.learnedSkills.length} → ${cls.learnedSkills.length} 로 줄었다`);
    return ok(`주인공 직업 「${cls.name}」 · 새 스킬 ${learned.map(row => row.name).join(', ')}`);
  },
  /** 여러 칸이 그 값: pairs[[path, value]] — 모두 맞아야 한다. */
  fieldsEqual(spec, _before, after) {
    for (const [path, want] of spec.pairs as Array<[string, unknown]>) if (!same(valueAt(after, path), want)) return no(`${path} = ${JSON.stringify(valueAt(after, path))} — 기대 ${JSON.stringify(want)}`);
    return ok((spec.pairs as Array<[string, unknown]>).map(([path, want]) => `${path}=${JSON.stringify(want)}`).join(', '));
  },
  /**
   * 자료집 전체 다시 쓰기: tables 마다 레코드의 share 이상이 이름이 바뀌었고, 레코드가 줄지 않았고(id 그대로), 끊긴 참조가 없다.
   * 주제가 맞는지는 사람이 본다 — 기계는 «전부 고쳤나» 와 «부수지 않았나» 만 본다.
   */
  rewriteAll(spec, before, after) {
    const notes: string[] = [];
    for (const table of spec.tables as string[]) {
      const was = rows(before, table), now = new Map(rows(after, table).map(row => [row.id, row]));
      const gone = was.filter(row => !now.has(row.id)).map(row => row.id);
      if (gone.length) return no(`${table}: ${gone.length}개가 사라졌다(${gone.slice(0, 3).join(', ')})`);
      const renamed = was.filter(row => now.get(row.id)!.name !== row.name).length;
      if (renamed / Math.max(1, was.length) < spec.share) return no(`${table}: 이름이 바뀐 것 ${renamed}/${was.length} — ${Math.round(spec.share * 100)}% 이상이어야 한다`);
      notes.push(`${table} ${renamed}/${was.length}`);
    }
    return ok(`이름 바뀜 ${notes.join(', ')}`);
  },
};

/** 요청 자체가 건드리는 맵 밖 칸(부수 변경으로 세지 않는다). */
export const DB_SIDE: Record<string, (spec: CheckSpec) => RegExp> = {
  unusedRemoved: spec => new RegExp(`^database\\.(${(spec.tables as string[]).join('|')})$`, 'u'),
  scaleAll: spec => new RegExp(`^database\\.${spec.table}$`, 'u'),
  recordsEdited: spec => new RegExp(`^database\\.(${[...new Set((spec.targets as any[]).map(t => t.table))].join('|')})$`, 'u'),
  classAndSkills: () => /^database\.(actors|classes|skills)$/u,
  fieldsEqual: spec => new RegExp(`^(${[...new Set((spec.pairs as Array<[string]>).map(([path]) => path.split('.').slice(0, 2).join('\\.')))].join('|')})$`, 'u'),
  rewriteAll: () => /^database\./u,
};
