import { describe, expect, it } from "vitest";
import { QUICK_REPLY_MARKER } from "@/ai/interviewPrompt";
import {
  advanceWorkPlanFromTools,
  buildDefaultWorkPlan,
  completeWorkItemById,
  formatRalphContinueMessage,
  formatWorkPlanForOrchestration,
  isWorkPlanComplete,
  parseOrchestratorDecision,
  shouldRalphContinue,
  blockWorkItemById,
  reactivateBlockedWorkItems,
  canCompleteWorkItem,
  MAX_RALPH_ATTEMPTS_PER_ITEM,
  workPlanFromOrchestratorDecision,
  workPlanFromSetToolArgs,
  buildOrchestratorUserPayload,
  plannerScopePosture,
  summarizeWorkPlan,
  MAX_WORK_PLAN_AUTO_STEPS_PER_TURN,
  ORCHESTRATOR_SYSTEM_PROMPT,
} from "@/ai/workPlan";

describe("planner LLM plan parsing (no regex planning)", () => {
  it("unknown successTools remain unmet and offer repair instead of disappearing", () => {
    const plan = workPlanFromSetToolArgs({ goal: "DB 조회 후 시작점 설정", layers: [{ title: "설정", items: [{
      title: "설정", instruction: "조회하고 시작점 설정", successTools: ["get_database", "set_start_position"],
    }] }] })!;
    expect(plan.layers[0]!.items[0]!.successTools).toEqual(["get_database", "set_start_position"]);
    expect(advanceWorkPlanFromTools(plan, ["set_start_position"]).completed).toBeNull();
    expect(completeWorkItemById(plan, plan.currentItemId!, undefined, { successfulTools: ["set_start_position"] }).ok).toBe(false);
    expect(formatWorkPlanForOrchestration(plan)).toContain("Invalid tool requirements: get_database");
    const payload = buildOrchestratorUserPayload({ userText: "시작점 설정", activePlan: null });
    expect(payload).toContain("get_database_records");
    expect(payload).toContain("set_start_position");
  });

  it("parses new_plan JSON from main planner", () => {
    const raw = JSON.stringify({
      action: "new_plan",
      goal: "100x100 장터 + 30분 퀘스트",
      plannerNote: "hub then side maps then quests",
      layers: [
        {
          title: "허브",
          items: [
            {
              title: "마을 시공",
              instruction: "build_village width 100 height 100 houses 16",
              doneWhen: "100x100 hub map with houses exists",
              successTools: ["build_village"],
            },
          ],
        },
        {
          title: "퀘스트",
          items: [
            {
              title: "Q1",
              instruction: "place_npc 미르 + choices",
              doneWhen: "미르 NPC with dialogue choices",
              successTools: ["place_npc", "upsert_event"],
            },
          ],
        },
      ],
    });
    const { decision } = parseOrchestratorDecision(raw);
    expect(decision?.action).toBe("new_plan");
    if (!decision || decision.action === "direct" || decision.action === "resume") throw new Error("expected plan");
    const plan = workPlanFromOrchestratorDecision(decision);
    expect(plan.layers).toHaveLength(2);
    expect(plan.currentItemId).toBeTruthy();
    expect(summarizeWorkPlan(plan).itemsTotal).toBe(2);
    expect(formatWorkPlanForOrchestration(plan)).toContain("Worker instruction");
    expect(formatWorkPlanForOrchestration(plan)).toContain("Done when");
  });

  it("parses fenced JSON and direct action", () => {
    const fenced = "```json\n{\"action\":\"direct\",\"reason\":\"one NPC line\"}\n```";
    expect(parseOrchestratorDecision(fenced).decision).toEqual({ action: "direct", reason: "one NPC line" });
  });

  it("parses resume", () => {
    expect(parseOrchestratorDecision('{"action":"resume","reason":"user said continue"}').decision?.action).toBe("resume");
  });

  // 2026-08-23 실측: 6개 산출물을 요구한 요청에서 플래너 응답이 출력 한도로 잘려 JSON 이 깨졌고,
  // 파서가 null 을 돌려주자 세션이 무관한 장르 템플릿으로 갈아치워 축소된 결과를 성공으로 보고했다.
  it("recovers layers from a truncated planner response", () => {
    const truncated =
      '{"action":"new_plan","goal":"던전과 DB를 구성한다","layers":[' +
      '{"title":"던전","items":[{"title":"맵","instruction":"generate_map cave"}]},' +
      '{"title":"DB","items":[{"title":"적 3종","instruction":"upsert_enemy 슬라임 3종"}]},' +
      '{"title":"컷신","items":[{"title":"보스 앞","instructi';
    const { decision } = parseOrchestratorDecision(truncated);
    expect(decision?.action).toBe("new_plan");
    if (!decision || decision.action === "direct" || decision.action === "resume") throw new Error("expected plan");
    // 온전히 도착한 두 레이어는 살아야 한다 — 폴백 템플릿으로 대체되면 요청이 통째로 바뀐다.
    expect(decision.layers.map((l) => l.title)).toEqual(["던전", "DB"]);
  });

  it("reports why a planner response was rejected", () => {
    expect(parseOrchestratorDecision('{"action":"new_plan","goal":"g"}').error).toContain("layers");
    expect(parseOrchestratorDecision("not json at all").error).toContain("JSON");
    expect(parseOrchestratorDecision('{"action":"bogus"}').error).toContain("action");
  });

  it("accepts planner layer field aliases (name/steps/detail)", () => {
    const aliased = JSON.stringify({
      action: "new_plan",
      goal: "별칭 계획",
      layers: [{ name: "레이어", steps: [{ name: "항목", detail: "place_npc 상인" }] }],
    });
    const { decision } = parseOrchestratorDecision(aliased);
    if (!decision || decision.action === "direct" || decision.action === "resume") throw new Error("expected plan");
    expect(decision.layers[0]?.items[0]?.instruction).toBe("place_npc 상인");
  });

  it("builds planner user payload with active plan", () => {
    const plan = buildDefaultWorkPlan("fallback goal for payload test");
    const payload = buildOrchestratorUserPayload({
      userText: "계속",
      activePlan: plan,
      projectSummary: "maps=1",
    });
    expect(payload).toContain("User request");
    expect(payload).toContain("Active WorkPlan");
    expect(payload).toContain("use action=resume");
  });

  it("builds plan from set_work_plan tool args", () => {
    const plan = workPlanFromSetToolArgs({
      goal: "작은 숲 맵",
      layers: [
        {
          title: "맵",
          items: [{ title: "생성", instruction: "create_map 40x40 forest", successTools: ["create_map"] }],
        },
      ],
    });
    expect(plan).not.toBeNull();
    expect(plan!.goal).toBe("작은 숲 맵");
    expect(plan!.currentItemId).toBeTruthy();
  });
});

