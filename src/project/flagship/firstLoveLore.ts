/**
 * 「첫사랑」 이야기 탭(세계 개요·설정집·인물) 저작.
 *
 * 사실은 전부 firstLove.ts · firstLoveKit.ts · firstLoveMaps.ts 의 대사와 코드에서 왔다. 조수 도구(set_world_canon ·
 * upsert_world_codex · upsert_character_profile)만 쓰므로 몇 번을 불러도 같은 결과가 나온다.
 * 결말 갈래와 지후가 떠난 이유는 visibility "ai-hidden" 으로 두어 조수의 새 글이 미리 새지 않게 한다.
 */
import { loreExec, writeCodex, type CodexEntry, type CodexRelation, type LoreExec } from "./loreKit";
import type { Project } from "@/project/types";

const MAP = {
  platformAm: "fl_platform_am",
  platformPm: "fl_platform_pm",
  street: "fl_street",
  streetPm: "fl_street_pm",
  office: "fl_office",
  officePm: "fl_office_pm",
  officeFri: "fl_office_fri",
  rooftop: "fl_rooftop",
  konbini: "fl_konbini",
  broadcast: "fl_broadcast",
} as const;

const CANON_BODY = [
  "# 동네와 회사",
  "한결선 한결역 맞은편에 유리로 된 높은 건물이 서 있다. 늘봄 빌딩이다. 이 건물에 스튜디오 늘봄이 있다. 직원은 서른 명쯤 되는 작은 앱 회사다. 프로덕트팀은 다섯 명이고 한 명은 휴직 중이다. 팀이 만드는 앱은 하루끝이다. 밤 10시에 사연 하나와 노래 한 곡을 들려준다.",
  "# 장소",
  "아침마다 한결역 승강장에서 늘봄 빌딩 앞 거리를 지나 사무실로 들어간다. 사무실에는 프로덕트팀 자리, 화이트보드, 탕비실, 엘리베이터, 잠긴 비상계단이 있다. 엘리베이터의 R 버튼은 점심시간에만 눌린다. 그 층이 옥상이고 지후가 혼자 점심을 먹는 곳이다. 건물 맞은편에는 편의점이 있고, 퇴근길에 바나나우유 1+1을 판다. 10년 전 장소는 성하고등학교 방송실 하나다.",
  "# 사람들",
  "윤서하는 이번 주에 입사한 UX 디자이너다. 팀 사람들과 같은 책상에 앉은 지 이틀도 안 됐다. 강지후는 앱 개발 4년 차 선임이고 서하의 사수가 된다. 그리고 10년 전 금요일 점심 방송에서 사연을 읽던 선배다. 차민호는 지난주에 들어온 백엔드 신입이다. 오정민 팀장은 말은 부드럽고 보고는 정확하게 받는다. 박 본부장은 하루끝의 의뢰인 소리결에서 온다.",
  "# 10년 전",
  "서하는 성하고 2학년이었고 방송부 사연함에 매주 익명으로 편지를 넣었다. 이름은 바나나우유였다. 3학년 방송부원 지후가 금요일 점심마다 그 사연을 읽고 노래를 틀었다. 겨울의 마지막 금요일, 서하는 처음으로 본명을 적었다. 그 사연은 방송되지 못했다. 월요일에 지후의 자리는 비어 있었다. 전학이라고만 했고, 인사는 없었다.",
  "# 한 주의 흐름",
  "월요일 아침, 서하는 횡단보도에서 누군가와 부딪히고 사무실에서 그 사람을 사수로 소개받는다. 지후는 서하를 알아보지만 회사에서는 모르는 사이로 해 달라고 한다. 수요일 저녁, 서하는 소리결에 시안을 잘못 보낸 것을 알게 된다. 야근하며 파일을 고치고, 팀장에게 말할지 지후에게만 물을지 정한다. 금요일 오후 3시가 소리결 앞 발표다. 같은 날이 지후의 마지막 출근일이다. 지후는 다음 주부터 부산 지사로 간다. 막차는 한결역에서 밤 9시 40분에 떠난다.",
  "# 결말 갈래",
  "결말은 셋이다. 지후와의 호감이 충분하면 역에서 서하가 먼저 마음을 말하고 두 사람의 이야기가 이어진다. 호감이 모자라거나 이별을 고르면 늦은 답장 한 통을 받고 헤어진다. 역에 가지 않고 회식에 가면 막차를 놓치고, 밤 10시에 하루끝 사연으로 답장이 온다.",
  "# 톤",
  "회사 로맨스지만 큰 사건은 없다. 바나나우유 한 팩, 편지지 한 장, 포스트잇 한 장 같은 작은 물건이 10년을 건넨다. 말투는 가볍고 조금 쑥스럽고, 하고 싶은 말은 늘 한 박자 늦게 나온다.",
].join("\n\n");

