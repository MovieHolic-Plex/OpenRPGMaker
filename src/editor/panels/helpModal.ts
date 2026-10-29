// editor/panels/helpModal.ts
// 도움말 모달 — 툴바 "도움말" 버튼과 도움말 메뉴, 커맨드 팔레트(Ctrl+K)에서 연다.
// 에디터 전체를 설명하는 인앱 위키: 개요, 화면 구성, 지도/이벤트/데이터베이스/소재/오디오/
// 시연 실행/저장 공유, 마지막에 단축키 요약. 왼쪽 목차에서 섹션으로 바로 이동한다.
import { APP_VERSION, PRODUCT_BRAND, PRODUCT_TAGLINE, appVersionDetail } from "@/brand";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { el } from "@/util/dom";

type ShortcutEntry = {
  /** 키보드 키(키캡으로 그린다). 마우스 동작은 gesture 로 쓴다 — 키가 아닌 것을 키캡으로 그리지 않는다. */
  readonly keys?: readonly string[];
  readonly gesture?: string;
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
  /** 현재 화면을 찍은 그림만 넣는다. 옛 「AI RPG MAKER」 어두운 화면 캡처 다섯 장은 2026-10-28 에 뺐다
   *  (지금 화면과 달라 길을 잘못 알려 줬다 — C-29·C-111). 새로 찍으면 다시 단다. */
  readonly image?: { readonly src: string; readonly alt: string; readonly caption: string };
  readonly blocks: readonly GuideBlock[];
};

const SHORTCUT_SECTIONS: readonly ShortcutSection[] = [
  {
    title: "도구",
    entries: [
      { keys: ["V"], desc: "영역 선택" },
      { keys: ["B"], desc: "칠하기" },
      { keys: ["E"], desc: "지우기" },
      { keys: ["G"], desc: "채우기" },
      { keys: ["N"], desc: "이벤트 도구" },
      { keys: ["I"], desc: "타일 집기" },
      { keys: ["1", "~", "7"], desc: "도구를 순서대로 고르기 (칠하기 … 장면 놓기)" },
      { keys: ["Space"], desc: "누르는 동안 화면 밀기" },
      { gesture: "우클릭", desc: "타일 집기 (구조물 위에서는 구조물 메뉴)" },
      { gesture: "우클릭 드래그", desc: "영역 선택 — AI 작업·복사·지우기" },
    ],
  },
  {
    title: "레이어 · 화면",
    entries: [
      { keys: ["Shift", "1"], desc: "바닥 레이어" },
      { keys: ["Shift", "2"], desc: "상위 레이어" },
      { keys: ["Shift", "3"], desc: "이벤트 레이어 (F7 도 됩니다)" },
      { keys: ["+", "-"], desc: "줌 인 / 줌 아웃" },
      { gesture: "가운데 드래그", desc: "맵 화면 이동" },
    ],
  },
  {
    title: "편집 · 프로젝트",
    entries: [
      { keys: ["Ctrl", "S"], desc: "프로젝트 저장" },
      { keys: ["Ctrl", "Z"], desc: "실행취소" },
      { keys: ["Ctrl", "Y"], desc: "다시실행" },
      { keys: ["Ctrl", "C"], desc: "복사" },
      { keys: ["Ctrl", "V"], desc: "붙여넣기" },
      { keys: ["Ctrl", "K"], desc: "명령 팔레트 — 명령 실행 · 맵 이동" },
      { keys: ["Ctrl", "Shift", "F"], desc: "맵·이벤트 찾기" },
      { keys: ["Ctrl", "Alt", "M"], desc: "음악·효과음" },
      { keys: ["Ctrl", "Alt", "W"], desc: "세계관" },
      { keys: ["?"], desc: "단축키 보기" },
    ],
  },
];

