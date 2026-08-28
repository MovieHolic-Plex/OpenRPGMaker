// 농사·작물 탭 — 2026-08 DB 모던 워크스페이스 이식.
//
// 감사에서 잡힌 P0 두 건을 "구조"로 고친다.
//
//  1) 목록 창 카운트를 `db-list-footer` 로 넣고 있었다. 모던 `.oprn-record-list-pane` 그리드에는
//     그 클래스의 행 지정이 없어 카운트가 ROW 2(=검색 슬롯)에 auto-place 됐고, 결과적으로
//     "개수가 목록 위에 뜨는데 검색은 아예 없는" 창이 됐다(detailDead 94% / listWithoutSearch).
//     listPane() 은 카운트를 제목 배지로, 검색을 전용 행으로 **빌더가 고정**하므로 재발이 불가능하다.
//
//  2) 성장 그래픽 — 밭 한 칸에 실제로 그려지는 그림 — 이 `resourceId | frame | label` 파이프
//     텍스트 4줄짜리 raw textarea 하나였다. 썸네일도, 리소스 선택기도, 단계별 미리보기도 없어서
//     저작자가 자기가 무엇을 배선했는지 화면에서 확인할 방법이 없었다(F 축 P0).
//     이제 단계마다 [미리보기 · 리소스 선택 · 프레임 · 라벨] 을 준다. 프레임은 숫자가 아니라
//     시트의 프레임을 전부 깐 썸네일 줄에서 고른다(frameField) — 번들 시트가 아닌 직접 지정
//     리소스만 숫자 입력이 남는다.
//     원문 textarea(`db-crop-graphic-stages`)는 qa-crops.spec.ts 계약이라 "원문 편집" 카드로 남긴다.
//
//  3) (2 차) 빈 상태 상세 창이 [빈 상태 카드 | 타일 갤러리] 2 열이라 왼쪽 열 위아래가 통째로
//     비었고(상세 창 여백 73% — 1 차 이관에서 유일하게 clean 을 못 받은 탭), 타일은 시트의
//     마지막 프레임만 그려 "고르기 전에는 어떻게 자라는지 모른다". 지금은 한 열 —
//     가로 안내 띠 + 모든 성장 프레임을 편 스타터 행 목록.
//
// 준비 상태 스트립(renderLifePanel)은 그대로 두고 workspaceShell 의 `header` 로 올린다.

import { FARMING_CROP_SPRITE_ASSETS } from "@/assets/farmingSprites";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { duplicateInto } from "@/editor/databaseCopy";
import { cropReferenceMessage } from "@/editor/databaseReferences";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { selectEditorMap } from "@/editor/mapSelection";
import { field, matchesNameOrId, numberField, selectField, textControl } from "@/editor/panels/databaseControls";
import { clickDatabaseTabFrom, renderLifePanel } from "@/editor/panels/databaseLifeUi";
import {
  detailHero,
  emptyState,
  listPane,
  listRow,
  listSearch,
  listToolbar,
  detailPane as makeDetailPane,
  noticeBar,
  sectionCard,
  workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import { cropGraphicStages, normalizeCropRecord } from "@/project/farmModel";
import { SEASONS, type Season } from "@/project/gameTime";
import { store } from "@/project/store";
import type { CropGraphicStage, CropRecord, Project } from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

const DELETE_CONFIRM_LABEL = "정말 삭제?";
const DELETE_IDLE_LABEL = "삭제";
const DELETE_CONFIRM_WINDOW_MS = 3000;

const SEASON_LABEL: Readonly<Record<Season, string>> = {
  spring: "봄",
  summer: "여름",
  fall: "가을",
  winter: "겨울",
};

let selectedCropId: string | undefined;
let cropSearch = "";
/** 검색 입력은 재렌더로 노드가 교체된다 — 다시 그린 뒤 캐럿을 되돌려 준다. */
let restoreCropSearchFocus = false;

export function renderCropTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const crops = project.database.crops ?? [];
  if (!selectedCropId || !crops.some((record) => record.id === selectedCropId)) selectedCropId = crops[0]?.id;
  const selected = crops.find((record) => record.id === selectedCropId);

  const rows: HTMLElement[] = [];
  for (const [index, record] of crops.entries()) {
    if (cropSearch && !matchesNameOrId(record.name, record.id, cropSearch)) continue;
    rows.push(listRow({
      name: record.name || "(이름 없음)",
      sub: record.seasons.map((season) => SEASON_LABEL[season] ?? season).join("·"),
      number: index + 1,
      thumb: stageThumb(cropGraphicStages(record)[0], 24),
      active: record.id === selectedCropId,
      title: `${record.name || "(이름 없음)"} #${index + 1} — ${record.id}`,
      testid: `db-crop-row-${record.id}`,
      dataset: { recordId: record.id, recordName: record.name, recordIndex: String(index + 1) },
      onSelect: () => {
        selectedCropId = record.id;
        rerender();
      },
    }));
  }

  const list = listPane({
    title: "농사·작물",
    count: crops.length,
    search: listSearch({
      placeholder: "작물 검색",
      value: cropSearch,
      testid: "db-crop-search",
      onInput: (value) => {
        cropSearch = value;
        restoreCropSearchFocus = true;
        rerender();
      },
    }),
    rows,
    empty: cropSearch.length > 0
      ? emptyState({ icon: "⌕", title: "검색 결과가 없습니다", body: `"${cropSearch}" 와 일치하는 작물이 없습니다.`, compact: true })
      : emptyState({ icon: "芽", title: "아직 작물이 없습니다", compact: true }),
    toolbar: cropToolbar(rerender),
    testid: "db-crop-list-pane",
  });

  const detail = selected ? cropDetail(selected, project, rerender) : cropOnboarding(rerender);
  // 기존 `db-detail-form` 계약(여러 e2e 가 상세 창 텍스트/이미지를 이 훅으로 읽는다)을
  // 스크롤 본문 래퍼에 그대로 옮겨 붙인다(용어 탭과 같은 방식).
  detail.querySelector(".db-ws-detail-body")?.setAttribute("data-testid", "db-detail-form");

  host.append(workspaceShell({
    header: cropLifeHeader(project, rerender),
    list,
    detail,
    testid: "db-crops-workspace",
  }));

  if (restoreCropSearchFocus) {
    restoreCropSearchFocus = false;
    const input = host.querySelector<HTMLInputElement>("[data-testid='db-crop-search']");
    if (input) {
      input.focus();
      const end = input.value.length;
      input.setSelectionRange?.(end, end);
    }
  }
}

