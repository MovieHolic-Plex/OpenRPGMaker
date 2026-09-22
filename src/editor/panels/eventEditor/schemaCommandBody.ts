// 스키마 → 편집 폼 렌더러.
//
// 이 파일은 새 위젯을 만들지 않는다. FieldSpec 을 읽어 기존 프리미티브
// (segmentedSelect / numberInput / amountStepper / switchPicker / itemPicker …)에 위임한다.
// 따라서 스키마로 이행해도 시각 언어와 testid 계약이 그대로 유지된다.
//
// 이행 전략: SCHEMA_RENDERED_KINDS 에 등재된 kind 만 이 경로를 탄다.
// 나머지는 기존 commandBody*.ts 로 그대로 떨어진다. 한 번에 갈아엎지 않는다.

import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { el } from "@/util/dom";
// 스키마 등록 side-effect. 이 import 가 없으면 레지스트리가 비어 있다.
import "@/editor/eventCommands/schema/catalog";
import "@/editor/eventCommands/schema/catalogExtended";
import {
  commandSchemaFor,
  type CommandSchema,
  type SummaryLookup,
} from "@/editor/eventCommands/schema/defineCommand";
import {
  fieldTestId,
  visibleFields,
  type FieldSpec,
} from "@/editor/eventCommands/schema/fieldTypes";
import { numberInput } from "./commandBodyAdvanced";
import { amountStepper, recordPickerWithPreview, segmentedSelect } from "./recordPicker";
import { listMovieResources } from "./playMoviePreview";
import { actorPicker, itemPicker, mapPicker } from "./sharedPickers";
import { switchPicker, variablePicker } from "./switchVariablePicker";
import type { CommandEditContext } from "./types";

const OP_LABELS: Record<string, string> = { "=": "이 값으로", "+=": "더하기", "-=": "빼기", "*=": "곱하기", "/=": "나누기" };

const SCHEMA_CONTAINER_TESTID: Record<string, string> = {
  changeGold: "event-command-gold-form",
  changeItem: "event-command-item-form",
};

/**
 * 스키마 렌더 경로를 타는 kind 목록.
 *
 * 명령 75종이 전부 스키마로 선언돼 있지만, 렌더 경로 전환은 kind 마다 아래 절차를
 * 밟아야 한다. 기존 폼들이 저마다 testid 계약을 테스트로 못박고 있기 때문이다
 * 게임 오버는 이름별 라이브러리 선택기를 가진 전용 폼을 유지한다.
 *
 *   1. 해당 kind 의 기존 testid 를 스키마 필드의 testId 로 지정해 계약을 승계한다.
 *   2. 그 kind 를 참조하는 테스트를 돌려 DOM 형태 기대치를 맞춘다.
 *   3. 여기 등재한다.
 *
 * "등재 목록에 있는 kind 만 스키마 폼을 렌더한다" 테스트가 절차 없는 등재를 막는다.
 */
export const SCHEMA_RENDERED_KINDS: ReadonlySet<string> = new Set<string>([
  // 1호 전환. 기존에는 terminalFallbackBody 의 안내문만 렌더돼 mode 를 고칠 수 없었고,
  // scopedForms.test.ts 의 컷신 폼 계약 2건이 그래서 실패 상태였다.
  // 스키마가 그 testid 를 승계하며 두 테스트를 통과시킨다.
  "cutsceneControl",
  "changeGold",
  "changeItem",
  // Validation must reach the already-declared skill/operand fields, not an empty inspector.
  "changeLifeSkillExp",
]);

/** 프로젝트 상태에서 요약문 조회기를 만든다. */
export function summaryLookup(): SummaryLookup {
  const project = store.getCurrent();
  const named = (id: string): string => {
    if (!id) return "(미지정)";
    const db = project.database;
    const pools = [db.items, db.actors, db.skills, db.enemies, db.troops, project.system.gameOvers ?? []] as readonly { id: string; name?: string }[][];
    for (const pool of pools) {
      const hit = pool?.find((entry) => entry.id === id);
      if (hit?.name) return hit.name;
    }
    const map = project.maps?.[id];
    if (map?.name) return map.name;
    return id;
  };
  return {
    switchName: (id) => project.switches.find((s) => s.id === id)?.name || id || "(미지정)",
    variableName: (id) => project.variables.find((v) => v.id === id)?.name || id || "(미지정)",
    recordName: named,
  };
}