const GUIDE_SECTIONS: readonly GuideSection[] = [
  {
    id: "overview",
    title: "개요",
    blocks: [
      {
        kind: "p",
        text: `${PRODUCT_BRAND}는 ${PRODUCT_TAGLINE}입니다. 데스크톱 앱이나 실행 중인 프로젝트 호스트에 연결해 지도·이벤트·데이터를 만들고 테스트할 수 있습니다. 개인 브라우저 실행에는 Node.js 24와 로컬 실행기가 필요합니다. AI를 연결하면 제작을 도와주며, AI 없이도 직접 편집할 수 있습니다.`,
      },
      {
        kind: "list",
        items: [
          "지도 편집 — 타일 그림판에서 바닥·상위·통행을 칠하고 여러 지도를 트리 구조로 관리합니다.",
          "이벤트 — NPC 대사, 문 열기, 전투, 상점 같은 게임 로직을 명령 조립식으로 작성합니다.",
          "AI 협업 — 맵 이름·NPC 시간표·인카운터 배선 같은 연결조직 작업을 AI 에게 맡기고 결과를 before/after 로 검수합니다.",
          "자료집 — 주인공·직업·스킬·아이템·적·적 그룹 등 게임의 기초 데이터를 편집합니다.",
          "테스트 실행 — 만든 게임을 에디터 안에서 즉시 실행해 확인합니다.",
          "저장·공유 — 앱과 프로젝트 호스트에서는 선택한 프로젝트 폴더에 자동 저장됩니다. ‘이 세션은 저장 안 됨’이 보이면 프로젝트 파일로 내보내야 보존됩니다. 프로젝트 메뉴에서 백업을 만들고 새 프로젝트로 복구하거나 웹 게임으로 내보낼 수 있습니다.",
        ],
      },
    ],
  },
  {
    id: "layout",
    title: "화면 구성",
    blocks: [
      {
        kind: "list",
        items: [
          "상단 바 — 한 줄입니다. 왼쪽은 프로젝트 이름(메뉴)·저장·[자료집]·[소재]·지형 붓·바닥·상위·이벤트, 이어서 세계관·음악·효과음·찾기 아이콘과 지금 도구·저장 상태입니다. 가운데는 명령 팔레트(Ctrl+K)입니다. 오른쪽은 [테스트]·랜덤 전투 테스트·AI 스튜디오·[보기]·도움말·언어·저장 기록·신원·AI 설정·전체화면입니다.",
          "창이 좁으면 세계관·음악·효과음·찾기·전체화면이 [도구 더 보기]로 접힙니다. 더 좁으면 상단 바를 옆으로 밀어 나머지 단추에 닿습니다. 배율은 캔버스 오른쪽 위의 −/+ 와 배율 목록입니다. 단계는 0.25·0.5·1·2·3·4·6·8배입니다.",
          "왼쪽 패널 — 타일 팔레트와 맵 트리가 있습니다. 팔레트에서 타일을 고르고 캔버스에 칠합니다.",
          "캔버스 — Phaser 기반 지도 편집기입니다. 휠로 줌, 가운데 버튼 드래그로 화면을 이동합니다.",
          "캔버스 우클릭 — 그 자리의 타일을 집습니다. 구조물 위에서는 구조물 메뉴가 열립니다.",
          "캔버스 우클릭 드래그 — 영역을 잡습니다. 놓은 자리에 「AI 작업」·복사·붙여넣기·지우기·「구조물로 저장」 바가 뜹니다.",
          "왼쪽 위 선택 칩 — 지금 고른 타일과 타일셋 이름이 보입니다. 타일셋 이름을 누르면 맵 설정이 열립니다.",
        ],
      },
    ],
  },
  {
    id: "map",
    title: "지도 편집",
    blocks: [
      {
        kind: "p",
        text: "지도는 세 개의 레이어로 겹쳐 그립니다. 바닥 레이어는 지면처럼 캐릭터 발밑에 깔리는 타일, 상위 레이어는 캐릭터 위로 덮어 그려지는 것(지붕, 나뭇가지 등), 이벤트 레이어는 NPC·문·보물상자 같은 이벤트가 놓이는 층입니다. Shift+1/2/3 또는 헤더의 바닥·상위·이벤트 버튼으로 레이어를 전환합니다.",
      },
      {
        kind: "list",
        items: [
          "칠하기(B) — 선택한 타일로 한 칸씩 그립니다. 드래그하면 연속으로 칠해집니다.",
          "채우기(G) — 클릭한 지점과 이어진 같은 타일 영역을 한 번에 채웁니다.",
          "타일 집기(I) — 캔버스의 타일을 찍어 팔레트 선택으로 가져옵니다.",
          "화면 밀기 — 캔버스를 드래그해 화면을 옮깁니다. Space를 누르고 드래그해도 됩니다.",
          "선택(V) — 직사각형 영역을 선택해 복사·붙여넣기·지우기를 합니다. 선택 영역에는 플로팅 도구막대가 뜹니다.",
          "통행 표시 — 지나갈 수 있는 칸인지 표시하고 바꿉니다.",
          "장면 놓기(N) — 이벤트 레이어에서 이벤트를 만들거나 선택합니다.",
        ],
      },
      {
        kind: "p",
        text: "맵 트리에서는 지도를 추가·삭제하고 시작 지도를 지정합니다. 지도를 더블클릭하면 다른 지도로 이동합니다. 줌은 캔버스 오른쪽 위의 −/+ 버튼과 배율 목록, 또는 +/- 키로 조절합니다.",
      },
    ],
  },
  {
    id: "event",
    title: "이벤트",
    blocks: [
      {
        kind: "p",
        text: "이벤트는 게임의 '일'을 정의하는 객체입니다. NPC와의 대화, 문 열기, 보물상자, 맵 이동, 전투 발생, 컷신까지 모두 이벤트 명령의 조합입니다. 이벤트 레이어(F7)에서 이벤트를 더블클릭하거나 이벤트 도구(N)로 새 이벤트를 만들면 이벤트 편집기가 열립니다.",
      },
      {
        kind: "list",
        items: [
          "페이지 구조 — 이벤트는 하나 이상의 페이지로 구성됩니다. 각 페이지는 언제 보일지(스위치·변수 등)와 무엇을 할지(명령 목록)를 가지며, 조건을 만족하는 마지막 페이지가 동작합니다.",
          "명령 — 글자 표시, 선택지, 이동, 전투, 상점, 여관, 장소 이동, 기다리기, 변수 조작, 주석 등을 순서대로 조립합니다.",
          "그래픽 — 이벤트의 외형을 캐릭터 타일 그림판이나 얼굴 그림으로 지정할 수 있습니다. 움직임 패턴·애니메이션도 설정됩니다.",
          "이동 경로 — 이벤트가 스스로 움직이는 경로를 페이지 단위 또는 명령(이동 경로 지정)으로 편집합니다.",
          "Ctrl+K 명령 팔레트 — 명령을 실행하거나 맵으로 이동합니다.",
        ],
      },
      {
        kind: "note",
        text: "이벤트 편집기 안에서도 실행취소/다시실행(Ctrl+Z/Y)이 동작하고, 명령을 우클릭하면 복사·잘라내기·붙여넣기 메뉴가 나옵니다.",
      },
    ],
  },
  {
    id: "database",
    title: "자료집",
    blocks: [
      {
        kind: "p",
        text: "자료집은 게임의 기초 데이터를 정하는 곳입니다. 상단 바의 [자료집] 버튼이나 명령 팔레트(Ctrl+K)에서 엽니다.",
      },
      {
        kind: "list",
        items: [
          "액터 — 주인공과 동료 캐릭터. 이름, 그래픽, 초기 레벨, 장비를 설정합니다.",
          "직업(클래스) — 성장 곡선, 장비 가능 무기·방어구,습득 스킬을 정의합니다.",
          "스킬 — 이름, 효과(대미지·회복·상태 변화), 소모 MP, 사용 메시지를 만듭니다.",
          "아이템 — 소비·장비 아이템과 가격, 효과를 설정합니다.",
          "적 · 적 그룹(트룹) — 전투에 나오는 적과 그 편성, 전투 이벤트를 만듭니다.",
          "타일 그림판 · 상태 · 속성 등 — 그림판 구성, 상태 이상, 속성 상성 등 나머지 기초 데이터도 여기서 관리합니다.",
        ],
      },
    ],
  },
  {
    id: "resource",
    title: "자료 · 세계관 · 오디오",
    blocks: [
      {
        kind: "list",
        items: [
          "소재 보관함 — 상단 바의 [소재]에서 타일 그림판·캐릭터·얼굴 그림·음악·효과음 등 프로젝트에 포함된 리소스를 확인하고 교체합니다.",
          "세계관 — 상단 바의 책 아이콘(세계관)에서 세계 설정 문서를 편집합니다. 창이 좁으면 [도구 더 보기] 안에 있습니다.",
          "음악·효과음 미리듣기 — 상단 바의 음표 아이콘(음악·효과음)을 누르면 테스트 창이 열립니다. 음악과 효과음 탭을 바꾸고 곡을 고른 뒤 [재생]으로 듣습니다. 같은 곡을 이벤트의 BGM 재생·효과음 재생 명령에 지정합니다. 창이 좁으면 아이콘은 [도구 더 보기] 안에 있습니다.",
        ],
      },
      {
        kind: "note",
        text: "브라우저에서는 MIDI BGM을 재생할 수 없어 해당 항목은 목록에 재생 불가로 표시됩니다. CC0 WAV/OGG 소재는 바로 들을 수 있습니다.",
      },
    ],
  },
  {
    id: "play",
    title: "테스트 실행",
    blocks: [
      {
        kind: "list",
        items: [
          "테스트 실행 — 상단 바 오른쪽의 [테스트]로 편집 중인 게임을 편집기 위의 창에서 실행합니다. 제목 줄의 [편집으로] 또는 [×]로 편집으로 돌아옵니다. 게임 안의 Esc는 메뉴·취소입니다.",
          "창 크기 — 제목 줄의 [창]과 [전체 화면]으로 바꿉니다. 창 모드에서는 모서리를 끌어 크기를 조절합니다.",
          "랜덤 전투 테스트 — [테스트] 옆 주사위 아이콘입니다. 멤버가 편성된 적 그룹을 무작위로 골라 전투 화면을 바로 띄웁니다.",
        ],
      },
    ],
  },
  {
    id: "save",
    title: "저장 · 가져오기 · 공유",
    blocks: [
      {
        kind: "list",
        items: [
          "프로젝트 폴더에 연결되어 있으면 변경을 자동으로 저장합니다. 저장(Ctrl+S)은 지금 저장을 요청합니다. 상단의 저장 상태를 확인하세요.",
          "열기 — 앱이나 호스트에 있는 프로젝트 폴더를 선택합니다.",
          "저장본 다시 불러오기 — 아직 저장하지 않은 변경을 버리고 프로젝트 폴더의 최신 저장본을 불러옵니다.",
          "백업 만들기 — 현재 변경을 저장한 뒤 프로젝트와 소재의 복구 지점을 남깁니다. 중요한 편집 전에는 백업을 만드세요.",
          "백업에서 복구 — 백업을 검사하고 새 프로젝트 폴더로 엽니다. 현재 프로젝트와 백업은 보존됩니다.",
          `내보내기/가져오기 — 프로젝트를 ${PRODUCT_BRAND} 패키지(.oprn)나 JSON 파일로 백업하거나 다른 곳에서 불러옵니다.`,
          "저장 실패나 ‘임시 작업’ 상태에서는 프로젝트 파일 내보내기로 화면의 작업을 먼저 보관하세요. 백업 파일만 남긴 상태에서 앱을 열 수 없으면 README의 복구 명령을 사용하세요.",
          "웹 내보내기 — 게임을 웹에서 실행 가능한 형태로 배포합니다.",
        ],
      },
    ],
  },
  {
    id: "shortcuts",
    title: "단축키",
    blocks: [
      {
        kind: "p",
        text: "자주 쓰는 단축키입니다. 입력란에 포커스가 있을 때는 동작하지 않습니다.",
      },
    ],
  },
];

