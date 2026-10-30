// 게임 청사진 — 조수가 게임 하나를 짓기 «전에» 쓰는 설계 한 장(2026-10-28 스위트·청사진 방식).
//
// 왜: 게임마다 플레이 판정에서 나온 결함을 사후 검사로 하나씩 막아 왔는데(LEDGER J45~J106), 설계 단계가 없어 같은 종류의
// 결함(엔딩까지 가는 길이 끊김·조건을 켜는 곳이 없음·목표를 모름)이 장르마다 되풀이됐다. 청사진은
//  - 짓기 전에 목표·핵심 경로(장소 → 할 일 → 조건 → 다음 장소)·엔딩·장면마다 의도한 느낌을 적고,
//  - 짓는 동안 모델 지시문 맨 위에 박혀 매 차례 대조되며,
//  - 출하 검사가 이 경로를 데이터로 걸어 본다(src/ai/v2/blueprint.ts).
// 판정자(새 플레이어)는 이 문서의 playerGoal 한 줄만 받는다.
// 프로젝트에 함께 저장된다(SQLite current_json·내보내기). 옛 프로젝트는 없음 = 옛 동작.
import { assert, requireArray, requireRecord, requireString } from "./io/guards";

export interface GameBlueprintStep {
  /** s1, s2 … 순서대로. */
  id: string;
  /** 맵 이름(지을 이름 그대로). */
  place: string;
  /** 그 맵 위 이벤트 이름 — 플레이어가 말을 걸거나 조사하는 대상. */
  event: string;
  /** 플레이어가 하는 일(「서연에게 말을 건다」). */
  action: string;
  /** 이 단계가 열리는 조건(사람 말, 첫 단계는 생략). */
  needs?: string;
  /** 이 단계가 남기는 것 — 다음 단계를 여는 열쇠·스위치·호감, 마지막은 엔딩. */
  gives: string;
  /** 이 장면에서 의도한 느낌(설렘·긴장·안도…). */
  feeling: string;
}

export interface GameBlueprint {
  version: 1;
  title: string;
  genre: string;
  /** 판정자가 받는 유일한 글 — 새 플레이어에게 «무엇을 하면 되는지» 한 줄. */
  playerGoal: string;
  /** 핵심 경로(시작 → 엔딩) 2~12단계. */
  steps: GameBlueprintStep[];
  ending: { name: string; how: string; feeling: string };
  /** 청사진을 쓴 요청 원문(앞부분). */
  request?: string;
  updatedAt?: string;
}

export const BLUEPRINT_LIMITS = { steps: 12, minSteps: 2, text: 160, goal: 140, request: 600 } as const;

function bounded(label: string, value: unknown, max: number): string {
  const text = requireString(label, value).trim();
  assert(text.length > 0, `청사진 ${label} 이 비었다.`);
  assert(text.length <= max, `청사진 ${label} 이 너무 길다(${text.length}자 > ${max}자).`);
  return text;
}

