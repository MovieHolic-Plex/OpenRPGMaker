import { el } from "@/util/dom";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";
import { ATMOSPHERE_PRESETS, ATMOSPHERE_GENRES, ATMOSPHERE_SCENES, ATMOSPHERE_SOUNDS, normalizeAtmosphereEffects, type AtmosphereEffect, type AtmosphereSound } from "@/project/atmosphere";
import { POST_FX_PRESETS, POST_FX_PRESET_IDS, normalizePostFx, type PostFxPresetId } from "@/project/postFx";
import { setMapAtmosphereEffects, setMapPostFx } from "@/editor/actions";

function renderPostFxSection(host: HTMLElement, map: GameMap, refresh: () => void): void {
  const section = el("div", { class: "panel-section map-props-section", dataset: { testid: "map-postfx-section" } });
  section.append(el("h3", { text: "HD-2D 필름 후처리 (색감 · 블룸 · 심도 · 햇살)" }));
  const current = normalizePostFx(map.postFx);
  const select = el("select", { attrs: { "aria-label": "HD-2D 필름 후처리 프리셋" }, dataset: { testid: "map-postfx-preset" } }) as HTMLSelectElement;
  for (const id of POST_FX_PRESET_IDS) {
    const spec = POST_FX_PRESETS[id];
    select.append(el("option", { attrs: { value: id }, text: `${spec.label} — ${spec.summary}` }));
  }
  select.value = current.preset;
  select.addEventListener("change", () => {
    const next = select.value as PostFxPresetId;
    setMapPostFx(map.id, next === "none" ? null : { preset: next });
    refresh();
  });
  section.append(select);
  section.append(el("p", {
    class: "map-props-hint",
    text: current.preset === "none"
      ? "원본 타일·캐릭터·기물을 바꾸지 않고 화면 전체에 옥토패스풍 필름 색감, 발광 블룸, 상하 심도(DoF), 햇살을 실시간으로 입힙니다."
      : `${POST_FX_PRESETS[current.preset].summary} — 실제 화면은 플레이에서 WebGL 1패스로 렌더링됩니다.`,
  }));

  if (current.preset !== "none") {
    const sliders: Array<readonly [key: "intensity" | "bloom" | "dof" | "godRays" | "vignette", label: string]> = [
      ["intensity", "전체 강도"],
      ["bloom", "광원 블룸"],
      ["dof", "상하 심도 (DoF)"],
      ["godRays", "대각선 햇살"],
      ["vignette", "가장자리 비네트"],
    ];
    for (const [key, label] of sliders) {
      const val = Math.round((current[key] ?? 0) * 100);
      const line = el("label", { class: "map-props-check-row" });
      const out = el("span", { text: `${val}%` });
      const input = el("input", {
        attrs: { type: "range", min: "0", max: "100", step: "5", value: String(val), "aria-label": `후처리 ${label}` },
        dataset: { testid: `map-postfx-${key}` },
      }) as HTMLInputElement;
      input.addEventListener("input", () => { out.textContent = `${input.value}%`; });
      input.addEventListener("change", () => setMapPostFx(map.id, { [key]: Number(input.value) / 100 }));
      line.append(el("span", { text: label }), input, out);
      section.append(line);
    }
    const emCheck = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "map-postfx-preserve-emissive" } }) as HTMLInputElement;
    emCheck.checked = current.preserveEmissive !== false;
    emCheck.addEventListener("change", () => setMapPostFx(map.id, { preserveEmissive: emCheck.checked }));
    const emRow = el("label", { class: "map-props-check-row" });
    emRow.append(emCheck, el("span", { text: "불·촛불·네온 고유 발광색 보존 (Emissive)" }));
    section.append(emRow);
  }
  host.append(section);
}