/** 스키마가 있으면 요약문을, 없으면 undefined 를 돌려준다. */
export function schemaSummary(cmd: Command): string | undefined {
  const schema = commandSchemaFor(cmd.kind);
  if (!schema) return undefined;
  try {
    return schema.summary(cmd as unknown as Record<string, unknown>, summaryLookup());
  } catch (e) {
    console.warn("[schemaSummary] " + cmd.kind, e);
    // 요약문 실패가 목록 렌더 전체를 죽이지 않게 한다.
    return undefined;
  }
}

/**
 * 스키마 기반 편집 폼. 등재되지 않은 kind 면 undefined 를 돌려
 * 기존 렌더 체인이 이어받게 한다.
 */
export function renderSchemaCommandBody(
  context: CommandEditContext,
  cmd: Command
): HTMLElement | undefined {
  if (!SCHEMA_RENDERED_KINDS.has(cmd.kind)) return undefined;
  const schema = commandSchemaFor(cmd.kind);
  if (!schema) return undefined;
  return renderSchemaForm(context, cmd, schema);
}

/** 등재 여부와 무관하게 스키마 폼을 그린다 (테스트·미리보기용). */
export function renderSchemaForm(
  context: CommandEditContext,
  cmd: Command,
  schema: CommandSchema
): HTMLElement {
  // 컨테이너 testid 는 kind 에서 파생된다: cutsceneControl → cutscene-control-editor.
  // 기존 폼의 컨테이너 계약과 그대로 맞물린다.
  const wrap = el("span", {
    class: "rich-command-form schema-command-form cream-command-form",
    dataset: {
      testid: SCHEMA_CONTAINER_TESTID[schema.kind] ?? `${kebab(schema.kind)}-editor`,
      schemaKind: schema.kind,
    },
  });

  const current = (): Record<string, unknown> =>
    (context.getCurrentCommand?.() ?? cmd) as unknown as Record<string, unknown>;

  const patch = (changes: Record<string, unknown>): void => {
    const next: Record<string, unknown> = { ...current(), ...changes, kind: schema.kind };
    // when 이 더 이상 성립하지 않는 필드는 명령에서 제거한다.
    // 예: cutsceneControl 의 mode 가 "end" 가 되면 skippable 은 의미를 잃으므로 남기지 않는다.
    for (const [key, spec] of Object.entries(schema.fields)) {
      if (spec.when && !spec.when(next)) delete next[key];
    }
    context.actions.replaceCommand(context.path, next as unknown as Command);
  };

  const fields = visibleFields(schema.fields, cmd as unknown as Record<string, unknown>);
  if (fields.length === 0) {
    wrap.append(
      el("span", {
        class: "empty-hint schema-no-fields",
        text: schema.summary(cmd as unknown as Record<string, unknown>, summaryLookup()),
        dataset: { testid: `schema-no-fields-${schema.kind}` },
      })
    );
    return wrap;
  }

  for (const [key, spec] of fields) {
    const control = renderField(schema.kind, key, spec, current(), patch);
    if (!control) continue;
    wrap.append(
      el("span", {
        class: "rich-form-row schema-field",
        dataset: { schemaField: key },
        children: [el("span", { class: "schema-field-label", text: spec.label }), control],
      })
    );
  }
  if (schema.kind === "changeGold") {
    wrap.append(el("p", { class: "schema-field-hint", text: "금액은 숫자이거나 변수입니다.", dataset: { testid: "change-gold-hint" } }));
  }
  if (schema.kind === "changeItem") {
    wrap.append(el("p", { class: "schema-field-hint", text: "수량은 숫자이거나 변수입니다.", dataset: { testid: "change-item-hint" } }));
  }
  return wrap;
}