// needs·gives 를 배열(또는 배열을 JSON 글로 감싼 것 — 「[\"첫 번째 단서\"]」·「[]」)로 보내는 모델이 있다(2026-10-28 mt3 argon escape:
// 잠긴 책장이 「[]이(가) 있어야 할 것 같다.」, 단서가 「『[\"첫 번째 단서\"]』을(를) 알아냈다.」로 화면에 그대로 나왔다).
// 사람 말 한 줄로 푼다: 항목은 「, 」로 잇고, 빈 배열은 없음(undefined).
export function blueprintListText(value: unknown): unknown {
  let v = value;
  if (typeof v === "string") {
    const t = v.trim();
    if (/^\[[\s\S]*\]$/u.test(t)) { try { v = JSON.parse(t); } catch { return value; } }
    else return value;
  }
  if (!Array.isArray(v)) return value;
  const parts = v.map((x) => (typeof x === "string" ? x.trim() : typeof x === "number" ? String(x) : "")).filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

/** 저장본·모델 입력 둘 다 이 한 곳으로 읽는다. 틀리면 무엇이 틀렸는지 한국어로 던진다. */
export function normalizeGameBlueprint(value: unknown): GameBlueprint {
  const data = requireRecord("gameBlueprint", value);
  assert(data.version === undefined || data.version === 1, "청사진 버전을 읽을 수 없다.");
  const rawSteps = requireArray("gameBlueprint.steps", data.steps);
  assert(rawSteps.length >= BLUEPRINT_LIMITS.minSteps && rawSteps.length <= BLUEPRINT_LIMITS.steps, `청사진 steps 는 ${BLUEPRINT_LIMITS.minSteps}~${BLUEPRINT_LIMITS.steps}단계여야 한다(지금 ${rawSteps.length}).`);
  const seen = new Set<string>();
  const steps = rawSteps.map((raw, i): GameBlueprintStep => {
    const s = requireRecord(`steps[${i}]`, raw);
    const id = s.id === undefined ? `s${i + 1}` : bounded(`steps[${i}].id`, s.id, 12);
    assert(!seen.has(id), `청사진 단계 id 「${id}」가 겹친다.`);
    seen.add(id);
    const needsRaw = blueprintListText(s.needs);
    const givesRaw = blueprintListText(s.gives) ?? s.gives;
    return {
      id,
      place: bounded(`steps[${i}].place`, s.place, 60),
      event: bounded(`steps[${i}].event`, s.event, 60),
      action: bounded(`steps[${i}].action`, s.action, BLUEPRINT_LIMITS.text),
      ...(needsRaw === undefined || needsRaw === null || (typeof needsRaw === "string" && !needsRaw.trim()) ? {} : { needs: bounded(`steps[${i}].needs`, needsRaw, BLUEPRINT_LIMITS.text) }),
      gives: bounded(`steps[${i}].gives`, givesRaw, BLUEPRINT_LIMITS.text),
      feeling: bounded(`steps[${i}].feeling`, s.feeling, 60),
    };
  });
  const ending = requireRecord("gameBlueprint.ending", data.ending);
  return {
    version: 1,
    title: bounded("title", data.title, 60),
    genre: bounded("genre", data.genre, 40),
    playerGoal: bounded("playerGoal", data.playerGoal, BLUEPRINT_LIMITS.goal),
    steps,
    ending: { name: bounded("ending.name", ending.name, 60), how: bounded("ending.how", ending.how, BLUEPRINT_LIMITS.text), feeling: bounded("ending.feeling", ending.feeling, 60) },
    ...(typeof data.request === "string" && data.request.trim() ? { request: data.request.trim().slice(0, BLUEPRINT_LIMITS.request) } : {}),
    ...(typeof data.updatedAt === "string" ? { updatedAt: data.updatedAt } : {}),
  };
}

/** 지시문 맨 위에 박는 청사진 글(매 차례 같은 모양). */
export function gameBlueprintText(blueprint: GameBlueprint): string {
  return [
    `[이 게임의 청사진 — 짓는 모든 단계는 이 문서의 항목 하나를 구현한다. 바꾸려면 write_blueprint 로 다시 쓴다]`,
    `제목: ${blueprint.title} · 장르: ${blueprint.genre}`,
    `플레이어 목표(새 플레이어가 받는 유일한 안내): ${blueprint.playerGoal}`,
    "핵심 경로:",
    ...blueprint.steps.map((s) => `- ${s.id} 「${s.place}」 이벤트 「${s.event}」: ${s.action}${s.needs ? ` (조건: ${s.needs})` : ""} → ${s.gives} · 느낌: ${s.feeling}`),
    `엔딩 「${blueprint.ending.name}」: ${blueprint.ending.how} · 느낌: ${blueprint.ending.feeling}`,
  ].join("\n");
}
