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

export function renderActorStudioList(options: ActorStudioListOptions): ActorStudioList {
  const rows = new Map<string, HTMLElement>();
  const classNames = new Map(options.project.database.classes.map((record) => [record.id, record.name]));
  const table = el("div", {
    class: "db-list db-actor-studio-table",
    attrs: { role: "table", "aria-label": "주인공 데이터 표" },
    children: [
      el("div", {
        class: "db-actor-table-row db-actor-table-header",
        attrs: { role: "row" },
        dataset: { testid: "db-actor-table-header" },
        children: [
          tableCell("캐릭터", "columnheader"),
          tableCell("직업", "columnheader"),
          tableCell("레벨", "columnheader"),
          tableCell("HP", "columnheader"),
          tableCell("맵 표시", "columnheader"),
        ],
      }),
    ],
  });

  for (const actor of options.filteredActors) {
    const row = actorRow(actor, classNames.get(actor.classId) ?? "미지정", actor.id === options.selectedId, options.project);
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
                el("h3", { text: "플레이어 캐릭터" }),
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

function actorRow(actor: ActorRecord, className: string, selected: boolean, project: Project): HTMLElement {
  const initialHp = parameterValueAtLevel(actor.parameterCurves.maxHp, actor.initialLevel);
  const thumbnail = recordListThumbnail("actors", actor, project, 36);
  return el("button", {
    class: `db-list-row db-actor-table-row${selected ? " active" : ""}`,
    attrs: { role: "row", type: "button" },
    dataset: { recordId: actor.id, testid: `db-record-row-${actor.id}` },
    children: [
      el("span", {
        class: "db-actor-identity-cell",
        attrs: { role: "cell" },
        children: [
          thumbnail ?? el("span", { class: "db-actor-avatar-fallback", text: actor.name.slice(0, 1) || "?" }),
          el("span", {
            class: "db-actor-name-stack",
            children: [
              el("strong", { class: "db-list-name", text: actor.name }),
              el("small", { text: actorSubLabel(actor) }),
            ],
          }),
        ],
      }),
      tableCell(className, "cell"),
      tableCell(String(actor.initialLevel), "cell", "numeric"),
      tableCell(NUMBER_FORMAT.format(initialHp), "cell", "numeric"),
      // 맵 표시: 기본값(보임)까지 초록 알약으로 그리면 모든 행에 같은 뱃지가 도배돼
      // 정작 예외인 "투명"이 눈에 안 띈다 — 예외일 때만 뱃지를 세운다.
      el("span", {
        class: `db-actor-status${actor.characterTransparent ? " is-hidden" : " is-default"}`,
        attrs: { role: "cell" },
        text: actor.characterTransparent ? "투명" : "보임",
      }),
    ],
  });
}

function tableCell(text: string, role: "cell" | "columnheader", className = ""): HTMLElement {
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
