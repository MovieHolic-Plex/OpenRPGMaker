// eventEditor/eventEditorHelp.ts
// 이벤트 에디터 내부 도움말 — "도움말" 푸터 버튼(event-editor-help)에서 연다.
// 에디터 전체 도움말(helpModal.ts)과 같은 위키 스타일(목차 + 스크롤 스파이 + 섹션별 스크린샷)을
// 공유하지만, 이벤트 에디터만의 구조(페이지 · 조건 · 명령 · 그래픽 · 이동경로 · 분기 · AI 보조)를
// 자세히 다룬다. 이벤트 에디터 모달 위에 겹쳐 뜨므로 modalStack 에 등록해 Esc 가 도움말부터 닫는다.
// 스타일은 기존 .help-modal-* 클래스를 재사용한다(z-index 290 > 이벤트 에디터 120).
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { el } from "@/util/dom";

type ShortcutEntry = {
  readonly keys: readonly string[];
  readonly desc: string;
};

type ShortcutSection = {
  readonly title: string;
  readonly entries: readonly ShortcutEntry[];
};

type GuideBlock =
  | { readonly kind: "p"; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly string[] }
  | { readonly kind: "note"; readonly text: string };

type GuideSection = {
  readonly id: string;
  readonly title: string;
  readonly glyph: string;
  readonly image?: { readonly src: string; readonly alt: string; readonly caption: string };
  readonly blocks: readonly GuideBlock[];
};

const EVENT_EDITOR_SHORTCUTS: readonly ShortcutSection[] = [
  {
    title: "명령 편집",
    entries: [
      { keys: ["Ctrl", "Z"], desc: "실행취소 (이벤트 에디터 안에서 동작)" },
      { keys: ["Ctrl", "Y"], desc: "다시실행" },
      { keys: ["Ctrl", "C"], desc: "명령 복사 (우클릭 메뉴 또는 툴바)" },
      { keys: ["Ctrl", "X"], desc: "명령 잘라내기" },
      { keys: ["Ctrl", "V"], desc: "명령 붙여넣기" },
      { keys: ["Ctrl", "/"], desc: "주석 삽입" },
      { keys: ["Delete"], desc: "선택한 명령 삭제 (명령 줄 포커스 시)" },
    ],
  },
  {
    title: "페이지 · 이동",
    entries: [
      { keys: ["+"], desc: "새 페이지 추가 (페이지 탭 끝)" },
      { keys: ["Esc"], desc: "최상위 모달부터 닫기 (도움말 → 서브다이얼로그 → 이벤트 에디터)" },
      { keys: ["Ctrl", "K"], desc: "명령 · 맵 · 스킬 검색 팔레트" },
    ],
  },
];

// 명령 카테고리 — commandCategoryIcons.ts 의 시각 언어와 동일한 글리프/이름.
const COMMAND_CATEGORY_ROWS: readonly { readonly glyph: string; readonly name: string; readonly desc: string }[] = [
  { glyph: "❝", name: "대화 / 입력", desc: "글자 표시, 선택지, 숫자 입력, 대기. NPC 대사와 플레이어 응답을 만듭니다." },
  { glyph: "◇", name: "조건 / 흐름", desc: "조건 분기(fork), 루프, 스위치·셀프스위치 조작. 게임 로직의 골격을 잡습니다." },
  { glyph: "➤", name: "맵 / 이동", desc: "장소 이동, 이벤트 이동, 이벤트 그래픽 변경, 타일 변경, 맵 이벤트 호출." },
  { glyph: "¤", name: "보상 / 상점", desc: "상점, 여관, 아이템·골드 증감. 플레이어 보상과 경제를 설계합니다." },
  { glyph: "♪", name: "소리", desc: "BGM 재생, 효과음 재생, BGM 페이드. 분위기와 피드백을 담당합니다." },
  { glyph: "☗", name: "배우 / 전투", desc: "전투 처리, HP·MP·레벨·경험치 변경, 완전 회복. 파티와 전투를 다룹니다." },
  { glyph: "✦", name: "화면 / 연출", desc: "조명 설정, 날씨, 애니메이션 표시, 화면 색조. 컷신과 분위기 연출입니다." },
  { glyph: "⚙", name: "시스템 / 고급", desc: "체크포인트 저장, 즉사, 엔딩, 주석. 시스템 제어와 메모입니다." },
];