/**
 * @param sectionId 열자마자 이동할 목차 항목(GUIDE_SECTIONS 의 id). 생략하면 맨 위.
 *   호출부가 이미 문맥을 아는 경우(예: DB 모달의 [도움말])에 그 자리로 바로 보낸다.
 */
export function openHelpModal(sectionId?: string): void {
  document.querySelector("[data-testid='help-modal']")?.remove();
  // 닫으면 연 자리로 초점을 돌려준다. 명령 팔레트처럼 연 자리가 이미 사라졌으면 도움말 메뉴 단추로 간다.
  const returnFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;

  const closeButton = el("button", {
    class: "help-modal-close",
    text: "×",
    attrs: { type: "button", title: "닫기", "aria-label": "닫기" },
    dataset: { testid: "help-modal-close" },
  });
  const closeAction = el("button", {
    class: "help-modal-button",
    text: "닫기",
    attrs: { type: "button" },
    dataset: { testid: "help-modal-dismiss" },
    on: { click: () => close() },
  });

  const body = el("div", { class: "help-modal-body" });
  const nav = el("nav", {
    class: "help-modal-nav",
    attrs: { "aria-label": "도움말 목차" },
    dataset: { testid: "help-modal-nav" },
  });

  const backdrop = el("div", {
    class: "help-modal-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "help-modal" },
    children: [
      el("section", {
        class: "help-modal-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "help-modal-title" },
        children: [
          el("header", {
            class: "help-modal-titlebar",
            children: [
              el("div", {
                class: "help-modal-titles",
                children: [
                  el("h2", { text: "에디터 가이드", attrs: { id: "help-modal-title" } }),
                  el("p", {
                    class: "help-modal-subtitle",
                    text: `${PRODUCT_BRAND} 사용 설명 — 목차를 눌러 이동하고 Esc로 닫습니다`,
                  }),
                  // 버전을 여기 두는 이유: 버그 리포트를 쓰는 사람이 보는 화면이 도움말이고,
                  // 창 제목·푸터는 다른 정보가 이미 차지하고 있다. 값은 빌드가 주입한다.
                  el("p", {
                    class: "help-modal-version",
                    text: `버전 ${APP_VERSION}`,
                    attrs: { title: appVersionDetail() },
                    dataset: { testid: "help-modal-version" },
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
        dataset: { testid: `help-modal-nav-${section.id}` },
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
      const id = button.dataset.testid?.replace("help-modal-nav-", "") ?? "";
      button.classList.toggle("active", id === activeId);
    }
  }

  // 끝까지 내리면 마지막 절(단축키)은 위 30% 띠에 닿지 못한다 — 그때는 마지막 절을 활성으로 둔다.
  // 부드러운 스크롤은 교차 알림이 끝에 닿기 전에 멈추므로 scroll 사건에서도 같은 규칙을 적용한다.
  const activateLastAtEnd = (): boolean => {
    if (body.scrollTop <= 0 || body.scrollTop + body.clientHeight < body.scrollHeight - 2) return false;
    setActiveNav(GUIDE_SECTIONS[GUIDE_SECTIONS.length - 1]?.id ?? "");
    return true;
  };
  body.addEventListener("scroll", activateLastAtEnd, { passive: true });
  const observer = new IntersectionObserver(
    (entries) => {
      if (activateLastAtEnd()) return;
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

  function close(): void {
    observer.disconnect();
    unregisterModal(backdrop);
    backdrop.remove();
    const target = returnFocus?.isConnected ? returnFocus : document.querySelector<HTMLElement>("[data-testid='menu-help']");
    target?.focus();
  }

  closeButton.addEventListener("click", close);
  // aria-modal 이므로 Tab/Shift+Tab 이 창 안의 첫·마지막 단추 사이에서만 돈다(뒤 톱바로 새지 않게).
  backdrop.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusables = [...backdrop.querySelectorAll<HTMLElement>("button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex='-1'])")];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !backdrop.contains(active))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (active === last || !backdrop.contains(active))) { event.preventDefault(); first.focus(); }
  });
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.body.append(backdrop);
  // Escape 는 공용 모달 스택이 라우팅한다. 자체 document 리스너로 잡으면 도크 모드에서
  // 데이터베이스를 켠 채 이 창을 열었을 때 데이터베이스까지 함께 닫혔다.
  registerModal(backdrop, close);
  // 호출부가 지정한 섹션으로 바로 이동한다. 스크롤은 부착 뒤여야 먹는다.
  const requested = sectionId ? sectionNodes.get(sectionId) : undefined;
  if (requested && sectionId) {
    // 부드러운 스크롤(CSS)을 쓰면 다른 초점 이동에 끊겨 절 중간에 멈췄다 — 처음 위치는 즉시 옮긴다.
    requested.scrollIntoView({ block: "start", behavior: "instant" });
    setActiveNav(sectionId);
    // 그 절의 제목으로 초점을 보낸다 — 낭독기는 제목부터 읽고, Tab 은 그 절에서 이어진다.
    const heading = requested.querySelector<HTMLElement>("h3");
    if (heading) {
      heading.focus({ preventScroll: true });
      return;
    }
  }
  closeAction.focus();
}

function renderSection(section: GuideSection): HTMLElement {
  const children: HTMLElement[] = [el("h3", { text: section.title, attrs: { tabindex: "-1" } })];
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
        children: SHORTCUT_SECTIONS.map(shortcutCard),
      })
    );
  }
  return el("section", {
    class: "help-modal-section",
    dataset: { helpSection: section.id, testid: `help-modal-section-${section.id}` },
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
            children: entry.gesture
              ? [el("span", { class: "help-modal-gesture", text: entry.gesture })]
              : (entry.keys ?? []).map((key) =>
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
