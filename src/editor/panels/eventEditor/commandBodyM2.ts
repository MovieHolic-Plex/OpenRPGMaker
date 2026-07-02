import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { m2CommandById, type M2CommandFieldSpec } from "@/editor/eventCommands/m2Catalog";
import { store } from "@/project/store";
import type { Command, M2CommandValue, ResourceKind, ResourceProfile, UploadedAsset } from "@/project/types";
import { el } from "@/util/dom";
import { field as fieldRow } from "./dom";
import type { CommandEditContext } from "./types";

type M2Command = Extract<Command, { kind: "m2Command" }>;
type ResourcePickerItem = { readonly id: string; readonly imageHeight?: number; readonly imageWidth?: number; readonly kind: ResourceKind; readonly name: string };
type RecordPickerItem = { readonly id: string; readonly name: string };
type ResourceFieldSemantic = { readonly kind: "resource"; readonly label: string; readonly resourceKinds: ReadonlySet<ResourceKind> };
type RecordFieldSemantic = { readonly emptyText: string; readonly items: readonly RecordPickerItem[]; readonly kind: "record"; readonly label: string };
type OptionsFieldSemantic = { readonly kind: "options"; readonly label: string; readonly options: readonly { readonly label: string; readonly value: string }[] };
type FieldSemantic = OptionsFieldSemantic | RecordFieldSemantic | ResourceFieldSemantic;
type FieldControlRequest = { readonly context: CommandEditContext; readonly cmd: M2Command; readonly spec: M2CommandFieldSpec; readonly title: string; readonly value: M2CommandValue };
type OptionsControlRequest = { readonly context: CommandEditContext; readonly cmd: M2Command; readonly key: string; readonly semantic: OptionsFieldSemantic; readonly value: string };
type ResourcePickerRequest = { readonly context: CommandEditContext; readonly cmd: M2Command; readonly key: string; readonly semantic: ResourceFieldSemantic; readonly value: string };
type ResourcePreviewOptions = { readonly item: ResourcePickerItem | undefined; readonly project: ReturnType<typeof store.getCurrent>; readonly selectedName: string; readonly testId: string; readonly value: string };
type RecordPickerRequest = { readonly context: CommandEditContext; readonly cmd: M2Command; readonly key: string; readonly semantic: RecordFieldSemantic; readonly value: string };

const IMAGE_RESOURCE_KINDS: ReadonlySet<ResourceKind> = new Set(["backdrop", "battle", "battleCharset", "battleWeapon", "charset", "chipset", "faceset", "gameOver", "monster", "picture", "system", "system2", "title"]);
const VEHICLE_OPTIONS = [
  { value: "boat", label: "소형선" },
  { value: "ship", label: "대형선" },
  { value: "airship", label: "비행선" },
] as const;
const PLAYER_OPTIONS = [{ value: "player", label: "주인공" }] as const;

export function renderM2CommandBody(context: CommandEditContext, cmd: Command): HTMLElement | undefined {
  if (cmd.kind !== "m2Command") return undefined;
  const entry = m2CommandById(cmd.commandId);
  const wrap = el("div", {
    class: "m2-command-body",
    dataset: { testid: `m2-command-body-${cmd.commandId}` },
  });

  if (!entry) {
    wrap.append(el("div", { class: "empty-hint", text: `알 수 없는 M2 명령: ${cmd.commandId}` }));
    return wrap;
  }

  wrap.append(
    el("div", {
      class: "empty-hint",
      text: m2CommandHelpText(entry.fields.length),
    })
  );

  if (entry.fields.length === 0) {
    wrap.append(el("div", { class: "empty-hint", text: "추가 설정 없음" }));
    return wrap;
  }

  for (const spec of entry.fields) {
    wrap.append(fieldRow(fieldLabelForSpec(cmd.commandId, entry.title, spec), controlForField({ context, cmd, spec, title: entry.title, value: cmd.fields[spec.key] ?? spec.defaultValue })));
  }
  return wrap;
}

function m2CommandHelpText(fieldCount: number): string {
  return fieldCount > 0 ? "필요한 값을 선택하고 확인을 누르세요." : "이 명령은 추가 설정 없이 실행됩니다.";
}