const GUIDE_SECTIONS: readonly GuideSection[] = [
  {
    id: "overview",
    title: "개요",
    glyph: "📓",
    image: {
      src: "/assets/help/event.png",
      alt: "이벤트 편집기 전체 화면",
      caption: "이벤트 편집기 — 왼쪽 페이지 속성, 가운데 페이지 탭, 오른쪽 실행 내용(명령 목록)으로 구성됩니다.",
    },
    blocks: [
      {
        kind: "p",
        text: "이벤트는 게임 안에서 '무언가 일어나는' 객체입니다. NPC와 대화하기, 문이 열리기, 보물상자에서 아이템 얻기, 맵 이동, 전투 발생, 컷신 재생까지 모두 이벤트 명령의 조합으로 만듭니다. 이벤트 편집기는 그 이벤트의 구조와 내용을 조립하는 화면입니다.",
      },
      {
        kind: "list",
        items: [
          "여는 방법 — 이벤트 레이어(F7)에서 캔버스의 이벤트를 더블클릭하거나, 이벤트 도구(N)로 빈 칸을 더블클릭해 새 이벤트를 만듭니다. 왼쪽 맵 이벤트 목록에서 행을 클릭해도 해당 이벤트로 카메라가 이동하고, 더블클릭하면 편집기가 열립니다.",
          "페이지 — 하나의 이벤트는 여러 페이지를 가질 수 있습니다. 각 페이지는 실행 조건과 실행 내용(명령 목록)을 따로 가지며, 조건을 만족하는 가장 마지막 페이지가 동작합니다.",
          "명령 — 글자 표시·선택지·이동·전투·상점 같은 명령을 조립식으로 쌓습니다. 명령 피커에서 골라 추가하고, 우클릭으로 복사·잘라내기·붙여넣기합니다.",
          "하단 버튼 — 취소(열기 전으로 되돌림), 적용(저장하며 계속 편집), 확인(저장 후 닫기), 도움말(이 화면), 삭제(이벤트 자체 삭제, 확인 필요)이 있습니다. 편집 중 내용은 자동 저장되어 갑자기 닫혀도 복구됩니다.",
        ],
      },
      {
        kind: "note",
        text: "이벤트 에디터 안에서도 실행취소/다시실행(Ctrl+Z / Ctrl+Y)이 동작합니다. 여러 모달이 겹쳐 있을 때 Esc 를 누르면 가장 위의 모달부터 닫힙니다 — 예를 들어 도움말이 열린 상태에서 Esc 를 누르면 도움말만 닫히고 이벤트 에디터는 그대로 남습니다.",
      },
    ],
  },
  {
    id: "pages",
    title: "이벤트와 페이지",
    glyph: "📑",
    image: {
      src: "/assets/help/event-editor/pages.png",
      alt: "이벤트 페이지 탭과 페이지 속성",
      caption: "페이지 탭(상단) — 캐릭터 칩셋 미리보기가 채워지고, 조건 배지가 우측에 표시됩니다. 끝의 + 로 새 페이지를 추가합니다.",
    },
    blocks: [
      {
        kind: "p",
        text: "이벤트는 하나 이상의 페이지로 구성됩니다. 페이지마다 고유한 그래픽·실행 조건·실행 내용(명령 목록)·이동 설정을 가집니다. 게임 실행 중에는 조건을 만족하는 페이지 중 가장 번호가 큰(마지막) 페이지가 화면에 나타나고 동작합니다. 이 특징을 이용해 '처음엔 닫힌 문, 스위치를 켜면 열린 문'처럼 상태 변화를 표현합니다.",
      },
      {
        kind: "list",
        items: [
          "페이지 탭 — 상단의 탭에 캐릭터 칩셋 미리보기가 채워지고, 페이지 번호가 하단에 겹쳐 표시됩니다. 우측 위에는 조건 배지(스위치·셀프스위치 등)가 작게 나타나 어떤 조건이 걸려 있는지 한눈에 볼 수 있습니다.",
          "페이지 추가 — 탭 끝의 + 버튼으로 새 페이지를 추가합니다. 새 페이지는 앞선 페이지의 그래픽을 물려받아 이어 편집하기 좋습니다.",
          "페이지 속성 — 왼쪽 패널에서 이름·그래픽·이동·실행 조건·트리거(실행 방식)·우선순위(겹침)를 설정합니다. 트리거는 실행 행동, 정기 병렬, 충돌, 자동 실행 등이 있습니다.",
          "이름 — 페이지마다 이름을 붙일 수 있습니다. 제목 표시줄에 가장 마지막으로 이름이 있는 페이지의 이름과 좌표가 표시되어 어느 이벤트를 편집 중인지 즉시 알 수 있습니다.",
        ],
      },
      {
        kind: "note",
        text: "조건을 만족하는 페이지가 없으면 이벤트는 화면에 나타나지 않습니다. 빈 조건(조건 없음) 페이지는 항상 만족하므로 보통 첫 페이지에 둡니다.",
      },
    ],
  },
  {
    id: "conditions",
    title: "실행 조건",
    glyph: "◇",
    image: {
      src: "/assets/help/event-editor/conditions.png",
      alt: "실행 조건 입력 영역",
      caption: "조건 행 — 스위치·변수·셀프스위치·시간·계절·NPC 활동·호감도 조건을 조합합니다. 비활성 조건도 자리를 유지합니다.",
    },
    blocks: [
      {
        kind: "p",
        text: "각 페이지는 실행 조건을 가집니다. 게임이 페이지를 표시할지 말지는 이 조건이 결정합니다. 조건은 여러 개를 함께 걸 수 있고, 모두 만족해야(AND) 해당 페이지가 동작합니다.",
      },
      {
        kind: "list",
        items: [
          "스위치 — 전역 스위치가 ON/OFF 인지 검사합니다. 스토리 진행 플래그에 가장 많이 씁니다.",
          "변수 — 전역 변수의 값을 숫자나 다른 변수와 비교합니다(≥, ≤, == 등). 카운트다운이나 점수 문에 씁니다.",
          "셀프스위치 — 이 이벤트 전용 스위치 A·B·C·D. 보물상자를 열었는지, 퀘스트를 받았는지처럼 '한 번만' 일어나는 일에 씁니다. 다른 이벤트에는 영향을 주지 않습니다.",
          "시간 / 계절 / NPC 활동 — 시간 시스템이 켜져 있을 때 아침·낮·저녁, 계절, NPC 활동 단계로 페이지를 바꿀 수 있습니다. NPC 하루 일정과 연동됩니다.",
          "호감도 — 캐릭터 ID 가 연결된 이벤트에서 호감도 수치로 조건을 검사합니다. 선물·대화 보상 분기에 씁니다.",
          "간단 행 / 고급 — 첫 번째 셀프스위치는 간단 행에, 나머지 조건과 복합(모두/어느 하나/아님) 조건은 고급 목록에 표시됩니다. 비활성 조건도 체크·라벨·컨트롤 자리를 유지합니다.",
        ],
      },
      {
        kind: "note",
        text: "셀프스위치는 보통 명령으로 켭니다 — 예를 들어 보물상자 페이지 끝에 '셀프스위치 A = ON' 명령을 넣고, 열린 상태를 표시하는 두 번째 페이지에 '셀프스위치 A = ON' 조건을 겁니다.",
      },
    ],
  },
  {
    id: "commands",
    title: "명령",
    glyph: "☰",
    image: {
      src: "/assets/help/event-editor/commands.png",
      alt: "명령 목록과 명령 피커",
      caption: "실행 내용(명령 목록) — 좌측 색 레일이 카테고리를 나타냅니다. + 버튼이나 더블클릭으로 명령 피커를 엽니다.",
    },
    blocks: [
      {
        kind: "p",
        text: "실행 내용은 이벤트가 동작할 때 순서대로 실행할 명령들의 목록입니다. 명령을 더블클릭하면 편집 다이얼로그가 열리고, + 버튼이나 빈 줄 더블클릭으로 명령 피커를 열어 새 명령을 추가합니다. 피커는 4개 탭(빠른 저작 / 배우·전투 / 맵·연출 / 시스템·고급)으로 나뉘고, 카테고리별로 묶여 있습니다.",
      },
      {
        kind: "list",
        items: [
          "명령 추가 — + 버튼, 빈 줄 더블클릭, 또는 Ctrl+K 팔레트에서 이름으로 검색해 추가합니다.",
          "명령 편집 — 줄을 더블클릭하면 해당 명령의 편집 다이얼로그가 열립니다. 우측에 실시간 미리보기(대사 창, 상점, 수식 등)가 함께 표시됩니다.",
          "복사 · 잘라내기 · 붙여넣기 — 줄을 우클릭하면 메뉴가 나옵니다. Ctrl+C/X/V 도 동작합니다.",
          "색 레일 — 각 명령 줄 좌측의 색 띠가 카테고리를 나타냅니다. 한눈에 대사 명령인지, 흐름 제어인지, 전투 명령인지 구분할 수 있습니다.",
          "분기 · 루프 본문 — 조건 분기의 그렇다/아니다 본문, 선택지의 선택지 본문, 루프의 반복 본문은 메인 목록에서 들여쓰기 마커로 편집합니다. 별도 창을 띄우지 않아도 됩니다.",
          "주석 — Ctrl+/ 로 색상 주석을 넣을 수 있습니다. 편집 전용(실행에 영향 없음)으로, 명령 흐름에 메모를 남깁니다.",
        ],
      },
      {
        kind: "note",
        text: "명령 줄에 포커스가 있을 때 Delete 키는 명령 삭제로 동작하고 이벤트 자체 삭제로 빠지지 않습니다. 실수로 지운 이벤트는 토스트의 복구 버튼이나 Ctrl+Z 로 되돌릴 수 있습니다.",
      },
    ],
  },
  {
    id: "command-categories",
    title: "명령 카테고리",
    glyph: "🎨",
    blocks: [
      {
        kind: "p",
        text: "명령 피커와 목록은 색·글리프로 카테고리를 구분합니다. 아래 표가 각 카테고리의 역할입니다.",
      },
      {
        kind: "list",
        items: COMMAND_CATEGORY_ROWS.map((row) => `${row.glyph}  ${row.name} — ${row.desc}`),
      },
      {
        kind: "note",
        text: "전투 전용(⚔) 명령은 전투 이벤트 페이지에서만 의미가 있고, 모던 명령(◈)은 고전 명령 세트에는 없는 확장 명령입니다. 둘 다 같은 피커에서 접근할 수 있습니다.",
      },
    ],
  },
  {
    id: "graphics",
    title: "그래픽과 외형",
    glyph: "🖼",
    image: {
      src: "/assets/help/event-editor/graphics.png",
      alt: "이벤트 그래픽 선택기",
      caption: "그래픽 선택 — 왼쪽 칩셋 파일 목록, 오른쪽 캐릭터 칩 미리보기. 방향·패턴·애니메이션을 설정합니다.",
    },
    blocks: [
      {
        kind: "p",
        text: "이벤트의 외형은 페이지 단위로 지정합니다. 그래픽을 비우면 투명한(보이지 않는) 이벤트가 되어 트리거 영역이나 투명 컷신용으로 씁니다. 그래픽을 클릭하면 선택기가 열립니다.",
      },
      {
        kind: "list",
        items: [
          "캐릭터 칩셋 — 왼쪽에서 칩셋 파일을 고르고, 오른쪽 4×2 격자에서 캐릭터 칩을 선택합니다. 방향(↓←→↑)과 패턴(좌/가운데/우)을 고를 수 있고, 걷기 미리보기로 애니메이션을 확인합니다.",
          "얼굴 그림 — 글자 표시 명령의 changeFace 로 대사 창에 표시할 얼굴을 지정합니다. 4×4 얼굴 격자에서 고르고, 위치·좌우반전을 설정합니다. 버스트 모드면 대화창 위에 큰 초상화가 표시됩니다.",
          "애니메이션 유형 — 고정 그래픽(문·보물상자), 연속 애니메이션(불·깃발), 걷기 애니메이션(NPC) 중에서 고릅니다.",
          "외형 변경 명령 — 실행 중에 이벤트 외형을 바꾸려면 '이벤트 외형 변경(setEventGraphicPattern)' 명령을 씁니다. 문 열기처럼 상태에 따라 그래픽이 바뀌어야 할 때 사용합니다.",
          "오브젝트 도어 — 문 이벤트는 미리 정해진 칩 프리셋으로 빠르게 설정할 수 있습니다.",
        ],
      },
      {
        kind: "note",
        text: "AI 가 NPC 를 배치할 때(place_npc / make_villager) 대사 앞에 자동으로 changeFace 를 넣습니다. 얼굴 없는 대사 페이지가 생기지 않도록 합니다.",
      },
    ],
  },
  {
    id: "movement",
    title: "이동 경로",
    glyph: "↪",
    image: {
      src: "/assets/help/event-editor/move-route.png",
      alt: "이동 경로 편집기",
      caption: "이동 경로 — 페이지 이동 유형(고정/무작위/접근/커스텀)을 고르고, 커스텀은 경로 편집기로 조립합니다.",
    },
    blocks: [
      {
        kind: "p",
        text: "이벤트가 스스로 움직이는 방식은 페이지 속성의 이동에서 정합니다. 페이지 단위 이동과, 명령으로 일회성 경로를 지정하는 두 가지 방법이 있습니다.",
      },
      {
        kind: "list",
        items: [
          "고정 — 제자리에 있습니다. 문·보물상자·장식 이벤트에 씁니다.",
          "무작위 — 주변 칸을 무작위로 오갑니다. 동물이나 배경 NPC에 어울립니다.",
          "접근 — 플레이어를 향해 다가옵니다. 적 추격 이벤트에 씁니다. A* 경로 탐색을 씁니다.",
          "커스텀 — 경로 편집기에서 이동·방향전환·점프·대기 등을 한 줄씩 조립합니다. 정해진 순찰 경로에 씁니다.",
          "이동 경로 지정 명령 — '이벤트 이동(moveEvent)' 명령으로 실행 중에 이벤트(또는 플레이어)를 지정한 경로로 움직입니다. 컷신에서 캐릭터를 걷게 할 때 씁니다.",
          "스킵 불가 — 커스텀 경로를 플레이어가 기다리지 않고 즉시 통과하게 할지(스킵 불가 끔) 정할 수 있습니다.",
        ],
      },
      {
        kind: "note",
        text: "추격 장면(make_chase_scene)은 eventTouch 트리거의 접근 이벤트로 만들어집니다. 닿으면 사망(killPlayer) 처리, 안전 구역(safeZones), 활성화 스위치 조건까지 한 번에 설정할 수 있습니다.",
      },
    ],
  },
  {
    id: "branches",
    title: "분기와 선택지",
    glyph: "⑂",
    blocks: [
      {
        kind: "p",
        text: "게임 로직을 갈라지게 만드는 명령들입니다. 이벤트가 단순한 순차 실행이 아니라 플레이어 선택이나 상태에 따라 다르게 흘러가게 합니다.",
      },
      {
        kind: "list",
        items: [
          "조건 분기(fork) — 스위치·변수·셀프스위치 등 조건이 참이면 '그렇다' 본문을, 거짓이면 '아니다' 본문을 실행합니다. 조건은 단일(잎)부터 모두(AND)·어느 하나(OR)·아님(NOT) 복합까지 조립할 수 있고, 편집 중 실시간 TRUE/FALSE 미리보기가 표시됩니다.",
          "선택지(choices) — 플레이어에게 여러 선택지를 보여주고 고른 항목에 따라 각각 다른 본문을 실행합니다. RM2003 스타일로 선택지 텍스트와 취소 처리만 다이얼로그에서 정하고, 본문은 메인 목록의 '선택지 1/2/…' 마커 아래에서 편집합니다.",
          "가중 분기 — 확률이나 가중치로 무작위 분기를 만듭니다. 랜덤 보상이나 다양한 반응에 씁니다.",
          "루프(Loop) — 감싼 본문을 반복 실행합니다. break 로 빠져나갈 수 있습니다. 순찰·대기 반복에 씁니다.",
          "전투 결과 분기 — 전투 처리 뒤 승리/패배/도주에 따라 흐름을 갈라, 승리 시 스위치 ON + 보상, 패배 시 게임오버 처리를 만듭니다. 툴바의 원클릭 전투 버튼이 이 패턴을 자동으로 만들어 줍니다.",
        ],
      },
    ],
  },
  {
    id: "battle-shop",
    title: "전투 · 상점 · 여관",
    glyph: "⚔",
    blocks: [
      {
        kind: "p",
        text: "RPG 의 핵심 시스템 명령입니다. 전투 처리로 적 그룹과 싸우고, 상점으로 아이템을 사고팔며, 여관으로 파티를 회복시킵니다.",
      },
      {
        kind: "list",
        items: [
          "전투 처리(battleProcessing) — 적 그룹(트룹)을 지정해 전투를 시작합니다. 승리·패배·도주 결과로 분기(fork)를 걸어 후속 처리를 만듭니다. 툴바의 전투 버튼이 전투 페이지 + 승리 분기 + 스위치 + 이벤트 소거까지 한 번에 만들어 줍니다.",
          "상점(shop) — 판매 목록(듀얼 리스트)에 아이템을 넣고, 상인 보유 골드로 플레이어가 판 물건을 얼마까지 살지 정합니다. 재고·조건 레이어로 계절별 품절·가격 변동을 입힐 수 있습니다.",
          "여관(inn) — 가격 프리셋(무료/10/20/50/100)과 숙박 미리보기로 파티를 회복시킵니다. 회복 노트도 함께 표시됩니다.",
          "필드 전투 — 맵 속성의 인카운터 테이블·필드 스폰으로 걷다가 무작위/지정 적 조우를 만듭니다. 사냥터(make_hunting_ground) 도구로 인카운터와 필드 스폰을 함께 설정할 수 있습니다.",
        ],
      },
      {
        kind: "note",
        text: "상점의 재고·조건 레이어는 페이지 조건(영업 시간), 판매 목록(기본 재고), 재고 패널(계절·가격 오버레이) 세 겹으로 겹쳐 동작합니다. set_shop_stock 도구로 기존 상점에 재고를 추가할 수 있습니다.",
      },
    ],
  },
  {
    id: "ai-assist",
    title: "AI 보조",
    glyph: "✨",
    blocks: [
      {
        kind: "p",
        text: "이벤트 에디터에는 AI 보조 도구가 연결되어 있습니다. 복잡한 이벤트를 직접 손으로 짜기보다, 자연어로 요청해 명령 초안을 받고 검토 후 반영할 수 있습니다.",
      },
      {
        kind: "list",
        items: [
          "명령 보조 — 'NPC 대사 추가해 줘', '상점 만들어 줘', '추격 장면 만들어 줘'처럼 요청하면 AI 가 명령 초안을 제안합니다. 제안 카드에서 변경 요약과 지도 미리보기를 보고 부분 수락/거부할 수 있습니다.",
          "고스트 미리보기 — AI 가 제안한 변경이 캔버스에 반투명으로 겹쳐 표시됩니다. 수락하기 전에 어디가 바뀌는지 확인할 수 있습니다.",
          "전용 도구 — NPC 배치(place_npc / make_villager), 보물상자(place_chest), 함정(place_trap), 퍼즐(compile_puzzle), 컷신(script_cutscene), 추격(make_chase_scene) 등 이벤트 제작에 특화된 도구가 있습니다.",
          "퀘스트 · 스토리 — define_quest / verify_quest 로 퀘스트 그래프를 만들고 검증합니다. declare_story_flag 로 스토리 플래그에 의미를 붙입니다.",
        ],
      },
      {
        kind: "note",
        text: "AI 제안은 항상 검토 카드를 거칩니다 — 자동으로 저장되지 않습니다. 수락해야 반영되며, 반영 후에도 Ctrl+Z 로 되돌릴 수 있습니다.",
      },
    ],
  },
  {
    id: "shortcuts",
    title: "단축키",
    glyph: "⌨",
    blocks: [
      {
        kind: "p",
        text: "이벤트 에디터에서 자주 쓰는 단축키입니다. 입력란에 포커스가 있을 때는 일부가 동작하지 않습니다.",
      },
    ],
  },
];