const ENTRIES: readonly CodexEntry[] = [
  // 장소
  {
    id: "fl-place-station", type: "place", name: "한결역 승강장",
    summary: "한결선 한결역. 서하가 월요일 아침 8시 41분에 내려 첫 출근을 시작하는 곳이다.",
    body: "늘봄 빌딩 맞은편에 있는 역이다. 출근길 회사원들이 승강장에 가득하고, 서하는 여기서 계단을 올라 거리로 나간다. 같은 승강장이 금요일 밤에는 막차 장면의 무대가 된다.",
    tags: ["장소", "시작"], refs: [{ kind: "map", id: MAP.platformAm }], source: "한결역 승강장 맵",
  },
  {
    id: "fl-place-street", type: "place", name: "늘봄 빌딩 앞 거리",
    summary: "역과 회사 사이의 거리. 첫 출근 아침에 서하가 횡단보도에서 부딪히는 곳이다.",
    body: "건너편에 늘봄 빌딩의 유리벽이 보인다. 밤에는 같은 거리가 비에 젖은 채 비어 있고, 막차를 놓친 서하가 혼자 서 있는 곳이 된다.",
    tags: ["장소"], refs: [{ kind: "map", id: MAP.street }, { kind: "map", id: MAP.streetPm }], source: "늘봄 빌딩 앞 거리 맵",
  },
  {
    id: "fl-place-office", type: "place", name: "스튜디오 늘봄 사무실",
    summary: "프로덕트팀이 일하는 사무실. 월요일 소개, 수요일 야근, 금요일 발표가 모두 여기서 일어난다.",
    body: "화이트보드에는 금 15:00 소리결 하루끝 리뉴얼 발표가 적혀 있고, 개발 강지후와 디자인 윤서하(신규!)가 나란히 쓰여 있다. 엘리베이터는 R 버튼이 점심에만 눌리고, 비상계단은 막혀 있다. 지후의 책상에는 빈 바나나우유 팩이 있다. 밤의 사무실은 불이 반쯤 꺼지고 수요일에는 지후의 회색 후드가 의자에 걸려 있다.",
    tags: ["장소", "회사"], refs: [{ kind: "map", id: MAP.office }, { kind: "map", id: MAP.officePm }, { kind: "map", id: MAP.officeFri }, { kind: "event", id: "ev_fl_whiteboard" }, { kind: "event", id: "ev_fl_elev" }, { kind: "event", id: "ev_fl_stairs" }, { kind: "event", id: "ev_fl_hero_desk" }], source: "스튜디오 늘봄 맵 셋",
  },
  {
    id: "fl-place-pantry", type: "place", name: "탕비실",
    summary: "민호가 간식을 채워 두는 곳. 커피머신 버튼 두 개를 함께 누르면 라테가 나온다.",
    body: "민호는 이 방법을 우리 회사 최대 기밀이라고 소개한다. 수요일 야근이 끝나면 서하와 지후가 여기서 컵라면을 먹는다.",
    tags: ["장소", "회사"], refs: [{ kind: "map", id: MAP.office }, { kind: "event", id: "ev_fl_minho" }, { kind: "event", id: "ev_fl_w_jihu_pantry" }], source: "탕비실 장면",
  },
  {
    id: "fl-place-rooftop", type: "place", name: "늘봄 빌딩 옥상",
    summary: "점심시간에만 갈 수 있는 옥상. 지후가 난간 곁에서 혼자 점심을 먹는다.",
    body: "엘리베이터에서 R 버튼을 누르면 점심에만 열린다. 계단탑의 철문은 무겁다. 서하가 캔커피를 건네거나 바나나우유 두 개를 들고 오면 지후가 조금씩 말을 꺼낸다.",
    tags: ["장소"], refs: [{ kind: "map", id: MAP.rooftop }, { kind: "event", id: "ev_fl_jihu_roof" }, { kind: "event", id: "ev_fl_roof" }, { kind: "event", id: "ev_fl_roof_door" }], source: "옥상 장면",
  },
  {
    id: "fl-place-konbini", type: "place", name: "편의점",
    summary: "월요일 퇴근길에 서하와 지후가 마주치는 편의점. 바나나우유를 1+1로 판다.",
    body: "점원은 이 시간엔 꼭 하나씩 나간다고 말한다. 지후는 서하 손의 바나나우유를 보고 아직 그거 마시느냐고 묻는다. 서하가 10년 전 바나나우유라는 이름을 썼다는 것을 지후가 처음 입 밖에 내는 자리다.",
    tags: ["장소", "월요일"], refs: [{ kind: "map", id: MAP.konbini }, { kind: "event", id: "ev_fl_konbini_pm" }, { kind: "event", id: "ev_fl_clerk" }, { kind: "event", id: "ev_fl_cooler" }, { kind: "event", id: "ev_fl_jihu_kon" }], source: "편의점 장면",
  },
  {
    id: "fl-place-broadcast", type: "place", name: "성하고등학교 방송실",
    summary: "10년 전 방송부의 방. 금요일 점심 방송과 사연함이 있던 곳이다.",
    body: "사연함에는 방송부 사연함 금요일 점심에 읽어 드립니다라는 팻말이 붙어 있다. 회상에서 열일곱의 서하와 열아홉의 지후가 여기서 만난다. 겨울의 마지막 금요일 이후 이 방은 불이 꺼진다.",
    tags: ["장소", "과거"], refs: [{ kind: "map", id: MAP.broadcast }, { kind: "event", id: "ev_fl_flashback" }, { kind: "event", id: "ev_fl_mailbox" }, { kind: "event", id: "ev_fl_y_seoha" }, { kind: "event", id: "ev_fl_y_jihu" }], source: "회상 맵",
  },
  {
    id: "fl-place-lastrain", type: "place", name: "한결역 막차 승강장",
    summary: "금요일 밤 9시 21분의 승강장. 서울역행 9시 40분 열차가 떠나기 전 19분을 그린다.",
    body: "지후는 이 승강장에서 부산으로 떠난다. 서하는 회식 대신 여기로 달려오면 지후와 마주 선다. 안내 방송이 열차 시각을 알리는 동안 두 사람이 마지막 대화를 나눈다.",
    tags: ["장소", "금요일"], refs: [{ kind: "map", id: MAP.platformPm }, { kind: "event", id: "ev_fl_platform" }, { kind: "event", id: "ev_fl_p_jihu" }, { kind: "event", id: "ev_fl_run" }], source: "막차 승강장 장면",
  },

  // 조직
  {
    id: "fl-faction-neulbom", type: "faction", name: "스튜디오 늘봄",
    summary: "서른 명쯤의 작은 앱 회사. 늘봄 빌딩의 유리 건물에 있다.",
    body: "서하의 첫 직장이다. 팀장은 서하의 포트폴리오에 있던 라디오 화면 시안을 보고 서하를 뽑았다.",
    tags: ["회사"], refs: [{ kind: "map", id: MAP.office }], source: "월요일 팀장 소개",
  },
  {
    id: "fl-faction-product", type: "faction", name: "프로덕트팀",
    summary: "하루끝을 만드는 다섯 명의 팀. 팀장은 오정민이고, 한 명은 휴직 중이다.",
    body: "개발 강지후, 디자인 윤서하, 백엔드 차민호가 있다. 이번 주에는 소리결 리뉴얼 발표 하나에 팀이 걸려 있다.",
    tags: ["회사", "팀"], refs: [], source: "팀 소개 장면",
  },
  {
    id: "fl-faction-sorigyeol", type: "faction", name: "소리결",
    summary: "하루끝 리뉴얼을 맡긴 의뢰사. 박 본부장이 발표를 듣는다.",
    body: "수요일 밤에 박 본부장이 메일로 수정 전 시안이 왔다고 알린다. 내일 오전 임원 보고에 써야 하는 파일이라서 급하다.",
    tags: ["회사", "의뢰"], refs: [{ kind: "event", id: "ev_fl_f_client" }], source: "수요일 메일, 금요일 발표",
  },
  {
    id: "fl-faction-bangsongbu", type: "faction", name: "성하고 방송부",
    summary: "10년 전 금요일 점심마다 사연을 읽고 노래를 틀던 동아리.",
    body: "지후는 3학년 방송부원이었다. 사연함에는 매주 익명 편지가 들어왔고, 서하가 바나나우유라는 이름으로 가장 자주 보냈다.",
    tags: ["과거", "방송부"], refs: [{ kind: "map", id: MAP.broadcast }], source: "회상 장면",
  },

  // 인물
  {
    id: "fl-char-seoha", type: "character", name: "윤서하",
    summary: "스튜디오 늘봄에 입사한 UX 디자이너. 10년 전 바나나우유라는 이름으로 사연을 보냈다.",
    body: "고등학교 때 금요일마다 급식 줄에 늦게 서는 아이였다. 점심 방송을 들으려고 일부러 늦게 섰다. 겨울의 마지막 금요일에 본명으로 쓴 사연은 방송되지 못했다. 서하는 그 일을 10년 동안 품고 있다. 첫 출근 주에 그 방송의 목소리가 자기 사수로 나타난다. 열일곱의 서하는 회상에서만 나온다.",
    tags: ["주인공", "인물"], refs: [{ kind: "actor", id: "actor_hero" }], source: "주인공 시점 전체",
  },
  {
    id: "fl-char-jihu", type: "character", name: "강지후",
    summary: "앱 개발 4년 차 선임이자 서하의 사수. 10년 전 금요일 점심 방송의 목소리다.",
    body: "하루끝 리뉴얼의 메인 개발자다. 옥상에서 혼자 점심을 먹고, 회사에서는 서하를 모르는 사이로 해 달라고 부탁한다. 이번 금요일이 마지막 출근일이고 다음 주부터 부산 지사에서 일한다. 서하의 편지는 지금도 그의 수첩에 있다. 열아홉의 지후는 회상에서 방송실을 지키던 모습으로 나온다.",
    tags: ["인물", "공략"], refs: [{ kind: "event", id: "ev_fl_jihu_meet" }], source: "지후 대사 전체",
  },
  {
    id: "fl-char-minho", type: "character", name: "차민호",
    summary: "지난주에 들어온 백엔드 신입. 스스로 동기라고 부르고 탕비실 간식을 맡고 있다.",
    body: "서하에게 커피머신 라테 비법을 알려 주고 수요일 야근을 같이 걱정해 준다. 서하가 사정을 털어놓으면 편을 들어 주고, 금요일 발표가 통과되면 제일 먼저 기뻐한다.",
    tags: ["인물"], refs: [{ kind: "event", id: "ev_fl_w_minho" }, { kind: "event", id: "ev_fl_f_minho" }], source: "민호 대사 전체",
  },
  {
    id: "fl-char-lead", type: "character", name: "오정민 팀장",
    summary: "프로덕트팀 팀장. 말은 부드럽지만 보고는 정확해야 한다.",
    body: "서하의 포트폴리오를 보고 뽑았다. 수요일에 서하가 실수를 먼저 말하면 그게 팀이라고 답한다. 금요일에는 지후가 오늘이 마지막 날이라는 것을 팀에 알린다.",
    tags: ["인물"], refs: [{ kind: "event", id: "ev_fl_w_lead" }, { kind: "event", id: "ev_fl_f_lead" }], source: "팀장 대사 전체",
  },
  {
    id: "fl-char-client", type: "character", name: "박 본부장",
    summary: "소리결에서 온 의뢰인. 금요일 오후 3시 발표를 듣는다.",
    body: "수요일 밤 메일로 시안이 수정 전 버전이라고 알려 온 사람이다. 금요일에는 서하가 이야기로 시작하면 라디오가 원래 그런 거라고 답하고, 데이터로 설명하면 숫자가 탄탄하다고 답한다. 어느 쪽이든 발표는 통과한다.",
    tags: ["인물"], refs: [{ kind: "event", id: "ev_fl_f_client" }], source: "금요일 발표 장면",
  },

  // 물건과 개념
  {
    id: "fl-item-banana", type: "item", name: "바나나우유",
    summary: "서하의 옛 닉네임이자 지금도 서하가 마시는 우유. 두 사람 사이의 암호다.",
    body: "10년 전 서하의 사연 이름이 바나나우유였다. 지후의 책상에는 빈 팩이 있고, 편의점에서는 1+1으로 판다. 옥상에서 바나나우유 두 개를 건네면 지후가 한 걸음 더 다가온다. 하루끝 사연의 수신인도 바나나우유 님이다.",
    tags: ["물건", "열쇠"], refs: [], source: "편의점, 옥상, 결말",
  },
  {
    id: "fl-item-letter", type: "item", name: "연두색 편지지",
    summary: "서하가 10년 전 마지막 사연을 쓴 편지지. 지후의 수첩 속에 남아 있다.",
    body: "수요일 밤 지후의 수첩에서 서하가 이 편지지를 발견한다. 지후는 그날 불 꺼진 방송실에서 혼자 읽었다. 이별 결말에서는 지후가 이 편지지 뒷면에 적은 답장을 서하에게 건넨다.",
    tags: ["물건", "열쇠"], refs: [{ kind: "event", id: "ev_fl_notebook" }], source: "수요일 수첩, 막차 장면",
  },
  {
    id: "fl-item-mailbox", type: "item", name: "방송부 사연함",
    summary: "방송실 문 앞의 사연함. 금요일 점심에 읽어 드립니다라는 팻말이 붙어 있다.",
    body: "서하의 편지는 여기에 들어갔다. 회상 속에서 서하가 마지막 사연을 이곳에 넣는다.",
    tags: ["물건", "과거"], refs: [{ kind: "event", id: "ev_fl_mailbox" }], source: "회상 장면",
  },
  {
    id: "fl-concept-haruggeut", type: "concept", name: "하루끝",
    summary: "밤 10시에 사연 하나와 노래 한 곡을 보내 주는 앱. 프로덕트팀의 제품이다.",
    body: "공유 폴더 이름이 하루끝_리뉴얼이다. 지후의 관리자 화면 맨 위에 익명 편지가 하나 떠 있다. 서하가 발표에서 넣는 새 기능이 늦은 답장이다. 지난 사연에는 언제든 답장이 간다.",
    tags: ["개념", "제품"], refs: [{ kind: "event", id: "ev_fl_wed" }], source: "팀장 소개, 발표",
  },

  // 사건
  {
    id: "fl-event-past", type: "event", name: "10년 전 마지막 금요일",
    summary: "서하가 처음으로 본명을 적은 사연이 방송되지 못한 날. 이 이야기의 출발점이다.",
    body: "겨울의 마지막 금요일, 서하는 바나나우유가 아니라는 말과 함께 선배를 좋아한다고 썼다. 방송은 나가지 않았다. 월요일에 지후의 자리는 비어 있었고, 전학이라는 말만 남았다. 인사는 없었다.",
    tags: ["사건", "과거"], refs: [{ kind: "event", id: "ev_fl_flashback" }], source: "회상 장면",
  },
  {
    id: "fl-event-mon", type: "event", name: "월요일, 첫 출근",
    summary: "서하가 횡단보도에서 부딪히고 사무실에서 그 사람을 사수로 소개받는 날.",
    body: "팀장이 지후를 앱 개발 4년 차이자 리뉴얼 메인 개발자로 소개한다. 지후는 회사에서는 모르는 사이로 해 달라고 말한다. 저녁 편의점에서 한 번 더 마주친다.",
    tags: ["사건", "월요일"], refs: [{ kind: "event", id: "ev_fl_meet" }, { kind: "event", id: "ev_fl_jihu_meet" }], source: "월요일 장면",
  },
  {
    id: "fl-event-wed", type: "event", name: "수요일 야근",
    summary: "서하가 소리결에 잘못된 시안을 보낸 것을 알게 되는 밤.",
    body: "저녁 8시 3분에 박 본부장의 메일이 온다. 폴더에는 최종, 최종_진짜, 최종_진짜_수정이 있고 서하가 보낸 것은 앞의 파일이다. 서하는 팀장에게 곧바로 보고하거나 지후에게만 도움을 청한다. 밤 10시 40분에 고친 파일을 다시 보내 승인이 난다. 그 뒤 탕비실에서 컵라면을 먹는다.",
    tags: ["사건", "수요일"], refs: [{ kind: "event", id: "ev_fl_wed" }, { kind: "event", id: "ev_fl_w_lead" }, { kind: "event", id: "ev_fl_w_jihu" }, { kind: "event", id: "ev_fl_w_desk" }], source: "수요일 장면",
  },
  {
    id: "fl-event-fri", type: "event", name: "금요일 발표와 이별",
    summary: "오후 3시 소리결 앞 발표, 그리고 지후의 마지막 출근일.",
    body: "서하는 내 이야기로 시작하거나 데이터로 설명한다. 발표가 통과하면 민호가 회식 각이라고 외치고, 팀장이 이 자리가 지후의 송별회를 겸한다고 알린다. 지후는 먼저 일어나 나간다. 서하의 책상 모서리에는 노란 포스트잇이 붙어 있다. 21시 40분 한결역 서울역행, 인사는 거기서 하겠다는 글이다.",
    tags: ["사건", "금요일"], refs: [{ kind: "event", id: "ev_fl_fri" }, { kind: "event", id: "ev_fl_f_client" }, { kind: "event", id: "ev_fl_f_jihu" }, { kind: "event", id: "ev_fl_dinner_rain" }], source: "금요일 장면",
  },
  {
    id: "fl-event-lastrain", type: "event", name: "막차",
    summary: "서하가 역으로 달려가는 밤. 이야기의 마지막 선택이 여기서 나뉜다.",
    body: "서하는 회식 대신 역을 고르면 9시 21분에 승강장에 닿는다. 지후가 사연함에서 나온 편지를 보여 주고, 서하가 이번엔 먼저 말한다. 회식을 고르면 서하는 비 오는 거리에서 막차를 놓친다.",
    tags: ["사건", "금요일"], refs: [{ kind: "event", id: "ev_fl_platform" }, { kind: "event", id: "ev_fl_run" }, { kind: "event", id: "ev_fl_end_b_street" }], source: "막차 장면",
  },

  // 비밀과 결말 (조수에게 숨김)
  {
    id: "fl-secret-why-left", type: "concept", name: "지후가 떠난 이유",
    summary: "10년 전 지후의 아버지 가게가 망해 하룻밤에 이사했고 전화도 끊겼다.",
    body: "지후는 인사를 하고 싶었지만 무슨 말을 해야 할지 몰랐다. 시간이 갈수록 미안하다는 말이 점점 작아 보였다. 서하와의 호감이 쌓이면 지후가 이 이야기를 직접 꺼낸다. 아니면 발표가 끝난 뒤로 미룬다.",
    tags: ["비밀", "과거"], visibility: "ai-hidden", refs: [], source: "지후 호감 단계 대사",
  },
  {
    id: "fl-end-again", type: "event", name: "엔딩 A 다시, 첫사랑",
    summary: "서하가 먼저 마음을 말하고 지후가 10년 늦은 답을 한다.",
    body: "서하가 이번엔 내가 먼저 말할게요 하고 말을 꺼낸다. 지후는 10년 늦은 답장이라고 하며 그 금요일에도 지금도 좋아한다고 답한다. 부산에는 간다. 아버지 곁에 있기로 했기 때문이다. 대신 금요일마다 KTX로 올라오겠다고 약속한다. 3개월 뒤 하루끝 오늘의 늦은 답장이 바나나우유 님께 도착한다. 열 번째 봄이 지나고, 첫사랑이 다시 시작된다.",
    tags: ["결말"], visibility: "ai-hidden", refs: [], source: "엔딩 A",
  },
  {
    id: "fl-end-late-reply", type: "event", name: "엔딩 B 늦은 답장",
    summary: "서하가 좋아했다고 말하고 작별한다. 지후는 편지지 뒷면에 쓴 답장을 건넨다.",
    body: "지금 대답하면 또 도망치는 대답 같다고 지후가 말한다. 열차가 떠난 뒤 읽으라고 하며 연두색 편지지를 건넨다. 편지는 짧아서 서하가 10년 늦은 답장치고는 짧다고 투덜댄다. 이번에는 작별 인사를 했다. 월요일에는 출근해야 한다.",
    tags: ["결말"], visibility: "ai-hidden", refs: [], source: "엔딩 B",
  },
  {
    id: "fl-end-rain", type: "event", name: "엔딩 C 비 오는 금요일",
    summary: "회식에 가서 막차를 놓친다. 밤 10시, 하루끝으로 익명 답장이 온다.",
    body: "서하는 비 오는 거리에 혼자 서 있다. 9시 41분에 열차는 이미 떠났다. 밤 10시, 바나나우유 님께라는 제목의 사연이 온다. 10년 전 금요일의 사연에 이제야 답장한다는 글이고, 이번에도 인사는 못 했다고 쓰여 있다. 서하는 다음 주 금요일에 자기 사연을 보내 부산까지 닿게 하기로 한다.",
    tags: ["결말"], visibility: "ai-hidden", refs: [], source: "엔딩 C",
  },
];

