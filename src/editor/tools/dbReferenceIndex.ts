// 자료집 레코드 id 를 가리키는 모든 자리 — 한 번 훑어 «이 id 를 누가 쓰나» 를 경로째 돌려준다.
// 왜(2026-11-16 자료집 적대 리뷰 A F1 · B #1): 삭제 거절이 «몬스터 종족 '리프링'이 이 스킬을 배웁니다 (외 9건)» 한 줄뿐이라 조수가 나머지 9곳을
// 찾을 길이 없었고, 거절 검사(databaseRecordReferences.ts)는 고전 아홉 묶음만 봤다. 이 색인은 프로젝트 전체(맵·이벤트·시스템·자료집)의
// 문자열 값과 사전 열쇠를 한 번 훑는다 — 묶음마다 손으로 적은 목록이 아니라 실제 데이터에서 찾는다(기본 프로젝트 약 90ms).
// 타일셋·업로드 자산·리소스 프로필은 레코드 id 를 담지 않으므로 건너뛴다(그 셋이 프로젝트 글자의 97% 다). meta(용어·오프닝 책 등)는 본다 — 2026-11-16 리드 검토.
import type { Project } from "@/project/types";

export type RefPath = readonly (string | number)[];
export interface RefSite {
  /** 프로젝트 뿌리부터의 경로 — 마지막이 값이 든 칸(또는 열쇠로 쓰인 사전의 열쇠). */
  readonly path: RefPath;
  /** 열쇠로 쓰였나({stateRates:{state_x:"A"}}) — 지울 때는 그 열쇠를 뺀다. */
  readonly asKey: boolean;
}

const SKIP_ROOT = new Set(["tilesets", "assets", "resourceProfiles", "version"]);
/** 값이 같아도 id 참조가 아닌 칸 — 이름·글·종류 낱말. */
const TEXT_KEYS = new Set(["name", "nickname", "description", "message", "text", "body", "title", "label", "kind", "type", "note", "summary", "prompt", "caption"]);

/** 프로젝트에서 ids 중 하나와 같은 문자열 값·사전 열쇠가 있는 자리 전부. ids 를 비우면 모든 문자열을 색인한다(prune 용). */
export function referenceIndex(project: Project, ids?: ReadonlySet<string>): Map<string, RefSite[]> {
  const out = new Map<string, RefSite[]>();
  const add = (id: string, path: RefPath, asKey: boolean) => {
    if (ids && !ids.has(id)) return;
    const list = out.get(id);
    if (list) list.push({ path, asKey }); else out.set(id, [{ path, asKey }]);
  };
  const walk = (value: unknown, path: (string | number)[]): void => {
    if (typeof value === "string") { if (!TEXT_KEYS.has(String(path[path.length - 1]))) add(value, [...path], false); return; }
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { for (let i = 0; i < value.length; i += 1) { path.push(i); walk(value[i], path); path.pop(); } return; }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (path.length === 0 && SKIP_ROOT.has(key)) continue;
      // 사전 열쇠로 쓰인 id(stateRates·elementRates·initialEquipment 의 슬롯 아님 — 값 쪽이 id).
      if (ids?.has(key)) add(key, [...path, key], true);
      path.push(key); walk(child, path); path.pop();
    }
  };
  walk(project, []);
  return out;
}

/** 레코드 자신 안의 자리(자기 id 칸 포함)는 참조가 아니다. */
export function outsideRecord(sites: readonly RefSite[], recordPath: RefPath): RefSite[] {
  return sites.filter((site) => !recordPath.every((part, i) => site.path[i] === part));
}

/** 사람이 읽는 경로 — database.classes[3].learnedSkills[2].skillId → classes «전사»(class_warrior).learnedSkills[2].skillId. */
export function describeSite(project: Project, site: RefSite): string {
  const p = site.path;
  const at = (n: number) => p.slice(n).map((part) => (typeof part === "number" ? `[${part}]` : `.${part}`)).join("").replace(/^\./u, "");
  const recordLabel = (rec: unknown, fallback: string): string => {
    const r = rec as { id?: unknown; name?: unknown } | undefined;
    return r && typeof r.id === "string" ? `${r.name ? `«${String(r.name)}» ` : ""}(${r.id})` : fallback;
  };
  if (p[0] === "database" && typeof p[1] === "string" && typeof p[2] === "number") {
    const rec = (project.database as unknown as Record<string, unknown[]>)[p[1]]?.[p[2]];
    return `${p[1]} ${recordLabel(rec, `#${p[2]}`)} ${at(3)}`;
  }
  if (p[0] === "maps" && typeof p[1] === "string") {
    const map = project.maps[p[1]];
    if (p[2] === "events" && typeof p[3] === "number") {
      const ev = map?.events[p[3]];
      return `map «${map?.name ?? p[1]}» (${p[1]}) event ${recordLabel(ev, `#${p[3]}`)} ${at(4)}`;
    }
    return `map «${map?.name ?? p[1]}» (${p[1]}) ${at(2)}`;
  }
  if (p[0] === "commonEvents" && typeof p[1] === "number") return `common event ${recordLabel(project.commonEvents[p[1]], `#${p[1]}`)} ${at(2)}`;
  return at(0);
}

/** 이 자리가 이벤트 명령·조건 안인가(맵 이벤트 · 공용 이벤트 · 적 그룹 전투 페이지 · 전투 뒤 명령). 지우면 게임 흐름이 바뀌므로 자동으로 고치지 않는다. */
export function isScriptSite(site: RefSite): boolean {
  const p = site.path;
  if (p[0] === "commonEvents") return true;
  if (p[0] === "maps" && p[2] === "events") return true;
  return p.some((part) => part === "commands" || part === "conditions" || part === "condition" || part === "battleEventPages" || part === "afterBattle");
}