const HELP_TEST_ID = "event-editor-help-modal";

export function openEventEditorHelp(): void {
  document.querySelector(`[data-testid='${HELP_TEST_ID}']`)?.remove();

  const closeButton = el("button", {
    class: "help-modal-close",
    text: "×",
    attrs: { type: "button", title: "닫기", "aria-label": "닫기" },
    dataset: { testid: "event-editor-help-close" },
  });
  const closeAction = el("button", {
    class: "help-modal-button",
    text: "닫기",
    attrs: { type: "button" },
    dataset: { testid: "event-editor-help-dismiss" },
    on: { click: () => close() },
  });

  const body = el("div", { class: "help-modal-body" });
  const nav = el("nav", {
    class: "help-modal-nav",
    attrs: { "aria-label": "이벤트 에디터 도움말 목차" },
    dataset: { testid: "event-editor-help-nav" },
  });

  const backdrop = el("div", {
    class: "help-modal-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: HELP_TEST_ID },
    children: [
      el("section", {
        class: "help-modal-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "event-editor-help-title" },
        children: [
          el("header", {
            class: "help-modal-titlebar",
            children: [
              el("div", {
                class: "help-modal-titles",
                children: [
                  el("h2", { text: "이벤트 에디터 가이드", attrs: { id: "event-editor-help-title" } }),
                  el("p", {
                    class: "help-modal-subtitle",
                    text: "이벤트·페이지·조건·명령 사용 설명 — 목차를 눌러 이동하고 Esc 로 닫습니다",
                  }),
                ],
              }),
              closeButton,
            ],
          }),
          el("div", { class: "help-modal-layout", children: [nav, body] }),
          el("footer", { class: "help-modal-footer", children: [closeAction] }),
        ],
      }),
    ],
  });

  // 섹션 렌더 + 목차 연결 + 스크롤 스파이.
  const sectionNodes = new Map<string, HTMLElement>();
  for (const section of GUIDE_SECTIONS) {
    const node = renderSection(section);
    sectionNodes.set(section.id, node);
    body.append(node);
    nav.append(
      el("button", {
        class: "help-modal-nav-item",
        text: section.title,
        attrs: { type: "button" },
        dataset: { testid: `event-editor-help-nav-${section.id}` },
        on: {
          click: () => {
            node.scrollIntoView({ behavior: "smooth", block: "start" });
            setActiveNav(section.id);
          },
        },
      })
    );
  }

  function setActiveNav(activeId: string): void {
    for (const button of nav.querySelectorAll<HTMLButtonElement>(".help-modal-nav-item")) {
      const id = button.dataset.testid?.replace("event-editor-help-nav-", "") ?? "";
      button.classList.toggle("active", id === activeId);
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveNav((entry.target as HTMLElement).dataset.helpSection ?? "");
        }
      }
    },
    { root: body, rootMargin: "0px 0px -70% 0px", threshold: 0 }
  );
  for (const node of sectionNodes.values()) observer.observe(node);
  setActiveNav(GUIDE_SECTIONS[0]?.id ?? "");

  // 이벤트 에디터 모달 위에 겹쳐 뜨므로 modalStack 에 등록 — Esc 가 도움말부터 닫는다.
  let closed = false;
  function close(): void {
    if (closed) return;
    closed = true;
    unregisterModal(backdrop);
    observer.disconnect();
    backdrop.remove();
  }
  registerModal(backdrop, () => close());

  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.body.append(backdrop);
  closeAction.focus();
}

