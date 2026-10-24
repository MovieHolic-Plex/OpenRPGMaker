import { defineHarness } from "../_core/manifest";

/** 대사 흉상(캐스트 초상) — 새 인물 흉상이 그 프로젝트의 기존 캐스트와 같은 작가·같은 규격으로 보이게 강제한다. */
export const CAST_PORTRAIT_HARNESS = defineHarness({
  id: "cast-portrait",
  title: "캐스트 대사 흉상 (기존 캐스트와 같은 규격)",
  summary:
    "프로젝트마다 캐스트 규격(harness-data/cast-portrait/projects/<project>.json: 기존 흉상 줄, 캔버스, 규칙, 생성 경로, 대사창 픽스처)을 두고 "
    + "새 흉상을 그 캐스트와 같은 경로로 만든다(아스트라: char-gen command 엔진 + bake_astra_busts64, 64×64·16색·투명·머리 위 1~4화소·어깨 아래로 잘림·인접색 윤곽·얼굴만 바꾸는 표정). "
    + "원본은 줄이거나 자르지 않는다(원래 격자가 캔버스에 안 맞으면 버림). 기계 검사(크기·색 수·자리·윤곽 어둠 ≥70%·두 눈 대칭·캐스트 대비 머리 폭·얼굴 밖 변화 0) → "
    + "캐스트 줄 1·3배와 실제 대사창 → 눈가림 Argon 「같은 작가?」 5번(중앙값·과반, 캐스트·반려작으로 보정한 문턱) → 사람 선택(현재 그림 해시) → 설치. 에이전트는 고르지 않는다.",
  scope: {},
  triggers: [
    "대사 흉상·초상(포트레잇)을 새로 만들거나 다시 그릴 때 — 아스트라 호라이즌 등 캐스트가 있는 프로젝트",
    "「다른 포트레잇과 안 어울린다」「괴물같다」는 흉상을 고칠 때",
    "다른 데모(첫사랑·떨어진 별)는 자기 캐스트 규격 파일로 calibrate·check·lineup·verdict 를 쓴다(생성 경로는 규격에 있을 때만)",
  ],
  seed: "harness-data/cast-portrait/seed.json",
  doc: "openwiki/harnesses/cast-portrait.md",
  stages: [
    { id: "list", title: "규격 목록", summary: "프로젝트별 캐스트 규격(줄·생성 경로·역할)을 보여 준다." },
    { id: "calibrate", title: "캐스트 측정", summary: "기존 캐스트 흉상을 같은 측정기로 재서 baseline.json 에 쓴다(크기·색·머리 위치·윤곽 어둠·머리 폭·눈 대칭)." },
    { id: "draw", title: "후보 그리기", summary: "규격의 생성 경로(아스트라: char-gen + bake_astra_busts64)로 역할 후보 N개와 표정을 만든다. 원래 격자가 캔버스에 맞지 않으면 버린다(축소·자르기 금지)." },
    { id: "import", title: "가져오기", summary: "같은 경로로 이미 만든 흉상 폴더를 후보로 등록한다. 캔버스와 다른 크기는 거절한다." },
    { id: "fix", title: "손 보정", summary: "표정 하나의 화소를 고치고 기록·해시를 다시 잡는다(이전 판정은 무효가 된다)." },
    { id: "check", title: "기계 검사", summary: "캔버스·색 수·투명 배경·머리 위 여백·어깨 잘림·윤곽 어둠·두 눈 대칭·캐스트 대비 머리 폭·얼굴 밖 변화·원래 격자를 표정마다 검사한다. 실패는 종료 코드 1." },
    { id: "lineup", title: "캐스트 줄 세우기", summary: "후보마다 기존 캐스트 줄 안(4번째)에 1·3배, 표정 띠 4배를 만들고 글자로 가린 눈가림 묶음과 검수 지시문을 쓴다." },
    { id: "dialogue", title: "실제 대사창", summary: "qa:runtime 으로 진짜 대사창에서 캐스트 대사와 후보 표정(기본·기쁨·놀람·슬픔)을 한 장씩 찍어 눈가림 묶음에 넣는다." },
    { id: "review", title: "반복 눈가림 검수 (관문)", summary: "후보마다 새 Argon 호출 N번(기본 5)으로 「같은 작가?」를 묻고 적합도 중앙값·같은 작가 과반·표정별 결함 표·퍼짐을 기록한다. 문턱은 calibrate-review 값." },
    { id: "calibrate-review", title: "검수 보정", summary: "실제 캐스트(한 명씩 빼서 후보 자리에)=합격, 사용자 반려작=불합격을 같은 묶음으로 N번씩 검수해 둘을 가르는 문턱을 정한다." },
    { id: "verdict", title: "비교 검수 기록 (참고)", summary: "후보 넷을 한 장에 비교한 독립 검수자 JSON 을 그림 해시에 묶어 기록한다. 관문이 아니다(한 번 호출은 흔들린다)." },
    { id: "pick", title: "사람 선택", summary: "검사 통과 + 눈가림 「같은 작가, 결함 없음」이 현재 해시에 있을 때만, 사람이 고른 후보를 기록한다." },
    { id: "install", title: "설치", summary: "현재 해시에 사람 선택이 있는 후보만 규격의 설치 폴더로 복사하고 출처를 남긴다." },
    { id: "status", title: "현황", summary: "판·후보마다 검사·판정·선택 상태." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