function controlForField(request: FieldControlRequest): HTMLElement {
  const semantic = fieldSemantic(request);
  if (semantic?.kind === "record") return recordPickerControl({ context: request.context, cmd: request.cmd, key: request.spec.key, semantic, value: String(request.value) });
  if (semantic?.kind === "resource") return resourcePickerControl({ context: request.context, cmd: request.cmd, key: request.spec.key, semantic, value: String(request.value) });
  if (semantic?.kind === "options") return optionsControl({ context: request.context, cmd: request.cmd, key: request.spec.key, semantic, value: String(request.value) });
  const { context, cmd, spec, value } = request;
  if (spec.type === "textarea") return textareaControl(context, cmd, spec, String(value));
  if (spec.type === "number") return numberControl(context, cmd, spec, value);
  if (spec.type === "boolean") return booleanControl(context, cmd, spec, value);
  if (spec.type === "select") return selectControl(context, cmd, spec, String(value));
  return textControl(context, cmd, spec, String(value));
}

function textControl(context: CommandEditContext, cmd: M2Command, spec: M2CommandFieldSpec, value: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.dataset.testid = `m2-command-${spec.key}-input`;
  input.addEventListener("change", () => updateField(context, cmd, spec.key, input.value));
  return input;
}

function textareaControl(
  context: CommandEditContext,
  cmd: M2Command,
  spec: M2CommandFieldSpec,
  value: string
): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.dataset.testid = `m2-command-${spec.key}-textarea`;
  textarea.addEventListener("change", () => updateField(context, cmd, spec.key, textarea.value));
  return textarea;
}

function numberControl(
  context: CommandEditContext,
  cmd: M2Command,
  spec: M2CommandFieldSpec,
  value: M2CommandValue
): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.value = String(typeof value === "number" ? value : spec.defaultValue);
  input.dataset.testid = `m2-command-${spec.key}-input`;
  input.addEventListener("change", () => updateField(context, cmd, spec.key, parseNumber(input.value)));
  return input;
}

function booleanControl(
  context: CommandEditContext,
  cmd: M2Command,
  spec: M2CommandFieldSpec,
  value: M2CommandValue
): HTMLInputElement {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = value === true || value === "true";
  checkbox.dataset.testid = `m2-command-${spec.key}-checkbox`;
  checkbox.addEventListener("change", () => updateField(context, cmd, spec.key, checkbox.checked));
  return checkbox;
}

function selectControl(
  context: CommandEditContext,
  cmd: M2Command,
  spec: M2CommandFieldSpec,
  value: string
): HTMLSelectElement {
  const select = document.createElement("select");
  select.dataset.testid = `m2-command-${spec.key}-select`;
  for (const option of spec.options ?? []) {
    const optionElement = document.createElement("option");
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    select.append(optionElement);
  }
  select.value = value;
  select.addEventListener("change", () => updateField(context, cmd, spec.key, select.value));
  return select;
}

function resourcePickerControl(request: ResourcePickerRequest): HTMLElement {
  const project = store.getCurrent();
  const items = resourcePickerItems(project.resourceProfiles, Object.values(project.assets.uploaded), request.semantic.resourceKinds);
  const selectedItem = items.find((item) => item.id === request.value);
  const selectedName = selectedItem?.name ?? (request.value ? `목록에 없는 리소스: ${request.value}` : "선택 없음");
  const testIds = resourcePickerTestIds(request.key);
  const select = el("select", {
    attrs: { "aria-label": request.semantic.label },
    dataset: { testid: testIds.picker },
  });
  select.append(el("option", { text: "(선택 없음)", attrs: { value: "" } }));
  if (request.value && selectedItem === undefined) {
    select.append(el("option", { text: `현재 값: ${request.value}`, attrs: { value: request.value } }));
  }
  for (const item of items) {
    select.append(el("option", { text: `${item.name} (${item.id})`, attrs: { value: item.id } }));
  }
  select.value = request.value;
  select.addEventListener("change", () => updateField(request.context, request.cmd, request.key, select.value));

  return el("div", {
    class: "m2-resource-picker",
    children: [
      select,
      el("div", {
        class: "m2-resource-selected-name",
        text: selectedName,
        dataset: { testid: testIds.selectedName },
      }),
      resourcePreview({ item: selectedItem, project, selectedName, testId: testIds.preview, value: request.value }),
    ],
  });
}

function recordPickerControl(request: RecordPickerRequest): HTMLElement {
  const selectedItem = request.semantic.items.find((item) => item.id === request.value);
  const selectedName = selectedItem?.name ?? (request.value ? `목록에 없는 항목: ${request.value}` : "선택 없음");
  const select = el("select", {
    attrs: { "aria-label": request.semantic.label },
    dataset: { testid: `m2-command-${request.key}-record-select` },
  });
  select.append(el("option", { text: `(${request.semantic.emptyText})`, attrs: { value: "" } }));
  if (request.value && selectedItem === undefined) select.append(el("option", { text: `현재 값: ${request.value}`, attrs: { value: request.value } }));
  for (const [index, item] of request.semantic.items.entries()) {
    select.append(el("option", { text: `${String(index + 1).padStart(4, "0")}: ${item.name}`, attrs: { value: item.id } }));
  }
  select.value = request.value;
  select.addEventListener("change", () => updateField(request.context, request.cmd, request.key, select.value));
  return el("div", {
    class: "m2-record-picker",
    children: [
      select,
      el("div", { class: "m2-record-selected-name", text: selectedName, dataset: { testid: `m2-command-${request.key}-record-selected-name` } }),
    ],
  });
}

