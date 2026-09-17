// 이벤트 페이지 의미론 — 시스템 프롬프트의 **예산 밖 고정 버지** 블록.
//
// 왜 예산 밖인가: 툴 능력 색인과 같은 이유다. 예산 슬라이서가 INTRO 중간에서 끊기는 소형 예산에서
// 이 블록이 사라지면 모델은 페이지를 "대사 후보 목록"으로 오해한 채 저작하고, 그 산출물은 조용히
// 죽는다(런타임이 마지막 1장만 실행하므로 나머지는 만들어도 없는 것과 같다). 존재/의미 지식은
// 상세 지침보다 우선하므로 잘려서는 안 된다.
//
// 실측 배경: 24개 작업 수칙 어디에도 "한 번에 활성인 페이지는 1장"이라는 말이 없었고, 8번 수칙은
// 오히려 "페이지를 풍부하게 구성하세요"라고 적혀 있어 다중 페이지 저작을 권장했다. 그래서
// "랜덤하게 대사 치는 NPC"가 조건 없는 페이지 4장으로 저작되고 1장만 발동했다.
export const EVENT_PAGE_SEMANTICS_BLOCK = [
  "## 이벤트 페이지 의미론(반드시 준수 — 어기면 저작물이 조용히 죽는다)",
  "- **한 이벤트에서 동시에 활성인 페이지는 정확히 1장이다.** 런타임은 페이지 목록을 **뒤에서 앞으로** 훑어 조건이 모두 참인 첫 페이지 하나만 실행하고 나머지는 무시한다 = **뒤 페이지가 앞 페이지를 덮는다**(RM2K3 규칙).",
  "- 그래서 **조건 없는 페이지를 여러 장 만들면 마지막 1장만 영원히 발동**하고 앞 장들은 죽은 데이터다. 페이지는 '대사 후보'도 '순서대로 재생되는 장면'도 아니라 **상태별 변형**이다.",
  "- 페이지 1은 조건 없는 **기본 상태**로 두고, 변화는 뒤 페이지에 '등장 조건'(conditions)을 걸어 덮어라: switch / selfSwitch / variable / item / actor / gold / timer / timePhase / season / npcActivity / friendshipAtLeast / relationshipAtLeast / battleResult / run, 그리고 복합 all·any·not. 빈 conditions = 무조건.",
  "- **랜덤 대사는 페이지로 만들지 마라.** 한 페이지 안에서 m2Command(commandId:\"m2-211-weighted-branch\", fields:{table:\"0=1\\n1=1\\n2=1\", resultVariableId:\"<변수>\"})로 0..N-1 을 뽑고, fork(kind:\"variable\", op:\"==\") 로 대사를 갈라라. 가중치는 table 의 우변이다.",
  "- **말할 때마다 다음 대사로 넘어가는 NPC**는 selfSwitch 로 단계를 올린다. **조건과 쓰기는 반드시 한 쌍이다** — 페이지 1(조건 없음) 커맨드 끝에 setSelfSwitch{key:\"A\",value:true}, 페이지 2(조건 selfSwitch A) 끝에 key \"B\" 를 넣어라. 조건만 걸고 켜는 커맨드를 빼면 그 페이지는 영원히 잠긴다(조건 없이 페이지만 늘리는 것과 똑같이 죽는다).",
  "- 새 switch/variable 은 declare_story_flag 로 먼저 등록하고, 저작 후 explain_event 로 activePageNumber 와 각 페이지의 falseConditions 를 확인해 의도한 페이지가 활성인지 검증하라.",
  "## 복잡한 NPC 저작(단편 금지)",
  "- NPC를 새로 놓을 때 **한 줄 인사만 놓고 끝내지 마라.** 상태별 페이지가 있는 NPC가 기본값이다. 사용자가 '그냥 인사만'이라고 한 경우에만 1페이지로 끝낸다.",
  "- **쓰기 전에 조회하라(툴콜을 아끼지 마라).** find_events(현재 맵)로 기존 NPC의 페이지 수·조건을 보고 → 풍부한 예는 get_event 로 페이지/커맨드를 읽고 → get_story_state 로 이미 있는 스위치/퀘스트 플래그를 재사용하고 → get_database_records 로 아이템/액터 실제 id를 잡고 → list_npc_graphics 로 외형을 고른 뒤 place_npc. 플래그·아이템·다른 NPC id를 추측 생성하지 마라.",
  "- 상태별 페이지 패턴(조건이 **서로 달라야** 산다): (1) 재방문=기본+setSelfSwitch A / selfSwitch A 페이지 (2) 퀘스트=declare_story_flag 후 기본·진행·완료 페이지 (3) 호감=characterId+changeFriendship+friendshipAtLeast 페이지 (4) 시간·계절=timePhase/season 페이지 (5) 한 만남 안의 분기 대화는 그 페이지의 choices — 페이지를 늘리지 않는다.",
  "- 페이지마다 다른 모습이 필요하면 page.graphic 을 넣고, 호감/선물을 쓰면 place_npc 에 characterId 를 명시하라. 놓은 뒤 explain_event 로 지금 활성인 페이지가 의도한 기본 페이지인지 확인하라.",
  "- **NPC 자율 이동(movement)은 생략 시 이름 아키타입으로 추론된다.** 배회형(아이·행상·떠돌이·동물·kid/dog…)→random, 추격형(추격자·매복·스토커)→approach, 대화 거점(상점 주인·문지기·간판)→fixed, 모호하면 fixed. 추론 결과는 warnings에 기록된다. 의도와 다르면 movement를 명시하라 — 명시가 추론보다 우선한다. 상점 주인·간판·스케줄 이동(set_npc_schedule/dailyRoutine) NPC는 fixed가 맞다. 배회가 필요하면 스케줄만으로 해결하지 마라 — 스케줄은 시간표 이동이고 평소 배회는 movement다.",
].join("\n");
