// 주민 관계 탭 — 2026-08 DB 모던 워크스페이스 이식.
//
// 감사에서 잡힌 P0/P1:
//  1) 목록 창 카운트를 `db-list-footer` 로 넣어 모던 그리드의 ROW 2(=검색 슬롯)에 auto-place
//     시켰다. 카운트가 목록 위에 뜨고 검색은 아예 없었다(listWithoutSearch).
//     listPane() 이 카운트를 제목 배지로, 검색을 전용 행으로 빌더 차원에서 고정한다.
//  2) `.db-character-orphan-create` 가 `display:grid` 기본 stretch 라서 '프로필 만들기'
//     primary 버튼이 상세 창 전폭(~980px) 바가 됐다(fullBleed:1).
//     이제 그 자리는 sectionCard 이고, 버튼은 `.db-ws-card-body > .db-ws-btn`
//     (justify-self:start) 규칙을 그대로 받는다 — 레거시 grid 컨테이너 자체를 안 쓴다.
//  3) 상세 창이 세로 폼 덤프라 1300px 폭에서 오른쪽 절반이 통째로 비었다(detailDead 57%).
//     카드 스택(auto-fit minmax(400px,1fr))으로 바꾼다.
//
// 계약상 살려야 하는 훅: `db-characters-list`(목록 컨테이너), `db-detail-form`(상세 본문),
// `db-character-status` / `db-character-id`(히어로), `.empty-hint` 정확 문구 두 개.

import { eventDisplayName } from "@/editor/eventMarkerUx";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { selectEditorMap } from "@/editor/mapSelection";
import {
  emptyToUndefined,
  matchesNameOrId,
  numberField,
  selectField,
  textControl,
} from "@/editor/panels/databaseControls";
import { clickDatabaseTabFrom, renderLifePanel } from "@/editor/panels/databaseLifeUi";
import {
  detailHero,
  emptyState,
  listPane,
  listRow,
  listSearch,
  listToolbar,
  detailPane as makeDetailPane,
  sectionCard,
  workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { SEASON_OPTIONS } from "@/editor/panels/eventEditor/conditionForm";
import { characterListThumbnail } from "@/editor/panels/characterListThumbnail";
import {
  characterIdExists,
  listCharacterIdIndex,
  type CharacterIdIndexEntry,
  type CharacterIdUsageHost,
} from "@/project/characterIdIndex";
import { SEASONS, type Season } from "@/project/gameTime";
import { store } from "@/project/store";
import type { CharacterProfile, GiftPrefs, GiftResponses, ItemId, Project } from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

const DELETE_CONFIRM_LABEL = "정말 삭제?";
const DELETE_IDLE_LABEL = "프로필 삭제";
const DELETE_CONFIRM_WINDOW_MS = 3000;

// qa-characters.spec.ts 가 이 두 문구를 정확히 비교한다 — 바꾸면 계약이 깨진다.
const ORPHAN_HINT = "이벤트에서 쓰이는 characterId이지만 프로필이 없습니다. 표시 이름을 넣고 프로필을 만들 수 있습니다.";
const USAGE_EMPTY_HINT = "이 characterId를 쓰는 맵 이벤트가 없습니다.";

let selectedCharacterId: string | undefined;
let characterSearch = "";
let restoreCharacterSearchFocus = false;

export function renderCharactersTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const entries = listCharacterIdIndex(project);
  if (!selectedCharacterId || !entries.some((entry) => entry.characterId === selectedCharacterId)) {
    selectedCharacterId = entries[0]?.characterId;
  }
  const selected = entries.find((entry) => entry.characterId === selectedCharacterId);

  const rows: HTMLElement[] = [];
  for (const [index, entry] of entries.entries()) {
    const label = entry.profile?.displayName?.trim() || `주민 ${index + 1}`;
    if (characterSearch && !matchesNameOrId(label, entry.characterId, characterSearch)) continue;
    const badges: string[] = [];
    if (entry.isOrphan) badges.push("연결만 있음");
    if (entry.isUnusedProfile) badges.push("미등장");
    if (entry.usageCount > 0) badges.push(`이벤트 ${entry.usageCount}`);
    rows.push(listRow({
      name: label,
      sub: badges.length > 0 ? badges.join(" · ") : undefined,
      thumb: characterListThumbnail(project, entry),
      active: entry.characterId === selectedCharacterId,
      title: `${label} #${index + 1} — ${entry.characterId}`,
      testid: `db-character-row-${entry.characterId}`,
      dataset: { recordId: entry.characterId, recordName: label, recordIndex: String(index + 1) },
      onSelect: () => {
        selectedCharacterId = entry.characterId;
        rerender();
      },
    }));
  }

  const list = listPane({
    title: "주민 관계",
    count: entries.length,
    search: listSearch({
      placeholder: "주민 검색",
      value: characterSearch,
      testid: "db-character-search",
      onInput: (value) => {
        characterSearch = value;
        restoreCharacterSearchFocus = true;
        rerender();
      },
    }),
    rows,
    empty: characterSearch.length > 0
      ? emptyState({ icon: "⌕", title: "검색 결과가 없습니다", body: `"${characterSearch}" 와 일치하는 주민이 없습니다.`, compact: true })
      : emptyState({ icon: "♡", title: "아직 주민이 없습니다", compact: true }),
    toolbar: characterToolbar(entries, rerender),
    testid: "db-character-list-pane",
  });
  // 목록 컨테이너 훅 계약 — qa-characters.spec.ts 가 `[data-testid=db-characters-list] .db-list-row`
  // 로 행 수를 센다.
  list.querySelector(".db-ws-list")?.setAttribute("data-testid", "db-characters-list");

  const detail = selected
    ? characterDetail(selected, project, rerender)
    : characterOnboarding(rerender);
  detail.querySelector(".db-ws-detail-body")?.setAttribute("data-testid", "db-detail-form");

  host.append(workspaceShell({
    header: characterLifeHeader(project, entries, rerender),
    list,
    detail,
    testid: "db-characters-workspace",
  }));

  if (restoreCharacterSearchFocus) {
    restoreCharacterSearchFocus = false;
    const input = host.querySelector<HTMLInputElement>("[data-testid='db-character-search']");
    if (input) {
      input.focus();
      const end = input.value.length;
      input.setSelectionRange?.(end, end);
    }
  }
}