const RELATIONS: readonly CodexRelation[] = [
  { a: "fl-place-station", b: "fl-place-street", kind: "custom", note: "계단을 올라 거리로" },
  { a: "fl-place-street", b: "fl-place-office", kind: "custom", note: "늘봄 빌딩 입구" },
  { a: "fl-place-pantry", b: "fl-place-office", kind: "locatedIn" },
  { a: "fl-place-rooftop", b: "fl-place-office", kind: "locatedIn", note: "엘리베이터 R 버튼, 점심에만" },
  { a: "fl-place-office", b: "fl-faction-neulbom", kind: "custom", note: "스튜디오 늘봄의 사무실" },
  { a: "fl-place-lastrain", b: "fl-place-station", kind: "locatedIn", note: "같은 역의 밤" },
  { a: "fl-place-broadcast", b: "fl-faction-bangsongbu", kind: "custom", note: "방송부의 방" },
  { a: "fl-faction-product", b: "fl-faction-neulbom", kind: "memberOf" },
  { a: "fl-char-seoha", b: "fl-faction-product", kind: "memberOf", note: "UX 디자이너" },
  { a: "fl-char-jihu", b: "fl-faction-product", kind: "memberOf", note: "개발 선임" },
  { a: "fl-char-minho", b: "fl-faction-product", kind: "memberOf", note: "백엔드 신입" },
  { a: "fl-char-lead", b: "fl-faction-product", kind: "memberOf", note: "팀장" },
  { a: "fl-char-jihu", b: "fl-faction-bangsongbu", kind: "memberOf", note: "3학년 방송부원" },
  { a: "fl-char-seoha", b: "fl-faction-bangsongbu", kind: "custom", note: "사연을 보내던 2학년" },
  { a: "fl-char-client", b: "fl-faction-sorigyeol", kind: "memberOf" },
  { a: "fl-char-seoha", b: "fl-char-jihu", kind: "knows", note: "10년 전 사연을 보낸 사람과 읽은 사람" },
  { a: "fl-char-seoha", b: "fl-char-minho", kind: "knows", note: "자칭 동기" },
  { a: "fl-char-seoha", b: "fl-char-lead", kind: "knows", note: "팀장과 신입" },
  { a: "fl-char-jihu", b: "fl-place-rooftop", kind: "custom", note: "혼자 점심을 먹는 곳" },
  { a: "fl-char-minho", b: "fl-place-pantry", kind: "custom", note: "간식 담당" },
  { a: "fl-item-banana", b: "fl-char-seoha", kind: "custom", note: "옛 닉네임" },
  { a: "fl-item-letter", b: "fl-char-jihu", kind: "owns", note: "수첩에 간직" },
  { a: "fl-item-mailbox", b: "fl-place-broadcast", kind: "locatedIn" },
  { a: "fl-concept-haruggeut", b: "fl-faction-product", kind: "custom", note: "팀의 제품" },
  { a: "fl-event-past", b: "fl-place-broadcast", kind: "locatedIn" },
  { a: "fl-event-fri", b: "fl-faction-sorigyeol", kind: "custom", note: "발표 상대" },
  { a: "fl-event-wed", b: "fl-faction-sorigyeol", kind: "causedBy", note: "수정 전 시안을 보냄" },
  { a: "fl-secret-why-left", b: "fl-event-past", kind: "causedBy" },
  { a: "fl-end-again", b: "fl-event-lastrain", kind: "causedBy", note: "역으로 가서 먼저 말한다" },
  { a: "fl-end-late-reply", b: "fl-event-lastrain", kind: "causedBy", note: "역으로 가서 작별한다" },
  { a: "fl-end-rain", b: "fl-event-fri", kind: "causedBy", note: "회식을 고른다" },
];