export function renderMapAtmosphere(host: HTMLElement, map: GameMap, refresh: () => void): void {
  renderPostFxSection(host, map, refresh);
  host.append(el("p", { class: "map-props-hint", text: "맵 전체에 적용됩니다. 여러 효과를 함께 켤 수 있으며 비·눈·구름과도 겹쳐집니다. 실제 모습은 플레이 화면에서 확인하세요." }));
  const presetRow = el("div", { class: "panel-section map-props-section" });
  presetRow.append(el("h3", { text: "분위기 프리셋" }));
  const select = el("select", { attrs: { "aria-label": "분위기 프리셋" }, dataset: { testid: "atmosphere-scene-preset" } }) as HTMLSelectElement;
  for (const genre of ATMOSPHERE_GENRES) {
    const group = el("optgroup", { attrs: { label: genre } });
    for (const preset of ATMOSPHERE_SCENES.filter(p => p.genre === genre)) group.append(el("option", { attrs: { value: preset.id }, text: preset.label }));
    select.append(group);
  }
  const description = el("p", { class: "map-props-hint", text: ATMOSPHERE_SCENES[0]!.description });
  select.addEventListener("change", () => { description.textContent = ATMOSPHERE_SCENES.find(p => p.id === select.value)!.description; });
  const apply = el("button", { text: "프리셋 적용", attrs: { type: "button" }, dataset: { testid: "atmosphere-scene-apply" } });
  apply.addEventListener("click", () => {
    const preset = ATMOSPHERE_SCENES.find(p => p.id === select.value);
    if (preset) { setMapAtmosphereEffects(map.id, preset.effects); refresh(); }
  });
  const clear = el("button", { text: "환경 효과 모두 끄기", attrs: { type: "button" }, dataset: { testid: "atmosphere-clear" } });
  clear.addEventListener("click", () => { setMapAtmosphereEffects(map.id, []); refresh(); });
  presetRow.append(select, apply, clear, description, el("p", { class: "map-props-hint", text: "적용하면 현재 환경 효과와 소리 설정이 이 조합으로 바뀝니다. 적용 후 각 항목을 자유롭게 수정할 수 있습니다. 환경음은 게임의 효과음 볼륨을 따릅니다." }));
  host.append(presetRow);
  const effects = normalizeAtmosphereEffects(map.atmosphereEffects);
  for (const group of ["자연", "판타지", "도시", "공간"]) {
    host.append(el("h3", { text: group }));
    for (const preset of ATMOSPHERE_PRESETS.filter(p => p.group === group)) {
      const section = el("div", { class: "panel-section map-props-section" });
      const effect = effects.find(e => e.kind === preset.id);
      const check = el("input", { attrs: { type: "checkbox" }, dataset: { testid: `atmosphere-${preset.id}` } }) as HTMLInputElement;
      check.checked = !!effect;
      const row = el("label", { class: "map-props-check-row" });
      row.append(check, el("span", { text: preset.label }));
      section.append(row);
      const current = () => normalizeAtmosphereEffects(store.getCurrent().maps[map.id]?.atmosphereEffects);
      check.addEventListener("change", () => {
        setMapAtmosphereEffects(map.id, check.checked ? [...current(), { kind: preset.id }] : current().filter(e => e.kind !== preset.id));
        refresh();
      });
      if (effect) for (const [field, label, max] of [["amount", "양", 100], ["speed", "속도", 300], ["size", "크기", 300], ["opacity", "진하기", 100]] as const) {
        const line = el("label", { class: "map-props-check-row" });
        const value = el("span", { text: `${Math.round(effect[field] * 100)}%` });
        const input = el("input", { attrs: { type: "range", min: field === "size" ? "30" : "0", max: String(max), step: "5", value: String(Math.round(effect[field] * 100)), "aria-label": `${preset.label} ${label}` }, dataset: { testid: `atmosphere-${preset.id}-${field}` } }) as HTMLInputElement;
        input.addEventListener("input", () => { value.textContent = `${input.value}%`; });
        input.addEventListener("change", () => {
          const next: AtmosphereEffect[] = current().map(e => e.kind === preset.id ? { ...e, [field]: Number(input.value) / 100 } : e);
          setMapAtmosphereEffects(map.id, next);
        });
        line.append(el("span", { text: label }), input, value);
        section.append(line);
      }
      if (effect) {
        const soundRow = el("label", { class: "map-props-check-row" });
        const sounds = el("select", { attrs: { "aria-label": `${preset.label} 환경음` }, dataset: { testid: `atmosphere-${preset.id}-sound` } }) as HTMLSelectElement;
        for (const [id, name] of Object.entries(ATMOSPHERE_SOUNDS)) sounds.append(el("option", { attrs: { value: id }, text: name }));
        sounds.value = effect.sound ?? "none";
        sounds.addEventListener("change", () => setMapAtmosphereEffects(map.id, current().map(e => e.kind === preset.id ? { ...e, sound: sounds.value as AtmosphereSound } : e)));
        soundRow.append(el("span", { text: "환경음" }), sounds);
        section.append(soundRow);
        const volumeRow = el("label", { class: "map-props-check-row" });
        const volume = el("input", { attrs: { type: "range", min: "0", max: "100", step: "5", value: String(Math.round((effect.volume ?? 0.35) * 100)), "aria-label": `${preset.label} 환경음 볼륨` }, dataset: { testid: `atmosphere-${preset.id}-volume` } }) as HTMLInputElement;
        const number = el("span", { text: `${volume.value}%` });
        volume.addEventListener("input", () => { number.textContent = `${volume.value}%`; });
        volume.addEventListener("change", () => setMapAtmosphereEffects(map.id, current().map(e => e.kind === preset.id ? { ...e, volume: Number(volume.value) / 100 } : e)));
        volumeRow.append(el("span", { text: "소리 크기" }), volume, number); section.append(volumeRow);
        const tintRow = el("label", { class: "map-props-check-row" });
        const tint = el("input", { attrs: { type: "color", value: effect.tint ?? `#${preset.color.toString(16).padStart(6, "0")}`, "aria-label": `${preset.label} 색상` }, dataset: { testid: `atmosphere-${preset.id}-tint` } }) as HTMLInputElement;
        tint.addEventListener("change", () => setMapAtmosphereEffects(map.id, current().map(e => e.kind === preset.id ? { ...e, tint: tint.value } : e)));
        tintRow.append(el("span", { text: "색상" }), tint); section.append(tintRow);
      }
      host.append(section);
    }
  }
}