describe("workPlan progress harness", () => {
  it("advances when successTools match", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "g",
      layers: [
        {
          title: "L",
          items: [
            { title: "A", instruction: "do A", successTools: ["build_village"] },
            { title: "B", instruction: "do B", successTools: ["place_npc"] },
          ],
        },
      ],
    });
    const first = plan.currentItemId;
    const { completed, next } = advanceWorkPlanFromTools(plan, ["build_village"]);
    expect(completed?.id).toBe(first);
    expect(next?.title).toBe("B");
  });

  it("does not auto-complete a compound item until every successTool succeeded", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "실내 방을 연결한다",
      layers: [{
        title: "실내",
        items: [{
          title: "방과 전송",
          instruction: "create_map 후 create_transfer_pair",
          successTools: ["create_map", "create_transfer_pair"],
        }],
      }],
    });

    expect(advanceWorkPlanFromTools(plan, ["create_map"]).completed).toBeNull();
    expect(plan.layers[0]?.items[0]?.status).toBe("in_progress");
    expect(advanceWorkPlanFromTools(plan, ["create_map", "create_transfer_pair"]).completed?.title).toBe("방과 전송");
    expect(isWorkPlanComplete(plan)).toBe(true);
  });

  it("does not auto-complete items without successTools on unrelated writes", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "g",
      layers: [
        {
          title: "L",
          items: [
            { title: "탁자", instruction: "place_props table" },
            { title: "NPC", instruction: "place_npc", successTools: ["place_npc"] },
          ],
        },
      ],
    });
    const stuck = advanceWorkPlanFromTools(plan, ["place_npc"]);
    expect(stuck.completed).toBeNull();
    expect(stuck.next?.title).toBe("탁자");
  });

  it("completes all via completeWorkItemById", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "g",
      layers: [
        {
          title: "L",
          items: [
            { id: "a", title: "A", instruction: "a" },
            { id: "b", title: "B", instruction: "b" },
          ],
        },
      ],
    });
    expect(completeWorkItemById(plan, "a").ok).toBe(true);
    expect(completeWorkItemById(plan, "b").ok).toBe(true);
    expect(isWorkPlanComplete(plan)).toBe(true);
  });

  it("자동 완료된 항목을 모델이 다시 complete_work_item 하면 거부하지 않고 이미 끝났다고 답한다", () => {
    // 2026-09-02 실측(reports/place-concept-inn/e2e/receipt.json): place_concept 성공 → 라운드 끝
    // 자동 완료(성공 툴 집합 초기화) → 모델의 명시 complete_work_item 이 「place_concept 성공 기록이
    // 없습니다」로 거부됨 → 모델이 같은 맵을 한 번 더 시공. 이미 done 인 항목은 idempotent 여야 한다.
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "여관",
      layers: [{ title: "L", items: [{ id: "a", title: "여관 시공", instruction: "a", successTools: ["place_concept"] }] }],
    });
    const auto = advanceWorkPlanFromTools(plan, ["place_concept"]);
    expect(auto.completed?.id).toBe("a");
    const again = completeWorkItemById(plan, "a", undefined, { successfulTools: [] });
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.alreadyDone).toBe(true);
      expect(again.item.status).toBe("done");
    }
    // 아직 열려 있는 항목은 종전대로 게이트를 받는다.
    const fresh = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "여관",
      layers: [{ title: "L", items: [{ id: "a", title: "여관 시공", instruction: "a", successTools: ["place_concept"] }] }],
    });
    const refused = completeWorkItemById(fresh, "a", undefined, { successfulTools: [] });
    expect(refused.ok).toBe(false);
  });

  it("Ralph continues while plan incomplete and under cap", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "g",
      layers: [
        {
          title: "L",
          items: [
            { title: "A", instruction: "do A" },
            { title: "B", instruction: "do B" },
          ],
        },
      ],
    });
    expect(shouldRalphContinue(plan, { autoStepsUsed: 0 })).toBe(true);
    expect(shouldRalphContinue(plan, { autoStepsUsed: MAX_WORK_PLAN_AUTO_STEPS_PER_TURN })).toBe(false);
    expect(
      shouldRalphContinue(plan, {
        autoStepsUsed: 0,
        assistantText: "어떤 스타일로 할까요?",
      })
    ).toBe(true);
    expect(formatRalphContinueMessage(plan)).toContain("RALPH CONTINUE");
  });

  it("Ralph continues on a 200-char Korean question while the plan is incomplete", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "g",
      layers: [
        {
          title: "L",
          items: [
            { title: "A", instruction: "do A" },
            { title: "B", instruction: "do B" },
          ],
        },
      ],
    });
    const stem =
      "마을 광장에 상인과 NPC를 배치하고 집 지붕 타일을 맞춘 다음 퀘스트 대화를 이어서 작성하면 다음 단계로 넘어갈 수 있습니다. ";
    const koreanQuestion = `${stem}${"가".repeat(199 - stem.length)}?`;
    expect(koreanQuestion.length).toBe(200);
    expect(koreanQuestion.endsWith("?")).toBe(true);
    expect(shouldRalphContinue(plan, { autoStepsUsed: 0, assistantText: koreanQuestion })).toBe(true);
  });

  it("Ralph stops when assistant text contains QUICK_REPLY_MARKER", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "g",
      layers: [
        {
          title: "L",
          items: [
            { title: "A", instruction: "do A" },
            { title: "B", instruction: "do B" },
          ],
        },
      ],
    });
    expect(
      shouldRalphContinue(plan, {
        autoStepsUsed: 0,
        assistantText: `어떤 스타일로 할까요?\n${QUICK_REPLY_MARKER} 중세 | 현대`,
      })
    ).toBe(false);
  });

  it("Ralph stops when plan complete", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "g",
      layers: [{ title: "L", items: [{ id: "a", title: "A", instruction: "a" }] }],
    });
    expect(completeWorkItemById(plan, "a").ok).toBe(true);
    expect(shouldRalphContinue(plan, { autoStepsUsed: 0 })).toBe(false);
  });

  it("rejects complete when successTools were not used", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "g",
      layers: [
        {
          title: "L",
          items: [{ title: "탁자", instruction: "place_props table", successTools: ["place_props"] }],
        },
      ],
    });
    const id = plan.currentItemId!;
    const blocked = completeWorkItemById(plan, id, "못 함", { successfulTools: ["place_npc"] });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) throw new Error("expected fail");
    expect(blocked.reason).toContain("place_props");
    expect(plan.layers[0]!.items[0]!.status).toBe("in_progress");

    const ok = completeWorkItemById(plan, id, "done", { successfulTools: ["place_props"] });
    expect(ok.ok).toBe(true);
    expect(isWorkPlanComplete(plan)).toBe(true);
  });
  it("Ralph 는 막힌 항목에서 멈춘다 — 사용자 메시지가 되살리면 다시 돈다", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "g",
      layers: [{ title: "L", items: [{ title: "A", instruction: "do A" }, { title: "B", instruction: "do B" }] }],
    });
    const id = plan.currentItemId!;
    expect(shouldRalphContinue(plan, { autoStepsUsed: 0 })).toBe(true);

    const blocked = blockWorkItemById(plan, id, "스펙 게이트에 막힘");
    expect(blocked?.status).toBe("blocked");
    expect(blocked?.note).toBe("스펙 게이트에 막힘");
    // 막힌 항목은 현재 항목으로 남는다(다음 항목으로 조용히 넘어가지 않는다).
    expect(plan.currentItemId).toBe(id);
    expect(shouldRalphContinue(plan, { autoStepsUsed: 0 })).toBe(false);
    // 계획은 아직 미완료다 — 막힘은 완료가 아니다.
    expect(isWorkPlanComplete(plan)).toBe(false);

    expect(reactivateBlockedWorkItems(plan)).toBe(1);
    expect(plan.layers[0]!.items[0]!.status).toBe("in_progress");
    expect(shouldRalphContinue(plan, { autoStepsUsed: 0 })).toBe(true);
    // 되살릴 것이 없으면 0.
    expect(reactivateBlockedWorkItems(plan)).toBe(0);
  });

  it("이미 끝난 항목은 막히지 않는다", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "g",
      layers: [{ title: "L", items: [{ id: "a", title: "A", instruction: "a" }] }],
    });
    expect(completeWorkItemById(plan, "a").ok).toBe(true);
    expect(blockWorkItemById(plan, "a", "늦은 차단")).toBeNull();
    expect(plan.layers[0]!.items[0]!.status).toBe("done");
  });

  it("항목별 Ralph 상한은 턴 상한보다 훨씬 작다 — 교착을 사람에게 넘기는 문턱", () => {
    expect(MAX_RALPH_ATTEMPTS_PER_ITEM).toBe(3);
    expect(MAX_RALPH_ATTEMPTS_PER_ITEM).toBeLessThan(MAX_WORK_PLAN_AUTO_STEPS_PER_TURN);
  });

  it("명시 완료도 모든 필수 도구의 성공을 요구하고 산출물 검사로 대체하지 않는다", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan", goal: "모험 NPC",
      layers: [{ title: "L", items: [{ title: "NPC", instruction: "NPC와 이벤트", successTools: ["place_npc", "upsert_event"] }] }],
    });
    const item = plan.layers[0]!.items[0]!;
    const missing = canCompleteWorkItem(item, ["place_npc"], () => ({ ok: true }));
    expect(missing).toMatchObject({ ok: false, missingTools: ["upsert_event"] });
    expect(completeWorkItemById(plan, item.id, "다른 쓰기로 대체", {
      successfulTools: ["place_npc"], outcomeGate: () => ({ ok: true }),
    }).ok).toBe(false);
    expect(isWorkPlanComplete(plan)).toBe(false);
    expect(completeWorkItemById(plan, item.id, undefined, {
      successfulTools: ["place_npc", "upsert_event"], outcomeGate: () => ({ ok: false, reason: "NPC가 비었다" }),
    }).ok).toBe(false);
    expect(completeWorkItemById(plan, item.id, undefined, {
      successfulTools: ["place_npc", "upsert_event"], outcomeGate: () => ({ ok: true }),
    }).ok).toBe(true);
  });

  it("다음 항목은 현재 항목의 성공 기록으로 먼저 완료할 수 없다", () => {
    const plan = workPlanFromOrchestratorDecision({
      action: "new_plan", goal: "순서대로",
      layers: [{ title: "L", items: [
        { id: "first", title: "첫 작업", instruction: "첫 NPC", successTools: ["place_npc"] },
        { id: "second", title: "다음 작업", instruction: "다음 NPC", successTools: ["place_npc"] },
      ] }],
    });
    expect(completeWorkItemById(plan, "second", undefined, { successfulTools: ["place_npc"] }).ok).toBe(false);
    expect(plan.currentItemId).toBe("first");
    expect(plan.layers[0]!.items[1]!.status).toBe("pending");
  });

    it("requires write evidence before completing a generic planner-failure fallback", () => {
    const plan = buildDefaultWorkPlan("세 단계 퀘스트와 보상을 구성해줘", new Date("2026-08-23T00:00:00.000Z"));
    const item = plan.layers[0]!.items[0]!;

    expect(item.requiresAnyWrite).toBe(true);
    expect(completeWorkItemById(plan, item.id, undefined, { successfulTools: [] }).ok).toBe(false);
    expect(completeWorkItemById(plan, item.id, undefined, { successfulTools: ["get_project_summary"] }).ok).toBe(false);
    expect(advanceWorkPlanFromTools(plan, ["upsert_event"]).completed?.id).toBe(item.id);
    expect(isWorkPlanComplete(plan)).toBe(true);
  });
});