// ---------------------------------------------------------------------------
// 헤더 — 농사 루프 준비 상태 (기존 그대로, workspaceShell 헤더 자리로 이동)
// ---------------------------------------------------------------------------

function cropLifeHeader(project: Project, rerender: () => void): HTMLElement {
  const timeReady = project.system.timeSystem?.enabled === true;
  const farmableMaps = Object.values(project.maps).filter((map) => (map.farmableArea ?? []).length > 0);
  const farmableMapCount = farmableMaps.length;
  const toolKinds = new Set(project.database.items.map((item) => item.farmTool).filter(Boolean));
  const toolsReady = toolKinds.has("hoe") && toolKinds.has("wateringCan");
  const itemIds = new Set(project.database.items.map((item) => item.id));
  const crops = project.database.crops ?? [];
  const invalidCrops = crops.filter((crop) => !itemIds.has(crop.seedItemId) || !itemIds.has(crop.harvestItemId));
  const openTab = (event: Event, testid: string): void => {
    if (!clickDatabaseTabFrom(event.currentTarget as HTMLElement | null, testid)) {
      toast("데이터베이스 창에서 해당 탭을 열어 주세요.", "info");
    }
  };

  return el("div", {
    class: "db-life-header",
    children: [
      el("p", {
        class: "db-record-intro",
        dataset: { testid: "db-crops-intro" },
        text: "씨앗을 심고, 날짜가 지나면 자라며, 수확물이 아이템으로 들어오는 농사 규칙입니다.",
      }),
      renderLifePanel({
        testid: "db-crop-readiness",
        eyebrow: "플레이 연결",
        title: "농사 루프 준비 상태",
        description: "작물 레코드만으로는 자라지 않습니다. 시간, 경작 영역, 도구가 함께 준비되어야 합니다.",
        cards: [
          {
            testid: "db-crop-readiness-time",
            label: "시간·계절",
            value: timeReady ? "사용 중" : "설정 필요",
            detail: timeReady ? "날짜가 바뀌면 성장합니다." : "시스템에서 시간 기능을 켜세요.",
            state: timeReady ? "ready" : "needs-setup",
            action: {
              label: "시스템 열기",
              testid: "db-crop-readiness-time-action",
              onClick: (event) => openTab(event, "db-tab-system"),
            },
          },
          {
            testid: "db-crop-readiness-fields",
            label: "경작 가능한 맵",
            value: `${farmableMapCount}곳`,
            detail: farmableMapCount > 0 ? "맵의 경작 영역에서 심을 수 있습니다." : "맵 설정에 경작 영역이 필요합니다.",
            state: farmableMapCount > 0 ? "ready" : "needs-setup",
            data: { count: String(farmableMapCount) },
            action: {
              label: farmableMapCount > 0 ? "경작 맵 선택" : "시작 맵 선택",
              testid: "db-crop-readiness-fields-action",
              onClick: () => {
                const mapId = farmableMaps[0]?.id ?? project.startMapId;
                if (selectEditorMap(mapId)) toast(`맵 '${project.maps[mapId]?.name ?? mapId}'을 선택했습니다.`, "ok");
                else toast("이동할 맵을 찾을 수 없습니다.", "error");
              },
            },
          },
          {
            testid: "db-crop-readiness-tools",
            label: "기본 농사 도구",
            value: toolsReady ? "준비됨" : "확인 필요",
            detail: toolsReady ? "괭이와 물뿌리개가 등록되어 있습니다." : "아이템에서 괭이와 물뿌리개를 지정하세요.",
            state: toolsReady ? "ready" : "needs-setup",
            action: {
              label: "아이템 열기",
              testid: "db-crop-readiness-tools-action",
              onClick: (event) => openTab(event, "db-tab-items"),
            },
          },
          {
            testid: "db-crop-readiness-records",
            label: "작물 연결",
            value: invalidCrops.length > 0 ? `${invalidCrops.length}개 오류` : `${crops.length}개 사용 가능`,
            detail: invalidCrops.length > 0 ? "씨앗 또는 수확 아이템 연결을 확인하세요." : "모든 작물의 아이템 연결이 유효합니다.",
            state: invalidCrops.length > 0 || crops.length === 0 ? "needs-setup" : "ready",
            data: { invalid: String(invalidCrops.length), total: String(crops.length) },
            action: {
              label: invalidCrops.length > 0 ? "첫 오류 열기" : "작물 확인",
              testid: "db-crop-readiness-records-action",
              onClick: () => {
                selectedCropId = invalidCrops[0]?.id ?? crops[0]?.id;
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
// 목록 창 툴바
// ---------------------------------------------------------------------------

function cropToolbar(rerender: () => void): HTMLElement {
  const bar = listToolbar([
    {
      label: "+ 추가",
      kind: "primary",
      testid: "db-crop-add",
      onClick: () => addCrop(rerender),
    },
    {
      label: "복제",
      testid: "db-crop-duplicate",
      onClick: () => {
        const id = selectedCropId;
        if (!id) return;
        const copyId = genId("crop");
        recordProjectSnapshot();
        store.update((project) => {
          project.database.crops ??= [];
          duplicateInto(project.database.crops, id, copyId);
        }, { scope: "database", collection: "crops" });
        selectedCropId = copyId;
        rerender();
      },
    },
  ]);
  bar.append(deleteCropButton(rerender));
  return bar;
}

function addCrop(rerender: () => void, seed: Partial<CropRecord> = {}): void {
  const id = genId("crop");
  recordProjectSnapshot();
  store.update((project) => {
    project.database.crops ??= [];
    const firstItemId = project.database.items[0]?.id ?? "item_seed";
    project.database.crops.push(normalizeCropRecord({
      id,
      name: "새 작물",
      seedItemId: firstItemId,
      harvestItemId: firstItemId,
      stages: [{ days: 1 }],
      seasons: ["spring"],
      ...seed,
    }));
  }, { scope: "database", collection: "crops" });
  selectedCropId = id;
  rerender();
}

// 다른 레코드 탭과 동일한 2단계 확인 패턴(작물은 DatabaseCollection 밖이라 공용
// deleteButton을 그대로 재사용할 수 없어 이 뷰에서 같은 계약을 재현한다).
// 참조 가드(cropReferenceMessage)는 항상 null — 농사 플롯은 런타임 세이브 전용 필드라
// 정적 DB에서 검사할 대상이 없다(databaseReferences.ts 주석 참조).
function deleteCropButton(rerender: () => void): HTMLElement {
  let armedId: string | null = null;
  let armedUntil = 0;
  let resetTimer: number | null = null;

  const button = el("button", {
    class: "db-ws-btn db-ws-btn-danger",
    text: DELETE_IDLE_LABEL,
    attrs: { type: "button" },
    dataset: { testid: "db-crop-delete" },
    on: {
      click: () => {
        const id = selectedCropId;
        if (!id) return;

        const blockedMessage = cropReferenceMessage(id);
        if (blockedMessage) {
          toast(blockedMessage, "error");
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
        recordProjectSnapshot();
        store.update((project) => {
          project.database.crops = (project.database.crops ?? []).filter((record) => record.id !== id);
        }, { scope: "database", collection: "crops" });
        selectedCropId = undefined;
        toast("삭제했습니다 — Ctrl+Z로 되돌릴 수 있습니다.", "ok");
        rerender();
      },
    },
  });
  return button;
}

// ---------------------------------------------------------------------------
// 빈 상태 — 번들 작물 스프라이트에서 바로 만들 수 있게 한다
// ---------------------------------------------------------------------------

/**
 * 작물이 하나도 없을 때의 상세 창. 예전에는 빈 상태 카드 하나뿐이라 "무엇을 만들 수 있는지"
 * 알 방법이 없었다. 프로젝트에 이미 들어 있는 작물 성장 스프라이트를 그대로 시작점으로 제시한다
 * — 고른 스프라이트가 곧 그래픽 단계 배선이 되므로 F 축 공백(그림 없는 작물)이 처음부터 사라진다.
 *
 * 2 차 정리(H 축): 예전 배치는 [빈 상태 카드 | 타일 갤러리] 2 열이었다. 왼쪽 열은 420px 짜리
 * 가운데 정렬 카드 하나뿐이라 위아래가 통째로 비었고(상세 창 여백 73%), 타일은 **마지막 프레임
 * 하나만** 그려서 "이 스프라이트가 어떻게 자라는지"를 고르기 전에 알 수 없었다. 지금은 한 열이다
 * — 가로 안내 띠 + 성장 프레임을 전부 펼친 행 목록(첫 단계 → 수확기).
 */
function cropOnboarding(rerender: () => void): HTMLElement {
  return makeDetailPane({
    body: el("div", {
      class: "db-ws-stack db-cx-onboarding",
      children: [
        spanning(emptyState({
          icon: "芽",
          title: "아직 작물이 없습니다",
          body: "아래에서 스프라이트를 고르면 성장 단계와 그림이 함께 배선된 작물이 만들어집니다. 씨앗·수확물·계절은 만든 뒤 오른쪽에서 연결합니다.",
          testid: "db-crop-empty",
          action: {
            label: "빈 작물 만들기",
            kind: "primary",
            testid: "db-crop-empty-add",
            onClick: () => addCrop(rerender),
          },
        })),
        spanning(sectionCard({
          title: "번들 작물 스프라이트로 시작",
          hint: "왼쪽이 심은 직후, 오른쪽 끝 칸이 수확 가능 상태입니다.",
          testid: "db-crop-starter-gallery",
          children: [
            // `db-gallery` 는 "고르는 것들이 늘어선 판" 이라는 뜻이다. 스타터 행은 액션 버튼이
            // 아니라 선택지라 폭을 다 쓰는 게 정상이고, 감사 게이트도 이 클래스로 그 둘을
            // 구분한다(fullBleed 판정에서 `.db-gallery` 하위를 제외).
            el("div", {
              class: "db-cx-starter-list db-gallery",
              children: FARMING_CROP_SPRITE_ASSETS.map((asset) => starterRow(asset, rerender)),
            }),
          ],
        })),
      ],
    }),
    testid: "db-crop-detail-pane",
  });
}

/**
 * 스타터 한 줄. 시트의 **모든 프레임을 순서대로** 펼쳐 성장 모습을 그대로 보여 준다 —
 * 예전 타일은 마지막 프레임만 그려서, 고르고 나서야 중간 단계를 알 수 있었다.
 */
function starterRow(
  asset: (typeof FARMING_CROP_SPRITE_ASSETS)[number],
  rerender: () => void,
): HTMLElement {
  const name = asset.name.replace(/\s*성장 스프라이트$/u, "") || asset.name;
  // 마지막 프레임은 "수확 가능" 칸으로 예약된다(cropGraphicIndexForStage) — 성장 단계는 frameCount-1.
  const growthStages = Math.max(1, asset.frameCount - 1);

  const frames: HTMLElement[] = [];
  for (let frame = 0; frame < asset.frameCount; frame += 1) {
    if (frame > 0) frames.push(el("span", { class: "db-cx-starter-arrow", text: "›", attrs: { "aria-hidden": "true" } }));
    frames.push(stageThumb({ resourceId: asset.id, frame }, 30));
  }

  return el("button", {
    class: "db-cx-starter-row",
    attrs: { type: "button", title: `${name} 작물 만들기` },
    dataset: { testid: `db-crop-starter-${asset.id}` },
    on: {
      click: () => addCrop(rerender, {
        name,
        stages: Array.from({ length: growthStages }, () => ({ days: 2 })),
        graphicStages: Array.from({ length: asset.frameCount }, (_, frame) => ({ resourceId: asset.id, frame })),
      }),
    },
    children: [
      el("span", { class: "db-cx-starter-frames", children: frames }),
      el("span", {
        class: "db-cx-starter-text",
        children: [
          el("span", { class: "db-cx-starter-name", text: name }),
          el("span", {
            class: "db-cx-starter-meta",
            text: `그림 ${asset.frameCount}장 · 성장 ${growthStages}단계 · 단계마다 2일 → 총 ${growthStages * 2}일`,
          }),
        ],
      }),
      el("span", { class: "db-cx-starter-cta", text: "만들기" }),
    ],
  });
}

// ---------------------------------------------------------------------------
// 상세 창
// ---------------------------------------------------------------------------

function cropDetail(record: CropRecord, project: Project, rerender: () => void): HTMLElement {
  const crops = project.database.crops ?? [];
  const index = crops.findIndex((entry) => entry.id === record.id);
  const growthDays = record.stages.reduce((total, stage) => total + stage.days, 0);

  return makeDetailPane({
    hero: detailHero({
      eyebrow: "CROP",
      title: record.name || "이름 없는 작물",
      subtitle: `${itemLabel(project, record.seedItemId)} 을(를) 심으면 ${growthDays}일 뒤 ${itemLabel(project, record.harvestItemId)} ${record.harvestCount}개를 수확합니다.`,
      tags: [
        `#${index + 1}`,
        `${record.stages.length}단계 · ${growthDays}일`,
        record.regrow ? `재수확 ${record.regrow.days}일` : "한 번만",
        ...record.seasons.map((season) => SEASON_LABEL[season] ?? season),
      ],
      media: stageThumb(cropGraphicStages(record).at(-1), 56),
      testid: "db-crop-hero",
    }),
    body: cropInspector(record, project, rerender),
    testid: "db-crop-detail-pane",
  });
}

function cropInspector(record: CropRecord, project: Project, rerender: () => void): HTMLElement {
  const itemIds = new Set(project.database.items.map((item) => item.id));
  const brokenLinks = [
    ...(itemIds.has(record.seedItemId) ? [] : ["씨앗"]),
    ...(itemIds.has(record.harvestItemId) ? [] : ["수확"]),
  ];

  return el("div", {
    class: "db-ws-stack",
    children: [
      ...(brokenLinks.length > 0
        ? [spanning(noticeBar({
          text: `${brokenLinks.join("·")} 아이템 연결이 끊겼습니다. 이 작물은 플레이에서 심거나 수확할 수 없습니다.`,
          tone: "bad",
          testid: "db-crop-broken-link",
        }))]
        : []),
      spanning(cropOverview(record)),
      sectionCard({
        title: "기본",
        hint: `ID ${record.id}`,
        testid: "db-crop-basics-card",
        children: [
          textControl("이름", record.name, (name) => updateCrop(record.id, { name }), "db-crop-name"),
          selectField("씨앗 아이템", "db-crop-seed-item", record.seedItemId, project.database.items, (seedItemId) => {
            updateCrop(record.id, { seedItemId });
            rerender();
          }),
          selectField("수확 아이템", "db-crop-harvest-item", record.harvestItemId, project.database.items, (harvestItemId) => {
            updateCrop(record.id, { harvestItemId });
            rerender();
          }),
          numberField("수확 수량", "db-crop-harvest-count", record.harvestCount, (harvestCount) => updateCrop(record.id, { harvestCount })),
        ],
      }),
      sectionCard({
        title: "성장 일정",
        hint: "한 줄에 한 단계, 그 단계에 머무는 날 수입니다.",
        testid: "db-crop-schedule-card",
        children: [
          stagesField(record, rerender),
          numberField("재수확 대기일(0=없음)", "db-crop-regrow-days", record.regrow?.days ?? 0, (days) => {
            updateCrop(record.id, { regrow: days > 0 ? { days } : undefined });
          }),
        ],
      }),
      sectionCard({
        title: "재배 계절",
        hint: "전부 해제하면 봄으로 되돌립니다(계절 없는 작물은 자라지 않습니다).",
        testid: "db-crop-seasons-card",
        children: [seasonsField(record, rerender)],
      }),
      spanning(graphicStagesCard(record, rerender)),
    ],
  });
}

function cropOverview(record: CropRecord): HTMLElement {
  const growthDays = record.stages.reduce((total, stage) => total + stage.days, 0);
  return renderLifePanel({
    testid: "db-crop-overview",
    eyebrow: "플레이 결과",
    title: record.name || "이름 없는 작물",
    description: "현재 설정으로 플레이어가 경험하는 재배 흐름입니다.",
    compact: true,
    cards: [
      {
        testid: "db-crop-overview-growth",
        label: "첫 수확까지",
        value: `${growthDays}일`,
        detail: `${record.stages.length}단계 성장`,
        data: { days: String(growthDays), stages: String(record.stages.length) },
      },
      {
        testid: "db-crop-overview-yield",
        label: "한 번 수확",
        value: `${record.harvestCount}개`,
        detail: "수확 아이템 지급량",
        data: { count: String(record.harvestCount) },
      },
      {
        testid: "db-crop-overview-seasons",
        label: "재배 계절",
        value: `${record.seasons.length}계절`,
        detail: record.seasons.map((season) => SEASON_LABEL[season] ?? season).join(" · "),
        data: { count: String(record.seasons.length) },
      },
      {
        testid: "db-crop-overview-regrow",
        label: "재수확",
        value: record.regrow ? `${record.regrow.days}일마다` : "한 번만",
        detail: record.regrow ? "수확 후 다시 열립니다." : "수확하면 밭이 비워집니다.",
        data: { days: String(record.regrow?.days ?? 0) },
      },
    ],
  });
}

function stagesField(record: CropRecord, rerender: () => void): HTMLElement {
  const textarea = el("textarea", {
    value: record.stages.map((stage) => String(stage.days)).join("\n"),
    attrs: { rows: "4" },
    dataset: { testid: "db-crop-stages" },
  }) as HTMLTextAreaElement;
  // 단계 수가 그래픽 단계 행 수를 결정하므로, 커밋 뒤 탭을 다시 그려 두 편집기를 동기화한다.
  textarea.addEventListener("change", () => {
    updateCrop(record.id, { stages: parseStages(textarea.value) });
    rerender();
  });
  return el("label", {
    class: "db-field",
    children: [
      el("span", { text: "단계 소요일" }),
      textarea,
      el("small", { text: `현재 ${record.stages.length}단계 · 총 ${record.stages.reduce((total, stage) => total + stage.days, 0)}일` }),
    ],
  });
}

function seasonsField(record: CropRecord, rerender: () => void): HTMLElement {
  const controls = SEASONS.map((season) => {
    const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid: `db-crop-season-${season}` } }) as HTMLInputElement;
    input.checked = record.seasons.includes(season);
    input.addEventListener("input", () => {
      const current = store.getCurrent().database.crops?.find((crop) => crop.id === record.id) ?? record;
      const seasons = new Set(current.seasons);
      if (input.checked) seasons.add(season);
      else seasons.delete(season);
      updateCrop(record.id, { seasons: [...seasons] });
      // normalizeCropRecord가 계절 전체 해제 시 "봄"으로 강제 복원한다(빈 계절 방지).
      // 이 복원은 화면에 자동 반영되지 않으므로(폼이 다시 그려지지 않음) 명시적으로
      // rerender해 체크박스 상태를 실제 저장값과 동기화한다.
      rerender();
    });
    return el("label", {
      class: "db-checkbox-field db-cx-season",
      children: [input, el("span", { text: SEASON_LABEL[season] ?? season })],
    });
  });
  return el("div", { class: "db-cx-season-row", children: controls });
}

// ---------------------------------------------------------------------------
// 성장 그래픽 — 단계별 미리보기 + 리소스 선택 (F 축 P0)
// ---------------------------------------------------------------------------

/**
 * `graphicStages` 는 세 상태를 가진다.
 *   undefined : 저작 안 함 → 작물 id/수확 아이템에서 자동 배선(프로젝트에 저장되지 않음)
 *   []        : 명시적 "그림 없음"
 *   [...]     : 저작된 배선
 * 자동 배선 값을 몰래 레코드에 심으면 되돌릴 수 없으므로(farmModel.ts 주석), 편집 버퍼는
 * **저작값에서만** 시작하고 자동 배선은 읽기 전용 미리보기와 명시적 "고정" 버튼으로만 노출한다.
 */
function graphicStagesCard(record: CropRecord, rerender: () => void): HTMLElement {
  const authored = record.graphicStages;
  const effective = cropGraphicStages(record);
  const rowCount = Math.max(1, record.stages.length + 1, authored?.length ?? 0);
  const buffer: CropGraphicStage[] = Array.from({ length: rowCount }, (_, index) => ({ ...(authored?.[index] ?? {}) }));

  const commit = (): void => {
    updateCrop(record.id, { graphicStages: buffer.map((stage) => ({ ...stage })) });
  };

  const children: HTMLElement[] = [];

  if (authored === undefined) {
    children.push(noticeBar({
      text: effective.length > 0
        ? "작물 id 또는 수확 아이템에서 자동 배선된 그림을 쓰는 중입니다 — 프로젝트 파일에는 저장되지 않습니다."
        : "연결된 그림이 없어 밭에는 단계 번호 배지가 표시됩니다.",
      tone: effective.length > 0 ? "info" : "warn",
      testid: "db-crop-graphic-auto-notice",
      ...(effective.length > 0
        ? {
          action: {
            label: "이 배선을 고정",
            testid: "db-crop-graphic-adopt",
            onClick: () => {
              updateCrop(record.id, { graphicStages: effective.map((stage) => ({ ...stage })) });
              toast("자동 배선을 작물에 고정했습니다.", "ok");
              rerender();
            },
          },
        }
        : {}),
    }));
  }

  children.push(el("div", {
    class: "db-cx-stage-strip",
    dataset: { testid: "db-crop-graphic-preview" },
    children: effective.length > 0
      ? effective.map((stage, index) => el("span", {
        class: "db-cx-stage-chip",
        children: [
          stageThumb(stage, 32),
          el("small", { text: stage.label?.trim() || stageName(index, effective.length) }),
        ],
      }))
      : [el("span", { class: "empty-hint", text: "밭에 그릴 그림이 아직 없습니다." })],
  }));

  children.push(el("div", {
    class: "db-cx-stage-grid",
    children: buffer.map((_, index) => graphicStageRow(buffer, index, rowCount, commit)),
  }));

  return sectionCard({
    title: "성장 그래픽",
    hint: `밭 한 칸에 그려지는 그림입니다. 마지막 ${rowCount}번째 칸은 수확 가능 상태 전용입니다.`,
    testid: "db-crop-graphic-card",
    children: [
      ...children,
      // 원문 textarea 는 위의 단계 편집기가 못 다루는 리소스(직접 지정 ID)를 위한 탈출구다.
      // 접을 수 있게 두되 기본은 펼침 — qa-crops.spec.ts 가 `db-crop-graphic-stages` 를
      // fill() 하므로 감춰지면 계약이 깨진다.
      sectionCard({
        title: "원문 편집",
        hint: "한 줄: resourceId | frame | label",
        collapsible: true,
        testid: "db-crop-graphic-raw-card",
        children: [rawGraphicStagesField(record, rerender)],
      }),
    ],
  });
}

function graphicStageRow(
  buffer: CropGraphicStage[],
  index: number,
  total: number,
  commit: () => void,
): HTMLElement {
  const current = buffer[index]!;
  const thumb = stageThumb(current, 32);

  const options = [
    ...FARMING_CROP_SPRITE_ASSETS.map((asset) => ({ id: asset.id, name: asset.name })),
    ...(current.resourceId && !FARMING_CROP_SPRITE_ASSETS.some((asset) => asset.id === current.resourceId)
      ? [{ id: current.resourceId, name: `${current.resourceId} (직접 지정)` }]
      : []),
  ];

  const labelInput = el("input", {
    attrs: { type: "text", placeholder: stageName(index, total) },
    value: current.label ?? "",
    dataset: { testid: `db-crop-graphic-label-${index}` },
  }) as HTMLInputElement;

  // 썸네일만 국소 교체한다 — 값 하나 바꿀 때마다 탭 전체를 다시 그리면 캐럿을 잃는다.
  let mounted = thumb;
  const repaintThumb = (): void => {
    const next = stageThumb(buffer[index]!, 32);
    mounted.replaceWith(next);
    mounted = next;
  };

  // 프레임 칸은 리소스에 따라 통째로 갈아 끼운다 — 알려진 시트면 눈으로 고르는 썸네일 줄,
  // 모르는 리소스면 숫자 입력. 리소스를 바꿔도 탭을 다시 그리지 않으므로(캐럿 보존) 여기서
  // 국소 교체한다.
  let frameSlot = frameField(buffer, index, commit, repaintThumb);
  const repaintFrameSlot = (): void => {
    const next = frameField(buffer, index, commit, repaintThumb);
    frameSlot.replaceWith(next);
    frameSlot = next;
  };

  const resource = selectField(
    "리소스",
    `db-crop-graphic-resource-${index}`,
    current.resourceId ?? "",
    options,
    (value) => {
      if (value) buffer[index] = { ...buffer[index], resourceId: value };
      else {
        const next = { ...buffer[index] };
        delete next.resourceId;
        buffer[index] = next;
      }
      commit();
      repaintThumb();
      repaintFrameSlot();
    },
  );

  labelInput.addEventListener("input", () => {
    const next = { ...buffer[index] };
    const raw = labelInput.value.trim();
    if (raw === "") delete next.label;
    else next.label = raw;
    buffer[index] = next;
    commit();
  });

  return el("div", {
    class: "db-cx-stage-row",
    dataset: { testid: `db-crop-graphic-stage-${index}` },
    children: [
      thumb,
      el("span", { class: "db-cx-stage-name", text: stageName(index, total) }),
      resource,
      frameSlot,
      field("라벨", labelInput),
    ],
  });
}

/**
 * 프레임 선택 칸. 감사 F 축의 핵심 — "밭에 무엇이 그려지는가"를 숫자로만 고르게 두면
 * 저작자는 시트를 열어보기 전까지 알 수 없다. 번들 스프라이트 시트처럼 프레임 수를 아는
 * 리소스는 프레임을 전부 썸네일로 깔아 눈으로 고르게 하고, 그 외(직접 지정 ID)만 숫자 입력을
 * 남긴다. 어느 쪽이든 바깥 컨테이너 testid 는 `db-crop-graphic-frame-<index>` 로 같다.
 */
function frameField(
  buffer: CropGraphicStage[],
  index: number,
  commit: () => void,
  repaintThumb: () => void,
): HTMLElement {
  const current = buffer[index]!;
  const asset = FARMING_CROP_SPRITE_ASSETS.find((entry) => entry.id === current.resourceId);

  const setFrame = (frame: number | string | undefined): void => {
    const next = { ...buffer[index] };
    if (frame === undefined || frame === "") delete next.frame;
    else next.frame = frame;
    buffer[index] = next;
    commit();
    repaintThumb();
  };

  if (!asset) {
    const frameInput = el("input", {
      attrs: { type: "text", inputmode: "numeric", placeholder: "0" },
      value: current.frame === undefined ? "" : String(current.frame),
      dataset: { testid: `db-crop-graphic-frame-input-${index}` },
    }) as HTMLInputElement;
    frameInput.addEventListener("input", () => {
      const raw = frameInput.value.trim();
      setFrame(raw === "" ? undefined : (Number.isFinite(Number(raw)) ? Number(raw) : raw));
    });
    const wrap = field("프레임", frameInput);
    wrap.dataset.testid = `db-crop-graphic-frame-${index}`;
    return wrap;
  }

  const selected = Number.isFinite(Number(current.frame)) ? Math.trunc(Number(current.frame ?? 0)) : 0;
  const buttons: HTMLElement[] = [];
  for (let frame = 0; frame < asset.frameCount; frame += 1) {
    const active = frame === selected;
    const button = el("button", {
      class: `db-cx-frame-btn${active ? " active" : ""}`,
      attrs: { type: "button", title: `프레임 ${frame}`, "aria-pressed": active ? "true" : "false" },
      dataset: { testid: `db-crop-graphic-frame-${index}-${frame}` },
      children: [
        stageThumb({ resourceId: asset.id, frame }, 26),
        el("small", { text: String(frame) }),
      ],
    });
    button.addEventListener("click", () => {
      setFrame(frame);
      for (const [other, node] of buttons.entries()) {
        const on = other === frame;
        node.classList.toggle("active", on);
        node.setAttribute("aria-pressed", on ? "true" : "false");
      }
    });
    buttons.push(button);
  }

  return el("label", {
    class: "db-field db-cx-frame-field",
    dataset: { testid: `db-crop-graphic-frame-${index}` },
    children: [
      el("span", { text: "프레임" }),
      el("div", { class: "db-cx-frame-row", children: buttons }),
    ],
  });
}

function rawGraphicStagesField(record: CropRecord, rerender: () => void): HTMLElement {
  const textarea = el("textarea", {
    value: (record.graphicStages ?? []).map(formatGraphicStage).join("\n"),
    attrs: { rows: "4" },
    dataset: { testid: "db-crop-graphic-stages" },
  }) as HTMLTextAreaElement;
  textarea.addEventListener("change", () => {
    updateCrop(record.id, { graphicStages: parseGraphicStages(textarea.value) });
    rerender();
  });
  return el("label", {
    class: "db-field",
    children: [
      el("span", { text: "그래픽 단계 원문" }),
      textarea,
      el("small", { text: "비우면 단계 번호 배지로 표시합니다. 값이 전부 빈 줄은 저장되지 않습니다." }),
    ],
  });
}

function stageName(index: number, total: number): string {
  return index === total - 1 ? "수확기" : `${index + 1}단계`;
}

/** 작물 스프라이트 시트에서 한 프레임만 잘라 보여주는 정사각 슬롯. */
function stageThumb(stage: CropGraphicStage | undefined, size: number): HTMLElement {
  const slot = el("span", { class: "db-cx-thumb", attrs: { "aria-hidden": "true" } });
  // 크기는 배경 크롭 계산과 짝이라 인라인으로 둔다. display 도 인라인으로 박아,
  // 전용 스타일시트가 아직 import 되지 않은 상태에서도 스프라이트가 보이게 한다.
  slot.style.display = "inline-block";
  slot.style.width = `${size}px`;
  slot.style.height = `${size}px`;
  const resourceId = stage?.resourceId;
  const url = resourceId ? resolveAssetResourceUrl(resourceId) : null;
  if (!url) {
    slot.classList.add("empty");
    return slot;
  }
  slot.style.backgroundImage = `url("${url}")`;
  const asset = FARMING_CROP_SPRITE_ASSETS.find((entry) => entry.id === resourceId);
  if (!asset) {
    slot.style.backgroundSize = "contain";
    slot.style.backgroundPosition = "center";
    return slot;
  }
  const raw = Number(stage?.frame ?? 0);
  const frame = Number.isFinite(raw) ? Math.min(Math.max(0, Math.trunc(raw)), asset.frameCount - 1) : 0;
  const scale = size / asset.frameWidth;
  slot.style.backgroundSize = `${asset.frameCount * asset.frameWidth * scale}px auto`;
  slot.style.backgroundPosition = `-${frame * asset.frameWidth * scale}px 0`;
  return slot;
}

// ---------------------------------------------------------------------------
// 저장
// ---------------------------------------------------------------------------

function updateCrop(id: string, patch: Partial<CropRecord>): void {
  recordCoalescedSnapshot(`db-crop:${id}:${Object.keys(patch).sort().join(",")}`);
  store.update((project) => {
    const records = project.database.crops ?? [];
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) return;
    records[index] = normalizeCropRecord({ ...records[index], ...patch });
    project.database.crops = records;
  }, { scope: "database", collection: "crops" });
}

function parseStages(value: string): CropRecord["stages"] {
  const stages = value
    .split(/\r?\n/)
    .flatMap((line): CropRecord["stages"] => {
      const days = parseInt(line.trim(), 10);
      return Number.isFinite(days) && days > 0 ? [{ days }] : [];
    });
  return stages.length > 0 ? stages : [{ days: 1 }];
}

function formatGraphicStage(stage: CropGraphicStage): string {
  return [stage.resourceId ?? "", stage.frame ?? "", stage.label ?? ""].join(" | ");
}

function parseGraphicStages(value: string): CropGraphicStage[] {
  return value
    .split(/\r?\n/)
    .flatMap((line): CropGraphicStage[] => {
      const [resourceId, frame, label] = line.split("|").map((part) => part.trim());
      if (!resourceId && !frame && !label) return [];
      return [{
        ...(resourceId ? { resourceId } : {}),
        ...(frame ? { frame } : {}),
        ...(label ? { label } : {}),
      }];
    });
}

function itemLabel(project: Project, itemId: string): string {
  return project.database.items.find((item) => item.id === itemId)?.name || itemId;
}

/** `db-ws-stack` 안에서 한 줄을 통째로 쓰는 요소. */
function spanning(node: HTMLElement): HTMLElement {
  node.classList.add("db-ws-span");
  return node;
}
