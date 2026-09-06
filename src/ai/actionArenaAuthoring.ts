import type { IntentDeclaration } from "@/ai/intentDeclaration";

// Structural input keeps this authoring module independent of the acceptance runner.
// IntentDeclaration's actionCombat targets use this same map identity contract.
type ActionArenaIntent = Pick<IntentDeclaration, "mode" | "clarify"> & {
  readonly actionCombat?: {
    readonly targets: readonly ({ readonly mapId: string } | { readonly newMapName: string })[];
  };
};

export const ACTION_ARENA_AUTHORING_RECIPE = {
  id: "action-arena",
  guide: { tool: "place_npc", option: "action-controls", count: 1 },
  steps: [
    {
      id: "inspect",
      tools: ["get_project_summary", "get_map_region", "find_events", "get_event", "list_resources", "get_database_records"],
      instruction: "기존 맵·이벤트·리소스와 actors/equipment/skills/enemies/troops를 먼저 읽는다. 시작 파티와 장비의 실제 ID를 확인하고 재사용한다. 조회 전 쓰기 금지.",
    },
    {
      id: "terrain-start",
      tools: ["create_map", "set_project_settings", "set_start_position", "set_action_combat"],
      instruction: "선언된 대상 맵에서 시작한다. 없는 맵만 만들고, 대상 맵과 게임에 이름을 붙인다. 최소 통행 지형과 안전한 시작 위치만 마련하고 system.actionCombat과 그 맵만 켠다. 다른 맵을 일괄 전환하지 않는다.",
    },
    {
      id: "enemy",
      tools: ["make_action_enemy"],
      instruction: "조회한 monsterResourceId와 actionProfile로 적을 먼저 생성/갱신한다. 아직 troopId를 참조하거나 spawn을 붙이지 않는다. 필요한 적만 만든다.",
    },
    {
      id: "troop",
      tools: ["upsert_troop"],
      instruction: "성공한 적 ID를 upsert_troop({troop:{id,name,enemyIds:[enemyId]}})으로 편성한다. 스폰은 트룹 첫 적을 쓰므로 대상 적을 첫 자리에 둔다.",
    },
    {
      id: "spawn",
      tools: ["make_action_enemy"],
      instruction: "성공한 트룹 ID로 대상 맵의 작은 통행 영역에 spawn을 붙인다. 재시도는 동일 spawn.id를 사용한다. 없는 리소스/트룹 오류는 선행 데이터를 고친 뒤 재시도한다.",
    },
    {
      id: "controls",
      tools: ["place_npc"],
      instruction: "place_npc({mapId,x,y,name,guide:'action-controls'})로 시작점 근처에 조작 안내 하나만 둔다. 키 설명을 직접 쓰거나 pages를 늘리지 않는다. 기존 안내의 명시 ID가 있으면 그대로 사용한다.",
    },
    {
      id: "combat-proof",
      tools: ["run_lint", "check_reachability", "run_action_combat_test"],
      instruction: "장식 전에 선언된 각 대상 맵에 run_action_combat_test({mapId})를 실행해 실제 액션 런타임 수락 검증을 통과한다: 이동·공격으로 적 HP 감소/처치, 적 공격으로 플레이어 피해, 회피·가드, 조작 안내 상호작용을 관찰한다. lint·도달성·필드 스폰 개수만으로 전투 성공이라 하지 않는다. run_scene_test와 simulate_battle의 턴제 결과도 액션 전투 근거가 아니다.",
    },
    {
      id: "decoration",
      tools: [],
      instruction: "전투 검증 성공 후에만 사용자가 요청한 장식을 더한다. 요청하지 않은 퀘스트·상점·보스·보상·다중 페이지 할당량을 추가하지 않는다. 변경 후 대상 전투를 다시 검증하고 실제 저장된 맵과 게임 이름으로 결과를 보고한다.",
    },
  ],
} as const;

export function selectActionArenaAuthoringRecipe(intent: ActionArenaIntent): typeof ACTION_ARENA_AUTHORING_RECIPE | null {
  return intent.mode === "create" && !intent.clarify && (intent.actionCombat?.targets.length ?? 0) > 0
    ? ACTION_ARENA_AUTHORING_RECIPE
    : null;
}

export function buildActionArenaAuthoringGuide(
  recipe: typeof ACTION_ARENA_AUTHORING_RECIPE = ACTION_ARENA_AUTHORING_RECIPE,
): string {
  return [
    "## 2D 타일 액션 RPG 저작 순서",
    ...recipe.steps.map((step, index) => `${index + 1}. ${step.instruction}`),
  ].join("\n");
}