describe("canonical construction routing in work plans", () => {
  it("플래너 예시는 목표·정확 수량을 갖춘 공식 facade만 권장한다", () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("author_house");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("author_village");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("목표 맵");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("정확한 수량");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).not.toMatch(/build_house_kit|build_house_lots|build_village|run_village_session|run_village_pipeline/);
  });
});

describe("수정 요청 — 계획 단계에서 신축으로 새지 않는다", () => {
  const NOW = new Date("2026-08-29T00:00:00.000Z");

  it("플래너 프롬프트는 수정용 툴 어휘와 수정 레이어를 함께 제시한다", () => {
    // 옛 프롬프트의 예시 툴은 전부 생성계라, 수정 요청도 create_map/author_* 로 분해됐다.
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("paint_tiles");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("tile_erase");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("move_event");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("furnish_interior_space");
    // 수정 항목의 successTools 에는 생성툴을 넣지 말라는 지시.
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("Modify items list modify tools, never creation tools");
    // 레이어 템플릿이 신규 전용임을 밝히고, 수정용 레이어를 따로 준다.
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("greenfield");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("Repair/adjust");
    // 금지·보존 제약은 축약 예외.
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("금지·보존 제약");
    // 부정은 문자 그대로 존중한다 — 「마을은 만들지 말고 여관만」은 마을이 아니다.
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("Respect negations literally");
  });

  it("플래너 페이로드에 대상 선택 규칙이 매 턴 실린다", () => {
    const payload = buildOrchestratorUserPayload({ userText: "이 마을 담장 좀 고쳐줘", activePlan: null });
    expect(payload).toContain("Target selection");
    expect(payload).toContain("기존 산출물을 대상으로 삼는다");
    expect(payload).toContain("create_map / duplicate_map / reset_project / build_hand_interior_room");
  });

  it("targetMapId 는 계획에 저장되고 오케스트레이션 뷰에 재주입된다", () => {
    // 뷰포트 없는 자율 계속 턴에도 대상이 남아야 한다.
    const plan = workPlanFromOrchestratorDecision(
      {
        action: "new_plan",
        goal: "광장 타일 교체",
        layers: [{ title: "수정", items: [{ title: "석재 교체", instruction: "paint_tiles", doneWhen: "석재로 바뀜", successTools: ["paint_tiles"] }] }],
      },
      NOW,
      "map_ember_square",
    );
    expect(plan.targetMapId).toBe("map_ember_square");
    const view = formatWorkPlanForOrchestration(plan);
    expect(view).toContain("Target map: map_ember_square");
    expect(view).toContain("새 맵을 만들지 말고");
  });

  it("targetMapId 가 없으면 Target map 줄도 없다(신규 생성 요청)", () => {
    const plan = buildDefaultWorkPlan("새 마을 하나 만들어줘", NOW);
    expect(plan.targetMapId).toBeUndefined();
    expect(formatWorkPlanForOrchestration(plan)).not.toContain("Target map:");
  });

  it("항목 전제가 틀렸으면 set_work_plan 으로 고치라고 안내한다", () => {
    const plan = buildDefaultWorkPlan("새 마을 하나 만들어줘", NOW);
    const view = formatWorkPlanForOrchestration(plan);
    expect(view).toContain("set_work_plan");
    expect(view).toContain("but the user asked to fix an existing one");
  });

  // 실측 사례: 이 goal 이 successTools=["author_village"] 로 떨어지고, author_village 는
  // houseCount minimum 1 이라 "담장 수정" 항목이 "집 최소 1채 신축"을 완료 조건으로 가졌다.
  it("'새로 만들지는 말고' 폴백은 생성기를 강제하지 않는다", () => {
    const plan = buildDefaultWorkPlan(
      "이 마을 담장이 엉망으로 깔렸어. 새로 만들지는 말고 지금 있는 것만 손봐줘.",
      NOW,
      { modifies: true },
    );
    const item = plan.layers[0]?.items[0];
    expect(item?.successTools).toBeUndefined();
    expect(item?.requiresAnyWrite).toBe(true);
    // 폴백 지시문에 신축 금지가 동봉된다.
    expect(item?.instruction).toContain("[대상 규칙]");
    expect(item?.instruction).toContain("create_map");
  });

  it.each([
    "이 집 외벽 타일 좀 바꿔줘",
    "마을 길이 끊겼어 이어줘",
    "이 도시 광장을 좀 넓혀줘",
    "지금 있는 집들 위치만 옮겨줘",
    "이 마을 정리해줘",
  ])("수정 요청 '%s' 폴백은 author_* 를 강제하지 않는다", (goal) => {
    const item = buildDefaultWorkPlan(goal, NOW).layers[0]?.items[0];
    expect(item?.successTools).toBeUndefined();
    expect(item?.requiresAnyWrite).toBe(true);
  });
});

