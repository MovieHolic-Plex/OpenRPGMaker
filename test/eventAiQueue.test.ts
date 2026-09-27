// AI 이벤트 작업함 계약: 동시 실행 상한, 칸 중복 거부, 배치 한 번 = 이벤트 하나, 그새 찬 칸은 배치 안 함.
// 생성기는 이벤트 전체(페이지·셀프 스위치 조건·모습)를 검증된 모양으로 돌려준다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseEventDraft, type EventDraft, type EventDraftResult } from "@/ai/eventDraftAuthoring";
import { EventAiQueue, type EventAiQueueDeps } from "@/editor/eventAiQueue/eventAiQueue";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameEvent, Project } from "@/project/types";

const CHEST_JSON = JSON.stringify({
  name: "보물상자",
  pages: [
    { name: "처음", graphic: "charset:tex_easyrpg_charset_object1:6", trigger: "action", priority: "same", conditions: [],
      commands: [{ kind: "text", body: "열었다.", speaker: "" }, { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 2 }, { kind: "setSelfSwitch", key: "A", value: true }] },
    { name: "빈 상자", graphic: "charset:tex_easyrpg_charset_object1:6", trigger: "action", priority: "same",
      conditions: [{ kind: "selfSwitch", key: "A", value: true }], commands: [{ kind: "text", body: "비어 있다.", speaker: "" }] },
  ],
});

describe("parseEventDraft", () => {
  it("이벤트 한 개 전체를 페이지·조건·모습까지 받는다", () => {
    const project = createBlankProject();
    const parsed = parseEventDraft(project, project.startMapId, CHEST_JSON);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.draft.title).toBe("보물상자");
    expect(parsed.draft.event.pages).toHaveLength(2);
    expect(parsed.draft.event.pages?.[1]?.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: true }]);
    expect(parsed.draft.event.pages?.[0]?.graphic.sprite?.id).toBe("tex_easyrpg_charset_object1");
    expect(parsed.draft.pages[0]?.triggerLabel).toBe("조사하면");
  });

  it("없는 아이템·없는 모습은 자가수정이 읽을 오류로 돌려준다", () => {
    const project = createBlankProject();
    const bad = JSON.stringify({ name: "상자", pages: [{ graphic: "charset:nope:0", trigger: "action", commands: [] }] });
    const parsed = parseEventDraft(project, project.startMapId, bad);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.join(" ")).toContain("모습 목록에 없습니다");
    const badItem = JSON.stringify({ name: "상자", pages: [{ graphic: "none", commands: [{ kind: "changeItem", itemId: "item_missing", op: "+=", amount: 1 }] }] });
    const second = parseEventDraft(project, project.startMapId, badItem);
    expect(second.ok).toBe(false);
  });
});

function draftFor(prompt: string): EventDraftResult {
  const project = createBlankProject();
  const parsed = parseEventDraft(project, project.startMapId, CHEST_JSON);
  if (!parsed.ok) throw new Error("fixture");
  return { ...parsed.draft, title: prompt, attempts: 1 };
}

describe("EventAiQueue", () => {
  let project: Project;
  let running = 0;
  let peak = 0;
  let release: (() => void)[] = [];
  let placed: GameEvent[] = [];

  function deps(): EventAiQueueDeps {
    return {
      getProject: () => project,
      loadConfig: () => ({ model: "m", authMode: "chatgpt" }) as never,
      generate: async ({ request }) => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise<void>((resolve) => release.push(resolve));
        running -= 1;
        return draftFor(request.prompt);
      },
      place: (job, draft: EventDraft) => {
        const map = project.maps[job.mapId]!;
        if (map.events.some((event) => event.x === job.x && event.y === job.y)) return null;
        const event = { ...draft.event, id: "ev_" + job.id, x: job.x, y: job.y } as GameEvent;
        map.events.push(event);
        placed.push(event);
        return event.id;
      },
    };
  }

  beforeEach(() => {
    project = createBlankProject();
    store.replace(project);
    running = 0;
    peak = 0;
    release = [];
    placed = [];
  });

  afterEach(() => {
    for (const resolve of release) resolve();
  });

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("동시 실행 수를 넘지 않고, 끝나는 대로 다음 것을 시작한다", async () => {
    const queue = new EventAiQueue(deps());
    queue.setConcurrency(3);
    for (let index = 0; index < 8; index += 1) queue.enqueue(project.startMapId, index, 2, "상자 " + index);
    await flush();
    expect(queue.counts().running).toBe(3);
    expect(queue.counts().queued).toBe(5);
    release.shift()?.();
    await flush();
    await flush();
    expect(queue.counts().ready).toBe(1);
    expect(queue.counts().running).toBe(3);
    while (release.length) { release.shift()?.(); await flush(); await flush(); }
    expect(queue.counts().ready).toBe(8);
    expect(peak).toBe(3);
  });

  it("같은 칸·이벤트가 있는 칸에는 부탁을 받지 않는다", () => {
    const queue = new EventAiQueue(deps());
    project.maps[project.startMapId]!.events.push({ id: "ev_existing", x: 1, y: 1, trigger: { kind: "action" }, commands: [] });
    expect(queue.enqueue(project.startMapId, 1, 1, "상자")).toBeNull();
    expect(queue.enqueue(project.startMapId, 2, 1, "상자")).not.toBeNull();
    expect(queue.enqueue(project.startMapId, 2, 1, "상자")).toBeNull();
  });

  it("모두 배치는 확인 대기만 배치하고, 그새 찬 칸은 막힘으로 돌린다", async () => {
    const queue = new EventAiQueue(deps());
    const a = queue.enqueue(project.startMapId, 3, 3, "a")!;
    const b = queue.enqueue(project.startMapId, 4, 3, "b")!;
    queue.enqueue(project.startMapId, 5, 3, "c");
    await flush();
    release.shift()?.();
    release.shift()?.();
    await flush();
    await flush();
    // 사람이 b 칸에 먼저 이벤트를 놓았다.
    project.maps[project.startMapId]!.events.push({ id: "ev_human", x: 4, y: 3, trigger: { kind: "action" }, commands: [] });
    expect(queue.placeAllReady()).toBe(1);
    expect(queue.get(a.id)?.state).toBe("placed");
    expect(queue.get(b.id)?.state).toBe("failed");
    expect(queue.counts().running).toBe(1);
    expect(placed).toHaveLength(1);
  });

  it("버리면 진행 중 호출의 결과를 받지 않는다", async () => {
    const queue = new EventAiQueue(deps());
    const job = queue.enqueue(project.startMapId, 6, 6, "a")!;
    await flush();
    queue.discard(job.id);
    release.shift()?.();
    await flush();
    expect(queue.list()).toHaveLength(0);
  });
});