function optionsControl(request: OptionsControlRequest): HTMLSelectElement {
  const select = el("select", { attrs: { "aria-label": request.semantic.label }, dataset: { testid: `m2-command-${request.key}-option-select` } }) as HTMLSelectElement;
  for (const option of request.semantic.options) select.append(el("option", { text: option.label, attrs: { value: option.value } }));
  select.value = request.value;
  select.addEventListener("change", () => updateField(request.context, request.cmd, request.key, select.value));
  return select;
}

function resourcePickerItems(
  profiles: readonly ResourceProfile[],
  uploaded: readonly UploadedAsset[],
  selectedKinds: ReadonlySet<ResourceKind>
): readonly ResourcePickerItem[] {
  const seenIds = new Set<string>();
  const items: ResourcePickerItem[] = [];
  for (const profile of profiles) {
    if (profile.assetId === undefined || seenIds.has(profile.assetId) || !selectedKinds.has(profile.kind)) continue;
    seenIds.add(profile.assetId);
    items.push({
      id: profile.assetId,
      kind: profile.kind,
      name: profile.name,
      ...resourceImageSize(profile.imageWidth, profile.imageHeight),
    });
  }
  for (const asset of uploaded) {
    const kind = resourceKindFromUploaded(asset.kind);
    if (kind === null || seenIds.has(asset.id) || !selectedKinds.has(kind)) continue;
    seenIds.add(asset.id);
    items.push({
      id: asset.id,
      kind,
      name: asset.name,
      ...resourceImageSize(asset.meta.width, asset.meta.height),
    });
  }
  return items;
}

function resourcePreview(options: ResourcePreviewOptions): HTMLElement {
  const resourceId = options.item?.id ?? options.value;
  const url = resolveAssetResourceUrl(resourceId, { project: options.project });
  const canPreview = options.item !== undefined && IMAGE_RESOURCE_KINDS.has(options.item.kind) && url !== null;
  const preview = el("div", {
    class: "m2-resource-preview",
    attrs: { "aria-label": resourcePreviewAriaLabel(options.item?.kind) },
    dataset: { testid: options.testId, resourceId },
  });
  if (canPreview) {
    preview.append(
      resourcePreviewImage(url, options.selectedName, options.item),
      el("span", { class: "m2-resource-preview-label", text: options.selectedName })
    );
    return preview;
  }
  preview.dataset.empty = "true";
  preview.textContent = options.value ? `${options.selectedName} 미리보기 없음` : "리소스 선택";
  return preview;
}

function resourcePreviewImage(url: string, selectedName: string, item: ResourcePickerItem): HTMLImageElement {
  const attrs: Record<string, string> = {
    alt: selectedName,
    src: url,
  };
  if (item.imageWidth !== undefined) attrs.width = String(item.imageWidth);
  if (item.imageHeight !== undefined) attrs.height = String(item.imageHeight);
  return el("img", { attrs });
}