describe("플래너 volume 선언과 폴백 계획", () => {
  it("new_plan 의 volume 은 정수로 읽히고 direct 에는 없다", () => {
    const raw = JSON.stringify({
      action: "new_plan",
      goal: "마을",
      volume: { authoredMaps: 1, multiPageNpcs: 3, shops: 1, quests: 0 },
      layers: [{ title: "L", items: [{ title: "허브", instruction: "author_village", doneWhen: "채움", successTools: ["author_village"] }] }],
    });
    const parsed = parseOrchestratorDecision(raw);
    expect(parsed.decision && parsed.decision.action === "new_plan" ? parsed.decision.volume : null).toEqual({
      authoredMaps: 1, multiPageNpcs: 3, shops: 1, quests: 0,
    });
    const direct = parseOrchestratorDecision(JSON.stringify({ action: "direct", reason: "x" }));
    expect(direct.decision).toEqual({ action: "direct", reason: "x" });
  });

  it("플래너 프롬프트는 direct 존중·부정 존중·volume 선언을 요구하고, 코드 강제 계획을 약속하지 않는다", () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("\"volume\"");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("Respect negations");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).not.toContain("code-forced plan");
  });

  it("폴백 계획은 문장 정규식으로 시공 생성기를 강제하지 않고, 수정이면 신축 금지 지침을 동봉한다", () => {
    const village = buildDefaultWorkPlan("빈 프로젝트에 강이 있는 마을을 하나 만들고 집 8채를 지어줘. 광장과 시장도 함께 배치해줘.");
    expect(village.layers[0]!.items[0]!.successTools).toBeUndefined();
    expect(village.layers[0]!.items[0]!.requiresAnyWrite).toBe(true);
    const repair = buildDefaultWorkPlan("이 마을 담장이 엉망으로 깔렸어. 새로 만들지는 말고 지금 있는 것만 손봐줘.", new Date(), { modifies: true });
    expect(repair.layers[0]!.items[0]!.instruction).toContain("[대상 규칙]");
    expect(repair.layers[0]!.items[0]!.successTools).toBeUndefined();
  });
});

