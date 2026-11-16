// ai/v2/story/codeLeaks.ts
// 번호 자물쇠의 답을 목표 줄·잠긴 안내에서 뺀다 — 결정적·되풀이 안전. 끝맺음 code-clues 가 부른다(모델이 지은 경로에도 돈다).
//
// 왜(2026-11-13 r3s-fun 플레이): 목표 줄이 «금고에 4271을 입력해 압력 코어를 얻는다» 였다 — 모델이 쓴 그 단계의 goal 이다.
// 번호는 플레이어가 단서에서 읽어야 한다. 빌더는 지어진 자물쇠(숫자 입력 + 정답 분기)마다 실제 답을 안다 — 낱말 표가 아니라 그 답과 견준다:
//  - 「현재 목표」 줄(objectiveChip)에 답이 들어 있으면 문장을 그 단계의 중립 목표(playerLines.stepGoal — 이름으로 지은 줄)로 바꾼다. 길 안내 꼬리는 그대로.
//  - 청사진 단계에 남긴 goal 에 답이 들어 있으면 지운다(다음에 목표 줄을 다시 지을 때 중립 줄이 선다).
//  - 자물쇠 이벤트의 잠긴 페이지(입력창이 없는 조건 없는 페이지)의 줄에 답이 들어 있으면 그 줄을 중립 안내로 바꾼다.
// 단서(쪽지·대사)와 자물쇠의 입력 뒤 글은 건드리지 않는다.
import type { GameBlueprintStep } from "@/project/gameBlueprint";
import type { Project } from "@/project/types";
import { OBJECTIVE_SURFACE } from "../judge/objectiveCommand";
import { locksOf } from "./codeClues";
import { stepGoal } from "./playerLines";

type Cmd = Record<string, unknown> & { kind?: string };
const LOCKED_LINE = "번호 자물쇠가 걸려 있다. 번호를 알아야 열 수 있을 것 같다.";

function each(node: unknown, visit: (cmd: Cmd) => void): void {
  if (Array.isArray(node)) { for (const item of node) each(item, visit); return; }
  if (!node || typeof node !== "object") return;
  visit(node as Cmd);
  for (const value of Object.values(node as Cmd)) if (value && typeof value === "object") each(value, visit);
}

/** 답이 든 목표 줄·잠긴 안내를 고친다. 고친 것 한 줄씩(없으면 빈 목록). */
export function hideLockCodes(project0: Project): { project: Project; notes: string[] } {
  const locks0 = locksOf(project0);
  if (!locks0.length) return { project: project0, notes: [] };
  const project = structuredClone(project0);
  const locks = locksOf(project).map((lock) => ({ ...lock, text: String(lock.code).padStart(lock.digits, "0") }));
  const holds = (line: unknown, code: string): boolean => typeof line === "string" && new RegExp(`(?<!\\d)${code}(?!\\d)`, "u").test(line);
  const steps = project.gameBlueprint?.steps ?? [];
  const stepOf = (eventId: string): GameBlueprintStep | undefined => steps.find((st) => st.built?.eventId === eventId || st.event === eventId);
  const notes: string[] = [];
  for (const lock of locks) {
    const step = stepOf(lock.event.id);
    const name = String((lock.event as { name?: string }).name ?? lock.event.id);
    const neutral = step ? stepGoal({ kind: step.kind, who: step.who, event: step.event, place: step.place }) : `${name}의 번호를 맞히자`;
    // 목표 줄은 그 줄이 가리키는 단계의 할 일로 바꾼다 — 자물쇠 단계의 줄이 아니다. 가리키는 단계 = 줄의 대상 이벤트(targetEventId)의 단계,
    // 없으면 줄을 건 이벤트의 다음 단계. 둘 다 없거나 그게 자물쇠 단계면 자물쇠의 중립 줄.
    // 왜(2026-11-16 확인 빌드 r7a N2): 강지기(s2)가 번호를 알려 주며 건 «수녀에게 축복을 받자 (석문 숫자: 3817)» 가 «봉인된 석문의 번호를 맞히자 (… → 대성당 · 마르타 수녀)» 로 바뀌어 수녀 단계를 건너뛰었다.
    const goalFor = (owner: { id: string; name?: string }, target: string | undefined): string => {
      const at = target ? stepOf(target) : undefined;
      const k = steps.findIndex((st) => st.built?.eventId === owner.id || st.event === owner.id || (!st.built && !!owner.name && st.event === owner.name));
      const aim = at ?? (k >= 0 ? steps[k + 1] : undefined);
      // 이름으로 지은 줄 — 모델이 쓴 goal 은 한 칸 밀려 쓰인 판이 있었다(r7a: s2 의 goal 이 s3 수녀의 할 일).
      return !aim || aim === step ? neutral : stepGoal({ kind: aim.kind, who: aim.who, event: aim.event, place: aim.place });
    };
    // 1) 목표 줄 — 게임 어디서 걸었든.
    let chips = 0;
    const lines = new Set<string>();
    for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) each(ev.pages, (cmd) => {
      const fields = cmd.fields as { surface?: string; message?: string; targetEventId?: string } | undefined;
      if (cmd.kind !== "m2Command" || fields?.surface !== OBJECTIVE_SURFACE || !holds(fields.message, lock.text)) return;
      const tail = / \([^()]*(?:입구|→|·)[^()]*\)$/u.exec(fields.message!)?.[0] ?? "";
      const line = goalFor(ev, fields.targetEventId);
      lines.add(line);
      fields.message = `${line}${holds(tail, lock.text) ? "" : tail}`;
      chips += 1;
    });
    // 2) 청사진에 남긴 goal.
    let goals = 0;
    for (const st of steps) if (st.text && holds(st.text.goal, lock.text)) { const { goal: _goal, ...rest } = st.text; st.text = rest; goals += 1; }
    // 3) 자물쇠의 잠긴 페이지.
    let locked = 0;
    for (const page of lock.event.pages ?? []) {
      const commands = (page.commands ?? []) as unknown as Cmd[];
      if ((page.conditions ?? []).length || commands.some((c) => c.kind === "inputNumber")) continue;
      for (const cmd of commands) if (cmd.kind === "text" && holds(cmd.body, lock.text)) { cmd.body = LOCKED_LINE; locked += 1; }
    }
    if (chips + goals + locked) notes.push(`「${name}」 의 답이 든 ${[chips ? `목표 줄 ${chips}곳` : "", goals ? `청사진 goal ${goals}곳` : "", locked ? `잠긴 안내 ${locked}줄` : ""].filter(Boolean).join("·")}을 번호 없는 줄로 바꿨다(«${[...(lines.size ? lines : [neutral])].join("» · «")}»)`);
  }
  return notes.length ? { project, notes } : { project: project0, notes };
}