function fieldSemantic(request: FieldControlRequest): FieldSemantic | undefined {
  const project = store.getCurrent();
  const { spec, title } = request;
  if (spec.key === "resourceId") return resourceSemantic(title);
  if (spec.key === "actorId") return recordSemantic("주인공 선택", "주인공 선택", namedRecords(project.database.actors));
  if (spec.key === "classId") return recordSemantic("직업 선택", "직업 선택", namedRecords(project.database.classes));
  if (spec.key === "skillId") return recordSemantic("특수기 선택", "특수기 선택", namedRecords(project.database.skills));
  if (spec.key === "itemId") return recordSemantic("아이템 선택", "아이템 선택", namedRecords(project.database.items));
  if (spec.key === "equipmentId") return recordSemantic("장비 선택", "장비 선택", namedRecords(project.database.equipment));
  if (spec.key === "stateId") return recordSemantic("상태 선택", "상태 선택", namedRecords(project.database.states));
  if (spec.key === "enemyId") return recordSemantic("적 선택", "적 선택", namedRecords(project.database.enemies));
  if (spec.key === "troopId") return recordSemantic("적 그룹 선택", "적 그룹 선택", namedRecords(project.database.troops));
  if (spec.key === "switchId") return recordSemantic("스위치 선택", "스위치 선택", namedRecords(project.switches));
  if (spec.key === "eventId") return recordSemantic("이벤트 선택", "이벤트 선택", eventRecords(project));
  if (spec.key === "commonEventId") return recordSemantic("공통 이벤트 선택", "공통 이벤트 선택", namedRecords(project.commonEvents));
  if (spec.key === "tilesetId") return recordSemantic("타일셋 선택", "타일셋 선택", namedRecords(Object.values(project.tilesets)));
  if (spec.key === "animationId") return recordSemantic("전투 애니메이션 선택", "전투 애니메이션 선택", namedRecords(project.database.battleAnimations));
  if (spec.key === "variableId") return recordSemantic("변수 선택", "변수 선택", namedRecords(project.variables));
  if (spec.key === "mapId") return recordSemantic("맵 선택", "맵 선택", namedRecords(Object.values(project.maps)));
  if (spec.key === "target") {
    const semantic = targetSemantic(title, project);
    if (semantic) return semantic;
  }
  if (spec.key === "value") {
    const semantic = valueSemantic(title, project);
    if (semantic) return semantic;
  }
  if (spec.type === "select" && spec.options) return { kind: "options", label: spec.label, options: spec.options };
  return undefined;
}

function targetSemantic(title: string, project: ReturnType<typeof store.getCurrent>): FieldSemantic | undefined {
  if (title.includes("Actor") || title === "Change State" || title === "Damage Processing" || title === "Name Input Processing" || title === "Recover All") return recordSemantic("주인공 선택", "주인공 선택", namedRecords(project.database.actors));
  if (title.includes("Enemy")) return recordSemantic("적 선택", "적 선택", namedRecords(project.database.enemies));
  if (title.includes("Vehicle")) return { kind: "options", label: "탈것 선택", options: VEHICLE_OPTIONS };
  if (title.includes("Player")) return { kind: "options", label: "주인공 선택", options: PLAYER_OPTIONS };
  if (title.includes("Event") || title === "Flash Event" || title === "Move Event" || title === "Show Animation") return recordSemantic("이벤트 선택", "이벤트 선택", eventRecords(project));
  return undefined;
}

function valueSemantic(title: string, project: ReturnType<typeof store.getCurrent>): FieldSemantic | undefined {
  if (title === "Change Actor Class") return recordSemantic("직업 선택", "직업 선택", namedRecords(project.database.classes));
  if (title === "Change Skills") return recordSemantic("특수기 선택", "특수기 선택", namedRecords(project.database.skills));
  if (title === "Change Items") return recordSemantic("아이템 선택", "아이템 선택", namedRecords(project.database.items));
  if (title === "Change State" || title === "Change Enemy State") return recordSemantic("상태 선택", "상태 선택", namedRecords(project.database.states));
  if (title === "Change Equipment") return recordSemantic("장비 선택", "장비 선택", namedRecords(project.database.equipment));
  if (title === "Change Tileset") return recordSemantic("타일셋 선택", "타일셋 선택", namedRecords(Object.values(project.tilesets)));
  if (title === "Change Battle Commands") return recordSemantic("전투 커맨드 선택", "전투 커맨드 선택", namedRecords(project.database.battleCommands ?? []));
  if (title === "Change System Graphic") return { kind: "resource", label: "시스템 그래픽 선택", resourceKinds: new Set(["system", "system2"]) };
  if (title === "Change Actor Graphic" || title === "Change Vehicle Graphic") return { kind: "resource", label: "캐릭터 그래픽 선택", resourceKinds: new Set(["charset"]) };
  if (title === "Change Actor Faceset") return { kind: "resource", label: "얼굴 그래픽 선택", resourceKinds: new Set(["faceset"]) };
  if (title === "Change Parallax Back") return { kind: "resource", label: "파노라마 리소스 선택", resourceKinds: new Set(["backdrop"]) };
  return undefined;
}

function resourceSemantic(title: string): ResourceFieldSemantic {
  if (title.includes("Battleback")) return { kind: "resource", label: "전투 배경 리소스 선택", resourceKinds: new Set(["backdrop"]) };
  if (title.includes("Picture")) return { kind: "resource", label: "그림 리소스 선택", resourceKinds: new Set(["picture"]) };
  if (title.includes("BGM")) return { kind: "resource", label: "BGM 리소스 선택", resourceKinds: new Set(["music"]) };
  if (title.includes("SE")) return { kind: "resource", label: "SE 리소스 선택", resourceKinds: new Set(["sound"]) };
  if (title.includes("Movie")) return { kind: "resource", label: "동영상 리소스 선택", resourceKinds: IMAGE_RESOURCE_KINDS };
  return { kind: "resource", label: "리소스 선택", resourceKinds: IMAGE_RESOURCE_KINDS };
}

