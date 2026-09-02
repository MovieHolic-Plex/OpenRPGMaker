// editor/panels/helpModal.ts
// 도움말 모달 — 툴바 "도움말" 버튼과 도움말 메뉴, 커맨드 팔레트(Ctrl+K)에서 연다.
// 에디터 전체를 설명하는 인앱 위키: 개요, 화면 구성, 지도/이벤트/데이터베이스/소재/오디오/
// 시연 실행/저장 공유, 마지막에 단축키 요약. 왼쪽 목차에서 섹션으로 바로 이동한다.
import { PRODUCT_BRAND, PRODUCT_TAGLINE } from "@/brand";
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
  readonly image?: { readonly src: string; readonly alt: string; readonly caption: string };
  readonly blocks: readonly GuideBlock[];
};

const SHORTCUT_SECTIONS: readonly ShortcutSection[] = [
  {
    title: "도구",
    entries: [
      { keys: ["V"], desc: "선택 도구" },
      { keys: ["B"], desc: "칠하기" },
      { keys: ["E"], desc: "지우기" },
      { keys: ["G"], desc: "채우기" },
      { keys: ["N"], desc: "이벤트 도구" },
      { keys: ["I"], desc: "타일 집기" },
      { keys: ["1", "~", "7"], desc: "칠하기·채우기·타일 집기·화면 밀기·영역 선택·통행 표시·장면 놓기" },
      { keys: ["Space"], desc: "누르는 동안 화면 밀기" },
      { keys: ["우클릭"], desc: "타일 집기 (구조물 위에서는 구조물 메뉴)" },
      { keys: ["우클릭 드래그"], desc: "영역 선택 — 놓으면 AI 작업·복사·지우기·구조물로 저장" },
    ],
  },
  {
    title: "레이어 · 화면",
    entries: [
      { keys: ["F5"], desc: "바닥 레이어" },
      { keys: ["F6"], desc: "덧그림 레이어" },
      { keys: ["F7"], desc: "이벤트 레이어" },
      { keys: ["+", "-"], desc: "줌 인 / 줌 아웃" },
      { keys: ["가운데 드래그"], desc: "맵 화면 이동" },
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
      { keys: ["Ctrl", "K"], desc: "명령 · 맵 · 스킬 검색 팔레트" },
    ],
  },
];

