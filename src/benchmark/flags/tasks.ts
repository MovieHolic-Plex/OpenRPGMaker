import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import type { FlagAxisId } from "./types";

export interface FlagBenchTask {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly prompt: string;
  readonly axes: readonly FlagAxisId[];
  initialProject(): Project;
}

// 프롬프트는 "스위치를 써라" 를 절대 지시하지 않는다. 저작자가 실제로 말하는 방식대로
// **원하는 게임플레이만** 서술하고, 그 게임플레이가 상태 없이는 구현 불가능하도록 설계했다.
// AI 가 스스로 스위치/변수/self-switch 에 도달하는지가 측정 대상이기 때문이다.
export const FLAG_BENCH_TASKS: readonly FlagBenchTask[] = [
  {
    id: "smith-ore-quest",
    title: "대장장이 3단계 의뢰 NPC",
    summary: "첫 대화 → 의뢰 수락 → 광석 5개 제출 → 보상. 단계마다 대사가 달라야 한다.",
    axes: ["declaration", "naming", "registry", "pageGating", "variableUsage", "conditionalReads"],
    prompt:
      "마을 대장장이 NPC 를 만들어줘. 처음 말을 걸면 자기 소개를 하고, 두 번째로 말을 걸면 폐광에서 광석 5개를 가져와 달라고 의뢰해. " +
      "의뢰를 받은 뒤에는 말을 걸 때마다 지금까지 몇 개 모았는지 알려주고, 5개가 다 모이면 보상으로 폐광 보스 방 봉인을 풀어주면서 대사가 완전히 바뀌어야 해. " +
      "보상을 이미 받은 뒤에 다시 말을 걸면 의뢰 대사가 다시 나오면 안 돼.",
    initialProject: createBlankProject,
  },
  {
    id: "mimic-chest-trap",
    title: "미믹 상자 함정",
    summary: "열면 미믹이 튀어나와 전투. 같은 상자는 두 번 다시 미믹이 되지 않는다.",
    axes: ["scopeChoice", "pageGating", "conditionalReads", "integrity"],
    prompt:
      "던전에 미믹 상자를 3개 놔줘. 플레이어가 상자를 열면 미믹 몬스터가 튀어나와서 전투가 시작되고, 이기면 그 상자는 그냥 빈 상자로 남아야 해. " +
      "한 번 미믹이 튀어나온 상자는 다시 열어도 미믹이 안 나오고 '이미 열어본 상자다' 라고만 떠야 해. " +
      "중요한 건 상자 3개가 서로 독립적이어야 한다는 거야 — 1번 상자를 열었다고 2번, 3번 상자가 같이 열린 상태가 되면 안 돼.",
    initialProject: createBlankProject,
  },
  {
    id: "boss-phase-troop",
    title: "3페이즈 폐광 보스",
    summary: "HP 구간마다 페이즈 전환. 각 페이즈 연출은 전투당 한 번만.",
    axes: ["declaration", "naming", "variableUsage", "pageGating", "conditionalReads", "integrity"],
    prompt:
      "폐광 보스로 '광맥 골렘' 을 만들어줘. HP 가 70% 아래로 떨어지면 분노해서 '광맥이 울린다!' 대사와 함께 공격력이 오르고, " +
      "40% 아래에서는 부하 몬스터 2마리를 불러내고, 15% 아래에서는 마지막 발악 연출이 나와야 해. " +
      "각 페이즈 연출은 그 전투에서 딱 한 번만 나와야 하고, 페이즈가 되돌아가면 안 돼. 보스를 쓰러뜨리면 폐광 클리어 상태가 기록돼야 해.",
    initialProject: createBlankProject,
  },
  {
    id: "monster-hunt-counter",
    title: "슬라임 10마리 사냥 의뢰",
    summary: "누적 카운터 + 임계 보상 + 중복 수령 차단.",
    axes: ["variableUsage", "conditionalReads", "orphanFlags", "naming", "registry"],
    prompt:
      "사냥꾼 길드 접수원 NPC 를 만들어줘. 슬라임 10마리를 잡아오라는 의뢰를 주고, 필드에서 슬라임을 잡을 때마다 진행도가 올라가야 해. " +
      "접수원에게 말을 걸면 '지금 몇 마리 잡았다' 를 정확히 알려주고, 10마리를 채우면 보상 골드를 주고 의뢰 완료 처리를 해야 해. " +
      "보상은 절대 두 번 받을 수 없어야 하고, 완료 후에는 슬라임을 더 잡아도 진행도 대사가 다시 안 나와야 해.",
    initialProject: createBlankProject,
  },
  {
    id: "night-shift-guard",
    title: "밤낮 교대 경비병",
    summary: "시간대별 위치/대사 + 하루 1회 인사 + 야간 통행 허가 상태.",
    axes: ["scopeChoice", "pageGating", "declaration", "naming", "conditionalReads"],
    prompt:
      "성문 경비병 NPC 를 만들어줘. 낮에는 성문 앞에 서서 '어서 오시오' 하고, 밤에는 초소 안으로 들어가 '통행 금지다' 라며 성문을 막아야 해. " +
      "플레이어가 촌장의 통행 허가를 받아온 뒤에는 밤에도 문을 열어주고 대사가 바뀌어야 해. " +
      "그리고 경비병은 하루에 한 번만 자기 신세 한탄 대사를 하고, 같은 날 다시 말을 걸면 짧은 대사만 해야 해.",
    initialProject: createBlankProject,
  },
  {
    id: "rival-reputation",
    title: "라이벌 평판 분기 NPC",
    summary: "평판 수치가 오르내리고 3구간으로 태도가 갈린다.",
    axes: ["variableUsage", "naming", "registry", "pageGating", "conditionalReads", "orphanFlags"],
    prompt:
      "라이벌 검사 NPC 를 만들어줘. 플레이어의 선택에 따라 이 NPC 의 호감이 오르거나 내려가야 해 — 결투를 받아주면 오르고, 비웃고 지나가면 내려가. " +
      "호감이 높으면 자기 비전 검술을 가르쳐주고, 보통이면 무덤덤하게 대하고, 낮으면 시비를 걸어와. " +
      "호감은 계속 누적돼서 오르내려야 하고, 마이너스로도 갈 수 있어야 해. 최종 결전에서 이 태도가 결말에 반영돼야 해.",
    initialProject: createBlankProject,
  },
  {
    id: "three-lever-seal",
    title: "레버 3개 봉인문 퍼즐",
    summary: "레버 3개 조합 조건 + 오답 리셋 + 정답 시 문 개방.",
    axes: ["declaration", "scopeChoice", "pageGating", "conditionalReads", "integrity", "orphanFlags"],
    prompt:
      "던전에 레버 3개로 여는 봉인문을 만들어줘. 레버는 각각 켜고 끌 수 있고, 켜진 레버는 눈에 보이게 표시가 달라져야 해. " +
      "왼쪽과 오른쪽 레버만 켜고 가운데는 끈 상태가 정답이야. 정답이 되는 순간 문이 열리는 연출이 나와야 하고, " +
      "가운데 레버를 켜면 함정이 발동하면서 세 레버가 전부 초기화돼야 해. 문이 한 번 열린 뒤에는 레버를 만져도 다시 닫히지 않아야 해.",
    initialProject: createBlankProject,
  },
  {
    id: "escort-caravan",
    title: "호송 NPC 동행 퀘스트",
    summary: "동행 상태 + 맵 이동 유지 + 성공/실패 결말 분기.",
    axes: ["declaration", "naming", "registry", "pageGating", "conditionalReads", "orphanFlags", "integrity"],
    prompt:
      "상인 NPC 를 안전하게 옆 마을까지 호송하는 퀘스트를 만들어줘. 호송을 수락하면 상인이 플레이어를 따라다니기 시작하고, " +
      "다른 맵으로 넘어가도 동행 상태가 유지돼야 해. 도착지 마을에 데려가면 보상을 주고 퀘스트가 끝나. " +
      "가는 길에 상인이 몬스터에게 잡히면 퀘스트는 실패하고, 그 뒤로는 접수원이 '자네 때문에 상인이 죽었어' 라는 다른 대사를 해야 해. " +
      "성공이든 실패든 한 번 끝난 퀘스트를 다시 수락할 수는 없어야 해.",
    initialProject: createBlankProject,
  },
];
