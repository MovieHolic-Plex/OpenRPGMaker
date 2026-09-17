// editor/panels/databaseCinematicPresetGallery.ts
// 오프닝 탭의 프리셋 카드 묶음. 그림·움직임·곡·자동 넘김이 이미 물려 있는 시퀀스를 한 번에 깐다.
import { cinematicNote as note } from "@/editor/panels/databaseCinematicControls";
import { sectionCard } from "@/editor/panels/databaseWorkspace";
import {
  openingPresetCoverResourceId,
  openingPresetDurationSeconds,
  OPENING_PRESETS,
  type OpeningPreset,
} from "@/editor/openingPresets";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { store } from "@/project/store";
import { el } from "@/util/dom";

export type OpeningPresetGalleryOptions = {
  /** 적용 자체는 액션이 맡는다 — 이 모듈은 고르기와 확인만 책임진다. */
  readonly applyPreset: (preset: OpeningPreset) => boolean;
  /** 이미 쓰고 있는 장면 수. 0보다 크면 덮어쓰기 확인을 받는다. */
  readonly sceneCount: () => number;
  readonly setStatus: (message: string) => void;
};

function presetCard(preset: OpeningPreset, onPick: () => void): HTMLElement {
  const coverId = openingPresetCoverResourceId(preset);
  const coverUrl = coverId ? resolveAssetResourceUrl(coverId, { project: store.getCurrent() }) : null;
  const cover = el("span", { class: "db-cinematic-preset-cover" });
  if (coverUrl) {
    // 장식 이미지다 — 카드 이름이 이미 접근 가능한 이름을 준다.
    const image = el("img", { attrs: { alt: "", draggable: "false", loading: "lazy" } });
    image.src = coverUrl;
    cover.append(image);
  }
  return el("button", {
    class: "db-cinematic-preset-card",
    attrs: {
      type: "button",
      title: `${preset.name} — ${preset.mood}`,
    },
    dataset: { testid: `db-cinematic-preset-${preset.id}` },
    on: { click: onPick },
    children: [
      cover,
      el("span", { class: "db-cinematic-preset-name", text: preset.name }),
      el("span", { class: "db-cinematic-preset-mood", text: preset.mood }),
      el("span", {
        class: "db-cinematic-preset-meta",
        text: `장면 ${preset.scenes.length}개 · 약 ${openingPresetDurationSeconds(preset)}초 · 자동 넘김`,
      }),
    ],
  });
}

/**
 * 프리셋을 누르면 기존 장면·배경음악·사용 여부가 통째로 바뀐다. 되돌리기 한 번으로 복구되지만,
 * 작성자가 쓴 장면이 있으면 그 사실을 먼저 알린다(되돌리기를 아는 사람만 쓰는 기능이 아니다).
 */
export function createOpeningPresetGallery(options: OpeningPresetGalleryOptions): HTMLElement {
  const pick = (preset: OpeningPreset): void => {
    const existing = options.sceneCount();
    if (existing > 0 && !globalThis.confirm(
      `「${preset.name}」 프리셋으로 바꿀까요? 지금 장면 ${existing}개와 배경음악 설정이 교체됩니다. 실행 취소로 되돌릴 수 있습니다.`,
    )) return;
    if (!options.applyPreset(preset)) return;
    options.setStatus(`「${preset.name}」 프리셋을 적용했습니다. 장면 ${preset.scenes.length}개가 자동으로 넘어갑니다 — 시퀀스 미리보기로 확인하세요.`);
  };
  return sectionCard({
    title: "오프닝 프리셋",
    hint: "누르면 바로 완성된 연출",
    testid: "db-cinematic-preset-gallery",
    children: [
      el("div", {
        class: "db-cinematic-preset-grid",
        children: OPENING_PRESETS.map(preset => presetCard(preset, () => pick(preset))),
      }),
      note("배경화·화면 움직임·타이틀 카드·배경음악이 함께 들어옵니다. 적용한 뒤 장면을 골라 문장만 바꿔도 됩니다. 내레이션의 「제목」 자리에는 프로젝트 제목이 들어갑니다."),
    ],
  });
}