const GUIDE_SECTIONS: readonly GuideSection[] = [
  {
    id: "overview",
    title: "개요",
    image: {
      src: "/assets/help/overview.png",
      alt: `${PRODUCT_BRAND} 에디터 전체 화면`,
      caption: "에디터 전체 화면 — 상단 도구막대, 왼쪽 타일 팔레트와 맵 트리, 중앙 캔버스로 구성됩니다.",
    },
    blocks: [
      {
        kind: "p",
        text: `${PRODUCT_BRAND}는 ${PRODUCT_TAGLINE}입니다. 사람은 예술 감독을 하고 AI 가 일관성 노동을 맡는 분업을 전제로 설계했습니다 — 감독이 보고·판단하고 다시 지시하는 왕복을 짧게 만드는 것이 이 도구의 목표입니다. 설치 없이 브라우저에서 지도·이벤트·데이터를 만들고 바로 시연 실행까지 할 수 있습니다.`,
      },
      {
        kind: "list",
        items: [
          "지도 편집 — 타일 그림판에서 바닥·덧그림·통행을 칠하고 여러 지도를 트리 구조로 관리합니다.",
          "이벤트 — NPC 대사, 문 열기, 전투, 상점 같은 게임 로직을 명령 조립식으로 작성합니다.",
          "AI 협업 — 맵 이름·NPC 시간표·인카운터 배선 같은 연결조직 작업을 AI 에게 맡기고 결과를 before/after 로 검수합니다.",
          "자료집 — 주인공·직업·스킬·아이템·적·적 그룹 등 게임의 기초 데이터를 편집합니다.",
          "시연 실행 — 만든 게임을 에디터 안에서 즉시 실행해 확인합니다.",
          "저장·공유 — 작업은 온라인에 자동 저장되고, 파일로 내보내거나 웹 게임으로 배포할 수 있습니다.",
        ],
      },
      {
        kind: "note",
        text: "화면 밀도는 오른쪽 위의 모드 전환으로 고를 수 있습니다. 기본 모드는 꼭 필요한 도구만 남긴 간결한 셸이고, 전문가 모드는 전체 도구막대와 맵 트리를 보여주는 완전한 편집 셸입니다.",
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
          "상단 메뉴 — 프로젝트·맵·도구·게임·도움말 메뉴와 저장/열기 버튼, 모드 전환, 시연 실행 버튼이 있습니다.",
          "전체 도구막대 (전문가 모드) — 새 프로젝트, 저장, 열기, 가져오기, 레이어 전환(바닥/덧그림/이벤트), 줌 x1~x8, 자료집, 자료, 세계관, 음악, 찾기, 도움말 버튼이 한 줄로 늘어서 있습니다.",
          "왼쪽 패널 — 타일 팔레트와 맵 트리가 있습니다. 팔레트에서 타일을 고르고 캔버스에 칠합니다.",
          "캔버스 — Phaser 기반 지도 편집기입니다. 휠로 줌, 가운데 버튼 드래그로 화면을 이동합니다.",
          "캔버스 우클릭 — 그 자리의 타일을 집습니다. 구조물 위에서는 구조물 메뉴가 열립니다.",
          "캔버스 우클릭 드래그 — 영역을 잡습니다. 놓은 자리에 「AI 작업」·복사·붙여넣기·지우기·「구조물로 저장」 바가 뜹니다.",
          "상태 표시줄 — 현재 지도, 레이어, 도구, 선택 정보가 표시됩니다.",
        ],
      },
    ],
  },
  {
    id: "map",
    title: "지도 편집",
    image: {
      src: "/assets/help/map.png",
      alt: "지도 편집 화면",
      caption: "지도 편집 — 팔레트에서 타일을 골라 캔버스에 칠합니다. 줌 버튼으로 확대/축소할 수 있습니다.",
    },
    blocks: [
      {
        kind: "p",
        text: "지도는 세 개의 레이어로 겹쳐 그립니다. 바닥 레이어는 지면처럼 캐릭터 발밑에 깔리는 타일, 덧그림 레이어는 캐릭터 위로 덮어 그려지는 것(지붕, 나뭇가지 등), 이벤트 레이어는 NPC·문·보물상자 같은 이벤트가 놓이는 층입니다. F5/F6/F7 또는 도구막대 버튼으로 레이어를 전환합니다.",
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
        text: "맵 트리에서는 지도를 추가·삭제하고 시작 지도를 지정합니다. 지도를 더블클릭하면 다른 지도로 이동합니다. 줌은 도구막대의 x1~x8 버튼이나 +/- 키로 조절합니다.",
      },
    ],
  },
  {
    id: "event",
    title: "이벤트",
    image: {
      src: "/assets/help/event.png",
      alt: "이벤트 편집기",
      caption: "이벤트 편집기 — 페이지와 명령을 조립해 NPC 대사, 전투, 이동 같은 게임 로직을 만듭니다.",
    },
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
          "Ctrl+K 팔레트 — 명령·맵·스킬을 이름으로 검색해 빠르게 이동하거나 실행합니다.",
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
    title: "데이터베이스",
    image: {
      src: "/assets/help/database.png",
      alt: "데이터베이스 모달",
      caption: "데이터베이스 — 액터·직업·스킬·아이템·적 등 게임의 기초 데이터를 편집합니다.",
    },
    blocks: [
      {
        kind: "p",
        text: "데이터베이스는 게임의 기초 체력을 정의하는 곳입니다. 도구막대의 [DB] 버튼 또는 도구 메뉴에서 엽니다.",
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
    image: {
      src: "/assets/help/resource.png",
      alt: "자료 보관함",
      caption: "자료 보관함 — 타일 그림판·캐릭터·음악·효과음 등 프로젝트 자료를 확인하고 교체합니다.",
    },
    blocks: [
      {
        kind: "list",
        items: [
          "자료 보관함 — 도구막대의 [자료]에서 타일 그림판·캐릭터·얼굴 그림·음악·효과음 등 프로젝트에 포함된 리소스를 확인하고 교체합니다.",
          "세계관 — 도구막대의 [세계관]에서 세계 설정 문서를 편집합니다. 게임의 배경 이야기를 정리하는 공간입니다.",
          "음악/효과음 미리듣기 — 도구막대의 [음악] 버튼을 누르면 BGM·효과음 테스트 창이 열립니다. 음악/효과음 탭을 전환하고 곡을 골라 [재생]으로 들어 본 뒤, 이벤트의 BGM 재생/효과음 재생 명령에서 같은 곡을 지정하면 됩니다.",
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
    title: "시연 실행",
    blocks: [
      {
        kind: "list",
        items: [
          "시연 실행 — 상단의 [시연 실행] 버튼(또는 게임 메뉴)으로 편집 중인 게임을 즉시 실행합니다. Esc 또는 정지 버튼으로 에디터로 돌아옵니다.",
          "시연 실행 창 — 게임을 별도 창으로 열어 에디터와 나란히 띄워 둡니다.",
          "랜덤 전투 테스트 — 멤버가 편성된 적 그룹을 무작위로 골라 전투 화면을 바로 띄웁니다. 전투 밸런스 확인용입니다.",
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
          "저장(Ctrl+S) — 지금 작업을 온라인에 저장합니다.",
          "열기 — 온라인에 저장된 작업 목록에서 불러옵니다.",
          "저장본 다시 불러오기 — 아직 저장하지 않은 변경을 버리고 온라인의 최신 저장본을 불러옵니다.",
          "내보내기/가져오기 — 프로젝트를 RPGZZU/JSON 패키지 파일로 백업하거나 다른 곳에서 불러옵니다.",
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

export function openHelpModal(): void {
  document.querySelector("[data-testid='help-modal']")?.remove();

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

  function close(): void {
    observer.disconnect();
    unregisterModal(backdrop);
    backdrop.remove();
  }

  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.body.append(backdrop);
  // Escape 는 공용 모달 스택이 라우팅한다. 자체 document 리스너로 잡으면 도크 모드에서
  // 데이터베이스를 켠 채 이 창을 열었을 때 데이터베이스까지 함께 닫혔다.
  registerModal(backdrop, close);
  closeAction.focus();
}

function renderSection(section: GuideSection): HTMLElement {
  const children: HTMLElement[] = [el("h3", { text: section.title })];
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