interface Profile {
  readonly characterId: string;
  readonly displayName: string;
  readonly note: string;
  readonly nameColor: string;
}

// characterId 는 호감 키와 같다(seoha, jihu, minho, lead). displayName 은 대사 화자 이름과 같아야 이름 색이 붙는다
// (dialogueStyles.ts — 화자 이름 == displayName). 빌더의 「강지후」·「차민호」·「오정민 팀장」은 대사에서 「지후」·「민호」·「오 팀장」이라
// 색이 안 붙었다. 성까지 붙은 이름은 설정집 인물 문서에 있다.
const PROFILES: readonly Profile[] = [
  { characterId: "seoha", displayName: "서하", note: "스튜디오 늘봄 프로덕트팀의 새 UX 디자이너. 첫 출근 주에 10년 전 사연을 읽던 선배를 다시 만난다.", nameColor: "#c2547a" },
  { characterId: "jihu", displayName: "지후", note: "", nameColor: "#3f6f9e" },
  { characterId: "minho", displayName: "민호", note: "", nameColor: "#d08a2b" },
  { characterId: "lead", displayName: "오 팀장", note: "", nameColor: "#5f7a5a" },
];

export function applyFirstLoveLore(project: Project, exec: LoreExec = loreExec): void {
  exec(project, "set_world_canon", {
    canon: {
      name: "첫사랑",
      premise: "첫 출근 주에 서하는 10년 전 점심 방송의 목소리를 다시 만난다. 월요일부터 금요일 막차까지, 늦게 도착한 마음이 어디에 닿는지 정한다.",
      tones: ["slice", "hopeful", "comic"],
      era: "현대 한국, 이른 봄 한 주",
      techCeiling: "스마트폰과 앱 서비스, 메일과 공유 폴더가 쓰이는 현대",
      absences: ["마법", "괴물", "초능력", "전쟁", "범죄"],
      laws: {
        power: { present: false, note: "특별한 힘은 없다. 회사 일과 오래 묵은 마음이 이야기를 움직인다." },
        gods: { present: false, note: "신앙은 다루지 않는다." },
        death: { present: false, note: "죽음은 다루지 않는다." },
        money: { present: true, note: "월급과 의뢰사 발표가 일을 조인다. 지후의 집안 사정에도 돈이 걸려 있다." },
      },
      body: CANON_BODY,
      status: "canon",
    },
  });

  writeCodex(project, exec, ENTRIES, RELATIONS);

  for (const profile of PROFILES) {
    const existing = project.characters?.[profile.characterId];
    const note = existing?.note?.trim() ? existing.note : profile.note;
    exec(project, "upsert_character_profile", {
      characterId: profile.characterId,
      profile: {
        displayName: profile.displayName,
        ...(note ? { note } : {}),
        ...(existing?.birthday ? { birthday: existing.birthday } : {}),
        ...(existing?.giftPrefs ? { giftPrefs: existing.giftPrefs } : {}),
        ...(existing?.giftResponses ? { giftResponses: existing.giftResponses } : {}),
        dialogue: { ...(existing?.dialogue ?? {}), nameColor: profile.nameColor },
      },
    });
  }
}