// ---------------------------------------------------------------------------
// 헤더 — 관계 준비 상태 (기존 그대로, workspaceShell 헤더 자리로 이동)
// ---------------------------------------------------------------------------

function characterLifeHeader(project: Project, entries: readonly CharacterIdIndexEntry[], rerender: () => void): HTMLElement {
  const giftReady = project.system.giftSystem === true;
  const calendarReady = project.system.timeSystem?.enabled === true;
  const profileCount = entries.filter((entry) => entry.hasProfile).length;
  const linkedCount = entries.filter((entry) => entry.usageCount > 0).length;
  const orphans = entries.filter((entry) => !entry.hasProfile && entry.usageCount > 0);
  const unused = entries.filter((entry) => entry.hasProfile && entry.usageCount === 0);
  const issueCount = orphans.length + unused.length;
  const openSystem = (event: Event): void => {
    if (!clickDatabaseTabFrom(event.currentTarget as HTMLElement | null, "db-tab-system")) {
      toast("데이터베이스의 시스템 탭을 열어 주세요.", "info");
    }
  };

  return el("div", {
    class: "db-life-header",
    children: [
      renderLifePanel({
        testid: "db-character-readiness",
        title: "주민 관계",
        headingTestid: "db-characters-intro",
        cards: [
          {
            testid: "db-character-readiness-gifts",
            icon: "gift",
            label: "선물",
            value: giftReady ? "사용 중" : "설정 필요",
            detail: giftReady ? "선물 취향과 반응이 플레이에 적용됩니다." : "시스템에서 선물 기능을 켜세요.",
            state: giftReady ? "ready" : "needs-setup",
            action: {
              label: "시스템 열기",
              testid: "db-character-readiness-gifts-action",
              onClick: openSystem,
            },
          },
          {
            testid: "db-character-readiness-calendar",
            icon: "calendar",
            label: "생일",
            value: calendarReady ? "사용 중" : "설정 필요",
            detail: calendarReady ? "계절과 날짜로 생일을 판정합니다." : "생일을 쓰려면 시간 기능을 켜세요.",
            state: calendarReady ? "ready" : "needs-setup",
            action: {
              label: "시간 설정 열기",
              testid: "db-character-readiness-calendar-action",
              onClick: openSystem,
            },
          },
          {
            testid: "db-character-readiness-profiles",
            icon: "people",
            label: "프로필",
            value: `${profileCount}명`,
            detail: `${linkedCount}명이 맵 이벤트에 연결됨`,
            state: profileCount > 0 ? "ready" : "needs-setup",
            data: { profiles: String(profileCount), linked: String(linkedCount) },
          },
          {
            testid: "db-character-readiness-issues",
            icon: "warning",
            label: "연결",
            value: issueCount > 0 ? `${issueCount}건` : "문제 없음",
            detail: issueCount > 0 ? `프로필 없음 ${orphans.length} · 미등장 ${unused.length}` : "모든 주민 프로필이 맵 이벤트에 연결되었습니다.",
            state: issueCount > 0 ? "needs-setup" : "ready",
            data: { orphans: String(orphans.length), unused: String(unused.length) },
            action: {
              label: issueCount > 0 ? "첫 경고 열기" : "주민 확인",
              testid: "db-character-readiness-issues-action",
              onClick: () => {
                selectedCharacterId = (orphans[0] ?? unused[0] ?? entries[0])?.characterId;
                rerender();
              },
            },
          },
        ],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// 목록 창 툴바 / 빈 상태
// ---------------------------------------------------------------------------

function characterToolbar(entries: readonly CharacterIdIndexEntry[], rerender: () => void): HTMLElement {
  const bar = listToolbar([
    {
      label: "+ 프로필 추가",
      kind: "primary",
      testid: "db-character-add",
      onClick: () => addProfile(rerender),
    },
  ]);
  bar.append(deleteProfileButton(entries, rerender));
  return bar;
}

function characterOnboarding(rerender: () => void): HTMLElement {
  return makeDetailPane({
    body: emptyState({
      icon: "♡",
      title: "아직 등록된 주민이 없습니다",
      body: "주민 프로필을 만든 뒤 맵 이벤트에서 연결하면 등장 장소가 달라도 같은 호감도와 선물 기록을 공유합니다.",
      testid: "db-character-empty",
      action: {
        label: "첫 주민 만들기",
        kind: "primary",
        testid: "db-character-empty-add",
        onClick: () => addProfile(rerender),
      },
    }),
    testid: "db-character-detail-pane",
  });
}

function addProfile(rerender: () => void): void {
  const id = allocateUniqueCharacterId(store.getCurrent());
  recordProjectSnapshot("주민 관계 프로필 추가");
  store.update((project) => {
    const next = { ...(project.characters ?? {}) };
    next[id] = { displayName: "새 주민" };
    project.characters = next;
  }, { scope: "project" });
  selectedCharacterId = id;
  toast("주민 관계 프로필을 추가했습니다.", "ok");
  rerender();
}

function deleteProfileButton(entries: readonly CharacterIdIndexEntry[], rerender: () => void): HTMLElement {
  let armedId: string | null = null;
  let armedUntil = 0;
  let resetTimer: number | null = null;

  const button = el("button", {
    class: "db-ws-btn db-ws-btn-danger",
    text: DELETE_IDLE_LABEL,
    attrs: { type: "button" },
    dataset: { testid: "db-character-delete" },
    on: {
      click: () => {
        const id = selectedCharacterId;
        if (!id) return;
        const entry = entries.find((item) => item.characterId === id);
        if (!entry?.hasProfile) {
          toast("삭제할 프로필이 없습니다. (이벤트 참조만 있는 고아 ID)", "error");
          return;
        }

        const now = Date.now();
        const isArmed = armedId === id && now <= armedUntil;
        if (!isArmed) {
          armedId = id;
          armedUntil = now + DELETE_CONFIRM_WINDOW_MS;
          button.textContent = DELETE_CONFIRM_LABEL;
          button.classList.add("confirming");
          if (resetTimer !== null) window.clearTimeout(resetTimer);
          resetTimer = window.setTimeout(() => {
            resetTimer = null;
            if (Date.now() >= armedUntil) {
              armedId = null;
              button.textContent = DELETE_IDLE_LABEL;
              button.classList.remove("confirming");
            }
          }, DELETE_CONFIRM_WINDOW_MS + 100);
          return;
        }

        armedId = null;
        armedUntil = 0;
        button.textContent = DELETE_IDLE_LABEL;
        button.classList.remove("confirming");
        recordProjectSnapshot("캐릭터 프로필 삭제");
        store.update((project) => {
          if (!project.characters?.[id]) return;
          const next = { ...project.characters };
          delete next[id];
          if (Object.keys(next).length === 0) delete project.characters;
          else project.characters = next;
        }, { scope: "project" });
        // Keep selection on the same characterId so orphan usage rows remain visible.
        toast(
          entry.usageCount > 0
            ? "프로필만 삭제했습니다. 이벤트 characterId 참조는 유지됩니다."
            : "프로필을 삭제했습니다 — Ctrl+Z로 되돌릴 수 있습니다.",
          "ok",
        );
        rerender();
      },
    },
  });
  return button;
}

// ---------------------------------------------------------------------------
// 상세 창
// ---------------------------------------------------------------------------

function characterDetail(entry: CharacterIdIndexEntry, project: Project, rerender: () => void): HTMLElement {
  const displayName = entry.profile?.displayName?.trim() || "이름 없는 주민";
  const hero = detailHero({
    eyebrow: "RESIDENT",
    title: displayName,
    subtitle: entry.hasProfile
      ? "이 프로필의 호감도·선물 기록은 등장 맵과 무관하게 공유됩니다."
      : "맵 이벤트가 이 characterId를 쓰고 있지만 프로필이 없습니다.",
    media: heroThumbnail(project, entry),
    testid: "db-character-hero",
  });
  // 상태 배지 + 원본 id 는 히어로 텍스트 줄에 붙인다(계약 훅 두 개를 그대로 유지).
  hero.querySelector(".db-ws-hero-text")?.append(el("div", {
    class: "db-cx-status",
    dataset: { testid: "db-character-status" },
    children: [
      el("span", {
        class: `db-cx-status-chip${entry.hasProfile ? " is-ready" : " is-warn"}`,
        text: entry.hasProfile ? "프로필 있음" : "이벤트 연결만 있음",
      }),
      el("span", { class: "db-cx-status-chip", text: `이벤트 ${entry.usageCount} · 맵 ${entry.mapCount}` }),
      el("code", {
        class: "db-cx-status-id",
        text: entry.characterId,
        dataset: { testid: "db-character-id" },
        attrs: { title: entry.characterId },
      }),
    ],
  }));

  const body = el("div", {
    class: "db-ws-stack",
    children: entry.hasProfile
      ? [
        spanning(characterOverview(entry)),
        profileCards(entry.characterId, entry.profile ?? {}, project, rerender),
        spanning(usageCard(entry, project)),
      ]
      : [
        // 고아 ID 도 "몇 개 이벤트·몇 개 맵에서 쓰이는지"가 곧 복구 판단 근거다 —
        // 프로필이 없다고 요약을 숨기면 상세 창이 카드 두 장짜리 빈 판이 된다.
        spanning(characterOverview(entry)),
        orphanCreateCard(entry, rerender),
        usageCard(entry, project),
      ],
  });

  return makeDetailPane({ hero, body, testid: "db-character-detail-pane" });
}

/**
 * 히어로용 캐릭셋 썸네일. workspace-modern.css 의 `.db-ws-hero-media img { width/height: 56px }`
 * 가 `.db-list-thumb-probe`(1x1 로드 감지용 투명 img)까지 잡아 늘려서 32px 슬롯을 17px 넘치게
 * 만든다(clipped 위반). 프로브는 보이지 않는 계측용이므로 인라인으로 크기를 되돌린다.
 */
function heroThumbnail(project: Project, entry: CharacterIdIndexEntry): HTMLElement {
  const thumb = characterListThumbnail(project, entry);
  for (const probe of thumb.querySelectorAll<HTMLElement>(".db-list-thumb-probe")) {
    probe.style.width = "1px";
    probe.style.height = "1px";
  }
  return thumb;
}

function characterOverview(entry: CharacterIdIndexEntry): HTMLElement {
  const profile = entry.profile ?? {};
  const giftCount = (profile.giftPrefs?.loved?.length ?? 0)
    + (profile.giftPrefs?.liked?.length ?? 0)
    + (profile.giftPrefs?.disliked?.length ?? 0);
  const responseCount = Object.values(profile.giftResponses ?? {}).filter((value) => Boolean(value?.trim())).length;

  return renderLifePanel({
    testid: "db-character-overview",
    title: profile.displayName?.trim() || entry.characterId,
    compact: true,
    cards: [
      {
        testid: "db-character-overview-links",
        icon: "map",
        label: "등장 연결",
        value: `${entry.usageCount}개 이벤트`,
        detail: `${entry.mapCount}개 맵에서 사용`,
        data: { events: String(entry.usageCount), maps: String(entry.mapCount) },
      },
      {
        testid: "db-character-overview-gifts",
        icon: "gift",
        label: "선물 취향",
        value: `${giftCount}개 아이템`,
        detail: "좋아함·괜찮음·싫어함 합계",
        data: { count: String(giftCount) },
      },
      {
        testid: "db-character-overview-birthday",
        icon: "calendar",
        label: "생일",
        value: profile.birthday ? `${profile.birthday.season} ${profile.birthday.day}일` : "미설정",
        detail: profile.birthday ? "생일 선물 보너스에 사용" : "원하면 계절과 날짜를 지정하세요.",
        data: { enabled: String(profile.birthday !== undefined) },
      },
      {
        testid: "db-character-overview-responses",
        icon: "item",
        label: "선물 반응",
        value: `${responseCount}개 문구`,
        detail: "선호도별 기본 대사",
        data: { count: String(responseCount) },
      },
    ],
  });
}

/**
 * 고아 characterId 복구 카드. 예전에는 `display:grid` 컨테이너였고 자식 stretch 로 primary
 * 버튼이 전폭 바가 됐다(fullBleed P1). 이제 sectionCard 안에서 `.db-ws-card-body > .db-ws-btn`
 * 규칙(justify-self:start)을 그대로 받으므로 버튼이 내용 폭만 쓴다.
 */
function orphanCreateCard(entry: CharacterIdIndexEntry, rerender: () => void): HTMLElement {
  let displayName = "";
  const nameInput = el("input", {
    attrs: { type: "text", placeholder: "표시 이름 (선택)" },
    dataset: { testid: "db-character-orphan-display-name" },
  }) as HTMLInputElement;
  nameInput.addEventListener("input", () => {
    displayName = nameInput.value;
  });

  const createButton = el("button", {
    class: "db-ws-btn db-ws-btn-primary",
    text: "프로필 만들기",
    attrs: { type: "button" },
    dataset: { testid: "db-character-create-profile" },
    on: {
      click: () => {
        const name = displayName.trim();
        if (!name) {
          toast("표시 이름은 필수입니다.", "error");
          return;
        }
        recordProjectSnapshot("캐릭터 프로필 생성");
        store.update((project) => {
          const next = { ...(project.characters ?? {}) };
          next[entry.characterId] = { displayName: name };
          project.characters = next;
        }, { scope: "project" });
        toast("프로필을 만들었습니다.", "ok");
        rerender();
      },
    },
  });

  return sectionCard({
    title: "프로필 만들기",
    hint: "이벤트 참조는 그대로 유지됩니다.",
    testid: "db-character-orphan-create",
    children: [
      el("p", { class: "empty-hint", text: ORPHAN_HINT }),
      el("label", { class: "db-field", children: [el("span", { text: "표시 이름" }), nameInput] }),
      createButton,
    ],
  });
}

function profileCards(
  characterId: string,
  profile: CharacterProfile,
  project: Project,
  rerender: () => void,
): HTMLElement {
  return el("div", {
    class: "db-ws-span db-ws-stack",
    dataset: { testid: "db-character-profile-fields" },
    children: [
      sectionCard({
        title: "기본",
        hint: "이벤트 메시지의 이름 표시에 쓰입니다.",
        testid: "db-character-basics-card",
        children: [
          textControl(
            "표시 이름",
            profile.displayName ?? "",
            (value) => {
              const next = emptyToUndefined(value);
              patchProfile(characterId, { displayName: next }, { clearDisplayName: !next });
            },
            "db-character-display-name",
          ),
        ],
      }),
      birthdayCard(characterId, profile, rerender),
      spanning(giftPrefsCard(characterId, profile.giftPrefs, project, rerender)),
      spanning(giftResponsesCard(characterId, profile.giftResponses)),
    ],
  });
}

function birthdayCard(characterId: string, profile: CharacterProfile, rerender: () => void): HTMLElement {
  const enabled = profile.birthday !== undefined;
  const season = profile.birthday?.season ?? "spring";
  const day = profile.birthday?.day ?? 1;

  const enable = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "db-character-birthday-enabled" },
  }) as HTMLInputElement;
  enable.checked = enabled;
  enable.addEventListener("change", () => {
    if (enable.checked) patchProfile(characterId, { birthday: { season, day } });
    else patchProfile(characterId, {}, { clearBirthday: true });
    rerender();
  });

  const seasonSelect = selectField(
    "생일 계절",
    "db-character-birthday-season",
    season,
    SEASON_OPTIONS.map((option) => ({ id: option.value, name: option.label })),
    (value) => {
      if (!SEASONS.includes(value as Season)) return;
      patchProfile(characterId, {
        birthday: {
          season: value as Season,
          day: store.getCurrent().characters?.[characterId]?.birthday?.day ?? day,
        },
      });
    },
  );
  const dayField = numberField(
    "생일 일",
    "db-character-birthday-day",
    day,
    (value) => {
      const nextDay = Math.min(99, Math.max(1, Math.trunc(value) || 1));
      patchProfile(characterId, {
        birthday: {
          season: store.getCurrent().characters?.[characterId]?.birthday?.season ?? season,
          day: nextDay,
        },
      });
    },
    { min: 1, max: 99 },
  );

  if (!enabled) {
    seasonSelect.querySelector("select")?.setAttribute("disabled", "true");
    dayField.querySelector("input")?.setAttribute("disabled", "true");
  }

  return sectionCard({
    title: "생일",
    hint: enabled ? "생일 선물 보너스에 사용됩니다." : "시간 기능이 켜져 있어야 판정됩니다.",
    testid: "db-character-birthday",
    children: [
      el("label", {
        class: "db-checkbox-field",
        children: [enable, el("span", { text: "생일 사용" })],
      }),
      el("div", { class: "db-cx-inline-fields", children: [seasonSelect, dayField] }),
    ],
  });
}

function giftPrefsCard(
  characterId: string,
  prefs: GiftPrefs | undefined,
  project: Project,
  rerender: () => void,
): HTMLElement {
  const items = project.database.items.map((item) => ({ id: item.id, name: item.name || item.id }));
  const ranks: readonly { readonly key: keyof GiftPrefs; readonly label: string; readonly testid: string }[] = [
    { key: "loved", label: "좋아하는 선물 (loved)", testid: "db-character-gift-loved" },
    { key: "liked", label: "괜찮은 선물 (liked)", testid: "db-character-gift-liked" },
    { key: "disliked", label: "싫어하는 선물 (disliked)", testid: "db-character-gift-disliked" },
  ];

  const columns = ranks.map((rank) => {
    const selected = [...(prefs?.[rank.key] ?? [])];
    const list = el("div", {
      class: "db-cx-gift-list",
      dataset: { testid: `${rank.testid}-list` },
    });
    if (selected.length === 0) {
      list.append(el("div", { class: "empty-hint", text: "(없음)" }));
    } else {
      for (const itemId of selected) {
        const itemName = items.find((item) => item.id === itemId)?.name ?? itemId;
        list.append(el("div", {
          class: "db-cx-gift-row",
          dataset: { testid: `${rank.testid}-row-${itemId}` },
          children: [
            el("span", { text: itemName }),
            el("button", {
              class: "db-ws-btn db-ws-btn-ghost db-cx-gift-remove",
              text: "제거",
              attrs: { type: "button", "aria-label": `${itemName} 제거` },
              dataset: { testid: `${rank.testid}-remove-${itemId}` },
              on: {
                click: () => {
                  patchGiftPrefs(characterId, rank.key, (ids) => ids.filter((id) => id !== itemId));
                  rerender();
                },
              },
            }),
          ],
        }));
      }
    }

    const available = items.filter((item) => !selected.includes(item.id));
    const picker = el("select", {
      dataset: { testid: `${rank.testid}-picker` },
    }) as HTMLSelectElement;
    picker.append(el("option", { text: "(아이템 추가)", attrs: { value: "" } }));
    for (const item of available) {
      picker.append(el("option", { text: item.name, attrs: { value: item.id } }));
    }
    const addButton = el("button", {
      class: "db-ws-btn db-ws-btn-ghost",
      text: "추가",
      attrs: available.length === 0 ? { type: "button", disabled: "true" } : { type: "button" },
      dataset: { testid: `${rank.testid}-add` },
      on: {
        click: () => {
          const itemId = picker.value as ItemId;
          if (!itemId) return;
          patchGiftPrefs(characterId, rank.key, (ids) => {
            const current = new Set(ids);
            current.add(itemId);
            return [...current];
          });
          rerender();
        },
      },
    });

    return el("div", {
      class: "db-cx-gift-rank",
      dataset: { testid: rank.testid },
      children: [
        el("strong", { class: "db-cx-gift-rank-title", text: rank.label }),
        list,
        el("div", { class: "db-cx-gift-add-row", children: [picker, addButton] }),
      ],
    });
  });

  return sectionCard({
    title: "선물 선호 (프로필 기본값)",
    hint: "맵 이벤트에서 개별로 덮어쓸 수 있습니다.",
    testid: "db-character-gift-prefs",
    children: [el("div", { class: "db-cx-gift-grid", children: columns })],
  });
}

function giftResponsesCard(characterId: string, responses: GiftResponses | undefined): HTMLElement {
  const keys: readonly { readonly key: keyof GiftResponses; readonly label: string; readonly testid: string }[] = [
    { key: "loved", label: "loved 반응", testid: "db-character-response-loved" },
    { key: "liked", label: "liked 반응", testid: "db-character-response-liked" },
    { key: "neutral", label: "neutral 반응", testid: "db-character-response-neutral" },
    { key: "disliked", label: "disliked 반응", testid: "db-character-response-disliked" },
    { key: "alreadyGifted", label: "이미 선물함", testid: "db-character-response-already-gifted" },
    { key: "noItems", label: "아이템 없음", testid: "db-character-response-no-items" },
  ];

  return sectionCard({
    title: "선물 반응 문구 (프로필 기본값)",
    hint: "비우면 시스템 기본 대사가 나옵니다.",
    testid: "db-character-gift-responses",
    children: [
      el("div", {
        class: "db-cx-response-grid",
        children: keys.map((entry) => textControl(
          entry.label,
          responses?.[entry.key] ?? "",
          (value) => patchGiftResponse(characterId, entry.key, emptyToUndefined(value)),
          entry.testid,
        )),
      }),
    ],
  });
}

function usageCard(entry: CharacterIdIndexEntry, project: Project): HTMLElement {
  if (entry.hosts.length === 0) {
    return sectionCard({
      title: "사용 중인 이벤트",
      testid: "db-character-usage",
      children: [
        el("p", {
          class: "empty-hint",
          text: USAGE_EMPTY_HINT,
          dataset: { testid: "db-character-usage-empty" },
        }),
      ],
    });
  }

  return sectionCard({
    title: "사용 중인 이벤트",
    hint: `${entry.hosts.length}곳에서 이 characterId를 씁니다.`,
    testid: "db-character-usage",
    children: [
      el("div", {
        class: "db-cx-usage-list",
        children: entry.hosts.map((host) => usageRow(host, project)),
      }),
    ],
  });
}

function usageRow(host: CharacterIdUsageHost, project: Project): HTMLElement {
  const mapName = project.maps[host.mapId]?.name || host.mapId;
  const event = project.maps[host.mapId]?.events.find((entry) => entry.id === host.eventId);
  const eventLabel = event ? eventDisplayName(event) : host.eventId;
  return el("div", {
    class: "db-cx-usage-row",
    dataset: { testid: `db-character-usage-${host.mapId}-${host.eventId}` },
    children: [
      el("span", { class: "db-cx-usage-name", text: `${mapName} / ${eventLabel} (${host.x},${host.y})` }),
      el("button", {
        class: "db-ws-btn db-ws-btn-ghost",
        text: "이벤트로 이동",
        attrs: { type: "button" },
        dataset: { testid: `db-character-jump-${host.mapId}-${host.eventId}` },
        on: { click: () => jumpToHost(host) },
      }),
    ],
  });
}

function jumpToHost(host: CharacterIdUsageHost): void {
  const project = store.getCurrent();
  const map = project.maps[host.mapId];
  const event = map?.events.find((entry) => entry.id === host.eventId);
  if (!map || !event) {
    toast("연결된 이벤트를 찾을 수 없습니다.", "error");
    return;
  }
  if (!selectEditorMap(host.mapId, { clearEventSelection: false })) {
    toast("연결된 맵을 찾을 수 없습니다.", "error");
    return;
  }
  openEventEditorModal(host.mapId, host.eventId);
}

// ---------------------------------------------------------------------------
// 저장 (변경 없음 — 에디터 UI 개편이므로 mutation 경로는 그대로 둔다)
// ---------------------------------------------------------------------------

function patchProfile(
  characterId: string,
  patch: Partial<CharacterProfile>,
  options: { readonly clearDisplayName?: boolean; readonly clearBirthday?: boolean; readonly clearGiftPrefs?: boolean; readonly clearGiftResponses?: boolean } = {},
): void {
  recordCoalescedSnapshot(`db-character:${characterId}`);
  store.update((project) => {
    const existing = project.characters?.[characterId] ?? {};
    const nextProfile: CharacterProfile = {
      ...existing,
      ...patch,
    };
    // Rebuild without cleared optional keys (readonly fields cannot be deleted in place).
    const rebuilt: {
      displayName?: string;
      birthday?: CharacterProfile["birthday"];
      giftPrefs?: GiftPrefs;
      giftResponses?: GiftResponses;
    } = {};
    const displayName = options.clearDisplayName ? undefined : nextProfile.displayName;
    const birthday = options.clearBirthday ? undefined : nextProfile.birthday;
    const giftPrefs = options.clearGiftPrefs ? undefined : nextProfile.giftPrefs;
    const giftResponses = options.clearGiftResponses ? undefined : nextProfile.giftResponses;
    if (displayName !== undefined) rebuilt.displayName = displayName;
    if (birthday !== undefined) rebuilt.birthday = birthday;
    if (giftPrefs !== undefined) rebuilt.giftPrefs = giftPrefs;
    if (giftResponses !== undefined) rebuilt.giftResponses = giftResponses;
    const next = { ...(project.characters ?? {}) };
    // Empty profile object is still a valid registered profile (orphan → profile).
    next[characterId] = rebuilt;
    project.characters = next;
  }, { scope: "project" });
}

function patchGiftPrefs(
  characterId: string,
  rank: keyof GiftPrefs,
  transform: (ids: readonly ItemId[]) => readonly ItemId[],
): void {
  const existing = store.getCurrent().characters?.[characterId]?.giftPrefs;
  const nextIds = transform(existing?.[rank] ?? []);
  const next: {
    loved?: readonly ItemId[];
    liked?: readonly ItemId[];
    disliked?: readonly ItemId[];
  } = {
    ...(existing?.loved ? { loved: [...existing.loved] } : {}),
    ...(existing?.liked ? { liked: [...existing.liked] } : {}),
    ...(existing?.disliked ? { disliked: [...existing.disliked] } : {}),
  };
  if (nextIds.length === 0) {
    if (rank === "loved") delete next.loved;
    else if (rank === "liked") delete next.liked;
    else delete next.disliked;
  } else if (rank === "loved") next.loved = nextIds;
  else if (rank === "liked") next.liked = nextIds;
  else next.disliked = nextIds;

  if (!next.loved && !next.liked && !next.disliked) {
    patchProfile(characterId, {}, { clearGiftPrefs: true });
  } else {
    patchProfile(characterId, { giftPrefs: next });
  }
}

function patchGiftResponse(
  characterId: string,
  key: keyof GiftResponses,
  value: string | undefined,
): void {
  const existing = store.getCurrent().characters?.[characterId]?.giftResponses ?? {};
  const next: {
    loved?: string;
    liked?: string;
    neutral?: string;
    disliked?: string;
    alreadyGifted?: string;
    noItems?: string;
  } = { ...existing };
  if (value === undefined) {
    if (key === "loved") delete next.loved;
    else if (key === "liked") delete next.liked;
    else if (key === "neutral") delete next.neutral;
    else if (key === "disliked") delete next.disliked;
    else if (key === "alreadyGifted") delete next.alreadyGifted;
    else delete next.noItems;
  } else if (key === "loved") next.loved = value;
  else if (key === "liked") next.liked = value;
  else if (key === "neutral") next.neutral = value;
  else if (key === "disliked") next.disliked = value;
  else if (key === "alreadyGifted") next.alreadyGifted = value;
  else next.noItems = value;

  if (Object.keys(next).length === 0) {
    patchProfile(characterId, {}, { clearGiftResponses: true });
  } else {
    patchProfile(characterId, { giftResponses: next });
  }
}

function allocateUniqueCharacterId(project: Project): string {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const id = genId("char");
    if (!characterIdExists(project, id) && project.characters?.[id] === undefined) return id;
  }
  // Extremely unlikely fallback — still unique enough for editor use.
  return `char_${Date.now().toString(36)}`;
}

/** `db-ws-stack` 안에서 한 줄을 통째로 쓰는 요소. */
function spanning(node: HTMLElement): HTMLElement {
  node.classList.add("db-ws-span");
  return node;
}
