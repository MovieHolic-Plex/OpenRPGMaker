import { parameterValueAtLevel } from "@/project/actorModel";
import type { ActorRecord, Project } from "@/project/types";
import { el } from "@/util/dom";
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";

type ActorStudioListOptions = {
  readonly actors: readonly ActorRecord[];
  readonly filteredActors: readonly ActorRecord[];
  readonly selectedId: string | undefined;
  readonly project: Project;
  readonly search: HTMLElement;
  readonly footer: HTMLElement;
  readonly toolbar: HTMLElement;
  readonly onSelect: (actorId: string) => void;
};

export type ActorStudioList = {
  readonly pane: HTMLElement;
  readonly rows: ReadonlyMap<string, HTMLElement>;
  readonly scrollRegion: HTMLElement;
};

const NUMBER_FORMAT = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

/** 레벨·HP·맵 표시 열. 캐릭터·직업 열은 항상 둔다. */
type OptionalActorColumn = "level" | "hp" | "map";

/**
 * 모든 주인공이 같은 값을 가진 열은 숨긴다. 기본 프로젝트는 여섯 명 전부 `1 · 514 · 보임` 이라
 * 목록 폭의 절반이 서로 구별해 주지 못하는 숫자였다(2026-09-23 파티 UX 검토). 판정은 검색
 * 결과가 아니라 **전체** 주인공으로 한다 — 검색할 때마다 열이 생겼다 사라지면 안 된다.
 */
export function visibleActorColumns(actors: readonly ActorRecord[]): ReadonlySet<OptionalActorColumn> {
  const varies = (value: (actor: ActorRecord) => string | number): boolean =>
    new Set(actors.map(value)).size > 1;
  const columns = new Set<OptionalActorColumn>();
  if (varies((actor) => actor.initialLevel)) columns.add("level");
  if (varies((actor) => parameterValueAtLevel(actor.parameterCurves.maxHp, actor.initialLevel))) columns.add("hp");
  if (varies((actor) => String(actor.characterTransparent))) columns.add("map");
  return columns;
}

export function renderActorStudioList(options: ActorStudioListOptions): ActorStudioList {
  const rows = new Map<string, HTMLElement>();
  const classNames = new Map(options.project.database.classes.map((record) => [record.id, record.name]));
  const columns = visibleActorColumns(options.actors);
  const startParty = new Set(options.project.system.startActorIds);
  const table = el("div", {
    class: "db-list db-actor-studio-table",
    // 행을 고를 수 있는 표라서 role=grid 다 — role=table 의 행은 aria-selected 를 갖지 못한다.
    attrs: { role: "grid", "aria-label": "주인공 데이터 표" },
    dataset: { columnCount: String(2 + columns.size) },
    children: [
      el("div", {
        class: "db-actor-table-row db-actor-table-header",
        attrs: { role: "row" },
        dataset: { testid: "db-actor-table-header" },
        children: [
          tableCell("캐릭터", "columnheader"),
          tableCell("직업", "columnheader"),
          ...(columns.has("level") ? [tableCell("레벨", "columnheader")] : []),
          ...(columns.has("hp") ? [tableCell("HP", "columnheader")] : []),
          ...(columns.has("map") ? [tableCell("맵 표시", "columnheader")] : []),
        ],
      }),
    ],
  });

  for (const actor of options.filteredActors) {
    const row = actorRow(actor, classNames.get(actor.classId) ?? "미지정", actor.id === options.selectedId, options.project, columns, startParty.has(actor.id));
    row.addEventListener("click", () => {
      if (actor.id === options.selectedId && row.classList.contains("active")) return;
      for (const candidate of rows.values()) candidate.classList.remove("active");
      row.classList.add("active");
      options.onSelect(actor.id);
    });
    rows.set(actor.id, row);
    table.append(row);
  }

  if (options.filteredActors.length === 0) {
    table.append(el("p", { class: "db-actor-table-empty", text: "검색 조건에 맞는 주인공이 없습니다." }));
  }

  return {
    pane: el("section", {
      class: "oprn-record-list-pane db-studio-table-pane",
      dataset: { testid: "db-actor-studio" },
      children: [
        el("header", {
          class: "db-actor-studio-heading",
          children: [
            el("div", {
              children: [
                el("h3", { text: "주인공" }),
              ],
            }),
            el("span", { class: "db-actor-studio-count", text: `${options.actors.length}명` }),
          ],
        }),
        el("div", {
          class: "db-actor-studio-tools",
          children: [options.search],
        }),
        table,
        options.footer,
        options.toolbar,
      ],
    }),
    rows,
    scrollRegion: table,
  };
}