function renderField(
  kind: string,
  key: string,
  spec: FieldSpec,
  cmd: Record<string, unknown>,
  patch: (changes: Record<string, unknown>) => void
): HTMLElement | undefined {
  // spec.testId 는 절대 override 다 — 기존 폼의 testid 계약을 그대로 승계할 때 쓴다.
  const testid = spec.testId ?? `${kebab(kind)}-${fieldTestId(key, spec)}`;
  const value = cmd[key];

  switch (spec.type) {
    case "text": {
      const input = el("input", {
        attrs: { type: "text", value: asString(value), placeholder: spec.placeholder ?? "" },
        dataset: { testid: `${testid}-input` },
      }) as HTMLInputElement;
      input.addEventListener("change", () => patch({ [key]: input.value }));
      return input;
    }

    case "multiline": {
      const area = el("textarea", { dataset: { testid: `${testid}-input` } }) as HTMLTextAreaElement;
      area.value = asString(value);
      area.addEventListener("change", () => patch({ [key]: area.value }));
      return area;
    }

    case "number": {
      const min = typeof spec.min === "function" ? spec.min(cmd) : spec.min;
      const max = typeof spec.max === "function" ? spec.max(cmd) : spec.max;
      const input = numberInput(asNumber(value), spec.label, `${testid}-input`);
      if (min !== undefined) input.setAttribute("min", String(min));
      if (max !== undefined) input.setAttribute("max", String(max));
      if (spec.step !== undefined) input.setAttribute("step", String(spec.step));
      input.addEventListener("change", () => {
        // 평판 가중치는 소수다. 스키마 전환 뒤 parseInt가 0.25를 0으로 만들지 않게 숫자 필드 전체가 실수를 보존한다.
        const parsed = Number(input.value);
        patch({ [key]: clamp(Number.isFinite(parsed) ? parsed : 0, min, max) });
      });
      return amountStepper(input, { testidBase: testid, min: min ?? 0 });
    }

    case "range": {
      const input = el("input", {
        attrs: {
          type: "range",
          min: String(spec.min),
          max: String(spec.max),
          value: String(asNumber(value, spec.min)),
        },
        dataset: { testid: `${testid}-range` },
      }) as HTMLInputElement;
      input.addEventListener("change", () => patch({ [key]: Number.parseInt(input.value, 10) || spec.min }));
      return input;
    }

    case "bool": {
      // 체크박스로 낸다. 토글 버튼이 아니라 input 이어야 기존 폼의 계약(HTMLInputElement)과 맞는다.
      const box = el("input", {
        class: "rich-checkbox",
        attrs: { type: "checkbox", "aria-label": spec.label },
        dataset: { testid: ctlId(spec, testid, "toggle") },
      }) as HTMLInputElement;
      box.checked = value === true;
      box.addEventListener("change", () => patch({ [key]: box.checked }));
      return box;
    }

    case "enum": {
      const handle = segmentedSelect({
        options: spec.choices.map((choice) => ({
          value: choice.value,
          label: choice.label,
          key: choice.key ?? choice.value,
        })),
        value: asEnumValue(value, spec.choices[0]?.value ?? ""),
        testid: ctlId(spec, testid, "select"),
        ariaLabel: spec.label,
      });
      const allowed = new Set(spec.choices.map((choice) => choice.value));
      handle.select.addEventListener("change", () => {
        // 목록에 없는 값(빈 선택 등)은 현재 값으로 되돌려 쓴다 — 명령이 빈 값으로 오염되지 않는다.
        const raw = handle.select.value;
        patch({ [key]: allowed.has(raw) ? decodeEnum(raw) : cmd[key] });
      });
      return handle.root;
    }

    case "op": {
      const handle = segmentedSelect({
        options: spec.ops.map((op) => ({ value: op, label: OP_LABELS[op] ?? op, key: opKey(op) })),
        value: asString(value) || spec.ops[0] || "=",
        testid: `${testid}-select`,
        ariaLabel: spec.label,
      });
      handle.select.addEventListener("change", () => patch({ [key]: handle.select.value }));
      return handle.root;
    }

    case "operand": {
      const isVar = isVarOperand(value);
      const sourceId =
        kind === "changeGold" && key === "amount"
          ? "change-gold-amount-source"
          : kind === "changeItem" && key === "amount"
            ? "change-item-amount-source"
            : `${testid}-mode`;
      const mode = segmentedSelect({
        options: [
          { value: "number", label: "숫자", key: "number" },
          { value: "variable", label: "변수", key: "variable" },
        ],
        value: isVar ? "variable" : "number",
        testid: sourceId,
        ariaLabel: `${spec.label} 지정 방식`,
      });
      const input = numberInput(isVar ? 0 : asNumber(value), spec.label, `${testid}-input`);
      input.addEventListener("change", () =>
        patch({ [key]: clamp(Number.parseInt(input.value, 10) || 0, spec.min) })
      );
      const numberWrap = amountStepper(input, { testidBase: testid, min: spec.min ?? 0 });
      const picker = variablePicker({
        selectedId: varOperandId(value),
        selectTestId: `${testid}-select`,
        onChange: (id) => patch({ [key]: { kind: "var", id } }),
      });
      const variableWrap = el("span", {
        dataset: { testid: `${testid}-variable` },
        children: [picker.root],
      });
      const sync = (): void => {
        const useVar = mode.select.value === "variable";
        numberWrap.hidden = useVar;
        variableWrap.hidden = !useVar;
      };
      mode.select.addEventListener("change", () => {
        const useVar = mode.select.value === "variable";
        patch({ [key]: useVar ? { kind: "var", id: varOperandId(value) } : asNumber(value) });
        sync();
      });
      sync();
      const row = el("span", { class: "rich-form-row schema-operand" });
      row.append(mode.root, numberWrap, variableWrap);
      return row;
    }

    case "switch": {
      const picker = switchPicker({
        selectedId: asString(value),
        selectTestId: `${testid}-select`,
        onChange: (id) => patch({ [key]: id }),
      });
      return picker.root;
    }

    case "variable": {
      const picker = variablePicker({
        selectedId: asString(value),
        selectTestId: `${testid}-select`,
        onChange: (id) => patch({ [key]: id }),
      });
      return picker.root;
    }

    case "record":
      return renderRecordField(testid, key, spec, asString(value), patch);

    case "mapPoint": {
      // 좌표는 명령 객체에서 x·y 로 저장된다 (필드는 한 덩어리로 선언됨).
      const row = el("span", { class: "rich-form-row schema-map-point" });
      const xInput = numberInput(asNumber(cmd.x), "X", `${testid}-x`);
      const yInput = numberInput(asNumber(cmd.y), "Y", `${testid}-y`);
      xInput.addEventListener("change", () => patch({ x: Number.parseInt(xInput.value, 10) || 0 }));
      yInput.addEventListener("change", () => patch({ y: Number.parseInt(yInput.value, 10) || 0 }));
      row.append(xInput, yInput);
      return row;
    }

    case "custom":
      // 전용 위젯 자리. 위젯이 아직 연결되지 않은 필드는 렌더를 건너뛰고
      // 기존 전용 다이얼로그가 계속 담당한다.
      return el("span", {
        class: "empty-hint schema-custom-slot",
        text: `${spec.label} — 전용 편집기`,
        dataset: { testid: `${testid}-custom`, widget: spec.widget },
      });
  }
}