function renderSection(section: GuideSection): HTMLElement {
  const children: HTMLElement[] = [
    el("h3", {
      children: [
        el("span", { class: "help-modal-section-glyph", text: section.glyph }),
        section.title,
      ],
    }),
  ];
  if (section.image) {
    children.push(
      el("figure", {
        class: "help-modal-figure",
        children: [
          el("img", {
            class: "help-modal-figure-img",
            attrs: { src: section.image.src, alt: section.image.alt, loading: "lazy" },
          }),
          el("figcaption", { class: "help-modal-figure-caption", text: section.image.caption }),
        ],
      })
    );
  }
  for (const block of section.blocks) {
    if (block.kind === "p") {
      children.push(el("p", { class: "help-modal-paragraph", text: block.text }));
    } else if (block.kind === "note") {
      children.push(el("p", { class: "help-modal-note", text: block.text }));
    } else {
      children.push(
        el("ul", {
          class: "help-modal-bullets",
          children: block.items.map((item) => el("li", { text: item })),
        })
      );
    }
  }
  if (section.id === "shortcuts") {
    children.push(
      el("div", {
        class: "help-modal-shortcut-grid",
        children: EVENT_EDITOR_SHORTCUTS.map(shortcutCard),
      })
    );
  }
  return el("section", {
    class: "help-modal-section",
    dataset: { helpSection: section.id, testid: `event-editor-help-section-${section.id}` },
    children,
  });
}

function shortcutCard(section: ShortcutSection): HTMLElement {
  return el("div", {
    class: "help-modal-shortcut-card",
    children: [
      el("h4", { text: section.title }),
      el("dl", {
        class: "help-modal-shortcut-list",
        children: section.entries.flatMap((entry) => [
          el("dt", {
            children: entry.keys.map((key) =>
              key === "~"
                ? el("span", { class: "help-modal-key-tilde", text: "~" })
                : el("kbd", { class: "help-modal-key", text: key })
            ),
          }),
          el("dd", { text: entry.desc }),
        ]),
      }),
    ],
  });
}