function actorRow(
  actor: ActorRecord,
  className: string,
  selected: boolean,
  project: Project,
  columns: ReadonlySet<OptionalActorColumn>,
  inStartParty: boolean,
): HTMLElement {
  const initialHp = parameterValueAtLevel(actor.parameterCurves.maxHp, actor.initialLevel);
  const thumbnail = recordListThumbnail("actors", actor, project, 36);
  return el("button", {
    class: `db-list-row db-actor-table-row${selected ? " active" : ""}`,
    // 선택 상태를 CSS 클래스로만 알리면 보조기술이 못 읽는다. 다른 레코드 목록은
    // databaseRecordViews.ts 에서 aria-pressed 를 세우지만, 여기는 role=row 이므로
    // 유효한 상태 속성은 aria-selected 다.
    attrs: { role: "row", type: "button", "aria-selected": String(selected) },
    dataset: { recordId: actor.id, testid: `db-record-row-${actor.id}` },
    children: [
      el("span", {
        class: "db-actor-identity-cell",
        attrs: { role: "gridcell" },
        children: [
          thumbnail ?? el("span", { class: "db-actor-avatar-fallback", text: actor.name.slice(0, 1) || "?" }),
          el("span", {
            class: "db-actor-name-stack",
            children: [
              el("strong", { class: "db-list-name", text: actor.name }),
              el("small", {
                children: [
                  actorSubLabel(actor),
                  ...(inStartParty
                    ? [el("span", { class: "db-actor-party-mark", text: "시작 파티", dataset: { testid: `db-actor-party-mark-${actor.id}` } })]
                    : []),
                ],
              }),
            ],
          }),
        ],
      }),
      tableCell(className, "gridcell"),
      ...(columns.has("level") ? [tableCell(String(actor.initialLevel), "gridcell", "numeric")] : []),
      ...(columns.has("hp") ? [tableCell(NUMBER_FORMAT.format(initialHp), "gridcell", "numeric")] : []),
      // 맵 표시: 기본값(보임)까지 초록 알약으로 그리면 모든 행에 같은 뱃지가 도배돼
      // 정작 예외인 "투명"이 눈에 안 띈다 — 예외일 때만 뱃지를 세운다.
      ...(columns.has("map")
        ? [el("span", {
            class: `db-actor-status${actor.characterTransparent ? " is-hidden" : " is-default"}`,
            attrs: { role: "gridcell" },
            text: actor.characterTransparent ? "투명" : "보임",
          })]
        : []),
    ],
  });
}

// `role="grid"` 의 행이 소유하는 셀 역할은 `gridcell` 이다 — `cell` 은 `role="table"` 전용이라
// 대화형 그리드 안에서는 매핑이 어긋난다(ARIA 1.2). 헤더는 `columnheader` 그대로 맞다.
function tableCell(text: string, role: "gridcell" | "columnheader", className = ""): HTMLElement {
  return el("span", { class: className, attrs: { role }, text });
}

// 목록 두 번째 줄 — 칭호가 있으면 칭호, 없으면 식별용 id.
// 예제 데이터의 칭호는 빈 문자열 대신 "없음"/"-" 같은 자리표시 값으로 들어오는 경우가 있어
// 그대로 쓰면 목록에 "없음"이 칭호처럼 박힌다 — 자리표시 값은 칭호 없음으로 취급한다.
const NICKNAME_PLACEHOLDERS: ReadonlySet<string> = new Set(["없음", "-", "—", "미정", "무"]);

function actorSubLabel(actor: ActorRecord): string {
  const nickname = (actor.nickname ?? "").trim();
  if (nickname.length > 0 && !NICKNAME_PLACEHOLDERS.has(nickname)) return nickname;
  return `#${actor.id}`;
}