// 계획 규모 신호(2026-09-09). 짧은 신축 요청("마을을 만들어")이 1항목 계획으로 끝난 원인은
// 플래너가 "신축 다단계"라는 사실을 페이로드에서 못 봤기 때문이다. 규모를 코드가 강제하지는
// 않되(2026-09-03 폭주), 선언이 이미 계산한 mode/needsPlan 을 플래너에게 전달한다.
describe("planner scope posture (declaration-driven, not regex)", () => {
  // 깨지는 지점: mode=modify 가 decompose 로 새면 「이 마을에 상인 하나 추가」가 다시 마을을
  // 통째로 짓는다(2026-09-03 실측 93초·맵 3장). create+needsPlan 이 none 으로 새면 플래너는
  // 규모 근거를 못 받아 1항목을 계속 낸다.
  it.each([
    { name: "신축 다단계 — 분해해야 한다", intent: { mode: "create" as const, needsPlan: true }, want: "decompose-greenfield" },
    { name: "신축 단일 단계 — 신호 없음", intent: { mode: "create" as const, needsPlan: false }, want: "none" },
    { name: "수정 다단계 — 기존 산출물 보존", intent: { mode: "modify" as const, needsPlan: true }, want: "respect-existing" },
    { name: "수정 단일 단계 — 기존 산출물 보존", intent: { mode: "modify" as const, needsPlan: false }, want: "respect-existing" },
    { name: "질문 — 신호 없음", intent: { mode: "question" as const, needsPlan: true }, want: "none" },
    { name: "판단 불가 — 신호 없음", intent: { mode: "other" as const, needsPlan: true }, want: "none" },
  ])("$name", ({ intent, want }) => {
    expect(plannerScopePosture(intent)).toBe(want);
  });

  it("선언이 없으면 신호가 없다 — 폴백 선언으로 규모를 추측하지 않는다", () => {
    expect(plannerScopePosture(null)).toBe("none");
    expect(plannerScopePosture(undefined)).toBe("none");
  });

  // 깨지는 지점: buildOrchestratorUserPayload 가 intent 인자를 무시하면 유닛은 통과해도
  // 플래너는 끝까지 규모를 모른다.
  it("페이로드가 선언 자세를 플래너에게 전달한다", () => {
    const greenfield = buildOrchestratorUserPayload({
      userText: "마을을 만들어", activePlan: null, intent: { mode: "create", needsPlan: true },
    });
    expect(greenfield).toContain("posture=decompose-greenfield");
    expect(greenfield).not.toContain("posture=respect-existing");

    const repair = buildOrchestratorUserPayload({
      userText: "이 마을에 상인 하나 추가해줘", activePlan: null, intent: { mode: "modify", needsPlan: true },
    });
    expect(repair).toContain("posture=respect-existing");
    expect(repair).not.toContain("posture=decompose-greenfield");

    const unknown = buildOrchestratorUserPayload({ userText: "마을을 만들어", activePlan: null });
    expect(unknown).not.toContain("posture=");
  });
});
