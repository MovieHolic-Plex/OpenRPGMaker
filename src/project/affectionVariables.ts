// project/affectionVariables.ts
// 「호감 변수」 ↔ engine friendship 통일(2026-10-16 romance-fix-4 R02).
//
// 실제 Argon 연애 시험(romance-real-2): 선택지 이벤트가 「윤서연 호감도」 같은 변수(setVariable 26건)로 호감을 올렸는데
// ESC 관계 화면·호감 HUD·호감 엔딩은 engine friendship(changeFriendship/talkFriendship)만 읽어서 「아직 마음을 나눈 사람이 없어요」 였다.
// 정식 경로는 changeFriendship + characterId 다(조수 지시문도 그렇게 안내한다). 그래도 변수로 만든 프로젝트(이전 판·모델의 습관)는 깨지지 않게
// 런타임이 「인물 이름이 붙은 호감 변수」 의 변화량을 같은 인물의 engine friendship 에도 그대로 더한다(읽기 호환).
// 변화량(Δ)만 옮긴다 — 말 걸기 호감과 선택지 호감이 서로를 덮어쓰지 않는다. 변수 자체와 변수 조건은 그대로 동작한다.
import { friendshipShortName } from "@/project/friendship";
import type { Project } from "@/project/types";

const AFFECTION_WORD = /호감도?|친밀도?|애정도?|friendship|affection|affinity|favou?r/giu;
const NOISE = /[\s·\-_()[\]{}:：,/'"“”‘’의]+/gu;

/** 변수 이름이 「인물 + 호감」 모양인가. 그 인물 부분을 돌려준다(없으면 undefined). 「호감」만 있는 이름은 인물이 없다. */
export function affectionVariablePerson(name: string | undefined): string | undefined {
  const text = (name ?? "").trim();
  if (!text || !new RegExp(AFFECTION_WORD.source, "iu").test(text)) return undefined;
  const person = text.replace(AFFECTION_WORD, " ").replace(NOISE, "");
  return person.length >= 2 ? person : undefined;
}

function normalized(name: string): string {
  return friendshipShortName(name).replace(NOISE, "").toLowerCase();
}

/** 호감 키(characterId)별로 부르는 이름들 — 프로필 displayName·이벤트 이름. */
function peopleOf(project: Project): Map<string, Set<string>> {
  const people = new Map<string, Set<string>>();
  const add = (key: string | undefined, name: string | undefined): void => {
    const id = key?.trim();
    const label = name?.trim();
    if (!id || !label) return;
    (people.get(id) ?? people.set(id, new Set()).get(id)!).add(label);
  };
  for (const [key, character] of Object.entries(project.characters ?? {})) add(key, character?.displayName);
  for (const map of Object.values(project.maps ?? {})) for (const event of map.events ?? []) add(event.characterId, event.name);
  return people;
}

/** 이 이름을 가진 사람의 호감 키. 같은 이름이 서로 다른 키 둘에 걸리면 모호해 undefined. */
export function resolveAffectionPerson(project: Project, person: string): string | undefined {
  const wanted = normalized(person);
  if (wanted.length < 2) return undefined;
  const hits = new Set<string>();
  for (const [key, names] of peopleOf(project)) {
    if ([...names].some((name) => {
      const candidate = normalized(name);
      return candidate.length >= 2 && (candidate === wanted || candidate.includes(wanted) || wanted.includes(candidate));
    })) hits.add(key);
  }
  return hits.size === 1 ? [...hits][0] : undefined;
}

/** 변수 id → 호감 키. 이름이 「인물 호감」 모양이고 그 인물이 하나로 정해질 때만 들어간다. */
export function affectionVariableOwners(project: Project): ReadonlyMap<string, string> {
  const owners = new Map<string, string>();
  for (const variable of project.variables ?? []) {
    const person = affectionVariablePerson(variable.name);
    const key = person ? resolveAffectionPerson(project, person) : undefined;
    if (key) owners.set(variable.id, key);
  }
  return owners;
}

/** 호감처럼 보이는데(이름에 호감) 가리킬 인물을 못 정한 변수 — ESC·HUD 에 안 나오니 저작자가 알아야 한다. */
export function unmappedAffectionVariables(project: Project): { readonly id: string; readonly name: string }[] {
  const owners = affectionVariableOwners(project);
  return (project.variables ?? []).filter((variable) => !owners.has(variable.id) && new RegExp(AFFECTION_WORD.source, "iu").test(variable.name ?? ""))
    .map((variable) => ({ id: variable.id, name: variable.name }));
}

const runtimeOwners = new WeakMap<Project, ReadonlyMap<string, string>>();

/** 런타임 조회용(프로젝트가 플레이 중 바뀌지 않으니 한 번만 센다). */
export function affectionVariableOwner(project: Project, variableId: string): string | undefined {
  let owners = runtimeOwners.get(project);
  if (!owners) { owners = affectionVariableOwners(project); runtimeOwners.set(project, owners); }
  return owners.get(variableId);
}