function recordSemantic(label: string, emptyText: string, items: readonly RecordPickerItem[]): RecordFieldSemantic {
  return { kind: "record", label, emptyText, items };
}

function namedRecords(records: readonly { readonly id: string; readonly name?: string }[]): readonly RecordPickerItem[] {
  return records.map((record) => ({ id: record.id, name: record.name?.trim() || "(이름 없음)" }));
}

function eventRecords(project: ReturnType<typeof store.getCurrent>): readonly RecordPickerItem[] {
  return Object.values(project.maps).flatMap((map) => map.events.map((event) => ({ id: event.id, name: `${map.name} / ${event.id} (${event.x}, ${event.y})` })));
}

function resourcePickerTestIds(key: string): { readonly picker: string; readonly preview: string; readonly selectedName: string } {
  if (key === "resourceId") return { picker: "m2-command-resourceId-picker", preview: "m2-command-resourceId-preview", selectedName: "m2-command-resourceId-selected-name" };
  return { picker: `m2-command-${key}-resource-picker`, preview: `m2-command-${key}-resource-preview`, selectedName: `m2-command-${key}-resource-selected-name` };
}

function resourcePreviewAriaLabel(kind: ResourceKind | undefined): string {
  if (kind === "picture") return "선택한 그림 리소스 미리보기";
  if (kind === "backdrop") return "선택한 전투 배경 리소스 미리보기";
  return "선택한 리소스 미리보기";
}

function fieldLabelForSpec(commandId: string, title: string, spec: M2CommandFieldSpec): string {
  if (spec.key === "target") return targetLabelForTitle(title) ?? spec.label;
  if (spec.key === "value") return valueLabelForTitle(title) ?? spec.label;
  if (spec.key === "animationId") return "전투 애니메이션";
  if (spec.key === "variableId") return "변수";
  if (spec.key === "mapId") return "맵";
  if (spec.key !== "resourceId") return spec.label;
  if (commandId.includes("picture")) return "그림 리소스";
  if (commandId.includes("battleback")) return "전투 배경";
  if (commandId.includes("bgm")) return "BGM";
  if (commandId.includes("se")) return "효과음";
  return "리소스";
}

function targetLabelForTitle(title: string): string | undefined {
  if (title.includes("Actor") || title === "Change State" || title === "Damage Processing" || title === "Name Input Processing" || title === "Recover All") return "주인공";
  if (title.includes("Enemy")) return "적";
  if (title.includes("Vehicle")) return "탈것";
  if (title.includes("Player")) return "주인공";
  if (title.includes("Event") || title === "Flash Event" || title === "Move Event" || title === "Show Animation") return "이벤트";
  return undefined;
}

function valueLabelForTitle(title: string): string | undefined {
  if (title === "Change Actor Class") return "직업";
  if (title === "Change Skills") return "특수기";
  if (title === "Change Items") return "아이템";
  if (title === "Change State" || title === "Change Enemy State") return "상태";
  if (title === "Change Equipment") return "장비";
  if (title === "Change Tileset") return "타일셋";
  if (title === "Change Battle Commands") return "전투 커맨드";
  if (title === "Change System Graphic") return "시스템 그래픽";
  if (title === "Change Actor Graphic" || title === "Change Vehicle Graphic") return "캐릭터 그래픽";
  if (title === "Change Actor Faceset") return "얼굴 그래픽";
  if (title === "Change Parallax Back") return "파노라마";
  return undefined;
}

function resourceKindFromUploaded(kind: UploadedAsset["kind"]): ResourceKind | null {
  return kind === "tileset" ? "chipset" : kind === "sprite" ? "charset" : kind;
}

function resourceImageSize(
  imageWidth: number | undefined,
  imageHeight: number | undefined
): Pick<ResourcePickerItem, "imageHeight" | "imageWidth"> {
  return { ...(imageWidth !== undefined ? { imageWidth } : {}), ...(imageHeight !== undefined ? { imageHeight } : {}) };
}

function updateField(context: CommandEditContext, cmd: M2Command, key: string, value: M2CommandValue): void {
  context.actions.replaceCommand(context.path, {
    ...cmd,
    fields: {
      ...cmd.fields,
      [key]: value,
    },
  });
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