function renderRecordField(
  testid: string,
  key: string,
  spec: Extract<FieldSpec, { type: "record" }>,
  selectedId: string,
  patch: (changes: Record<string, unknown>) => void
): HTMLElement | undefined {
  const onChange = (id: string): void => patch({ [key]: id });
  switch (spec.source) {
    case "actor":
      return actorPicker({ selectedId, testid: `${testid}-picker`, allowEmpty: spec.allowEmpty, onChange }).root;
    case "item":
      return itemPicker({ selectedId, testid: `${testid}-picker`, allowEmpty: spec.allowEmpty, onChange }).root;
    case "map":
      return mapPicker({ selectedId, testid: `${testid}-picker`, onChange }).root;
    case "movie":
      return recordPickerWithPreview({
        records: listMovieResources(store.getCurrent()),
        selectedId,
        placeholder: "동영상 선택",
        testid: `${testid}-picker`,
        onChange,
      }).root;
    default: {
      // 아직 전용 피커가 없는 소스는 자유 입력으로 두되, 소스를 표식에 남긴다.
      const input = el("input", {
        attrs: { type: "text", value: selectedId },
        dataset: { testid: `${testid}-input`, recordSource: spec.source },
      }) as HTMLInputElement;
      input.addEventListener("change", () => onChange(input.value));
      return input;
    }
  }
}

// ── 값 헬퍼 ───────────────────────────────────────────────────────

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min?: number, max?: number): number {
  let next = value;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return next;
}

function isVarOperand(value: unknown): boolean {
  return !!value && typeof value === "object" && (value as { kind?: string }).kind === "var";
}

function varOperandId(value: unknown): string {
  return isVarOperand(value) ? asString((value as { id?: unknown }).id) : "";
}

/** enum 필드는 select 값이 문자열이므로 boolean 표현을 되돌린다 (setSwitch 의 true/false). */
function asEnumValue(value: unknown, fallback: string): string {
  if (typeof value === "boolean") return String(value);
  if (typeof value === "string") return value;
  return fallback;
}

function decodeEnum(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

function opKey(op: string): string {
  switch (op) {
    case "=":
      return "set";
    case "+=":
      return "inc";
    case "-=":
      return "dec";
    case "*=":
      return "mul";
    case "/=":
      return "div";
    default:
      return op.replace(/[^a-z0-9]/gi, "") || "op";
  }
}

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * 컨트롤 요소의 testid.
 * spec.testId 가 있으면 접미사 없이 그대로 쓴다 — 기존 폼 계약 승계용.
 */
function ctlId(spec: FieldSpec, testid: string, suffix: string): string {
  return spec.testId ? testid : `${testid}-${suffix}`;
}
