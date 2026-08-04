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
import { amountStepper, segmentedSelect } from "./recordPicker";
import { actorPicker, itemPicker, mapPicker } from "./sharedPickers";
import { switchPicker, variablePicker } from "./switchVariablePicker";
import type { CommandEditContext } from "./types";

/**
 * 스키마 렌더 경로를 타는 kind 목록. 현재는 비어 있다 — 의도적이다.
 *
 * 전환 후보로 "전용 폼이 없어 정적 안내문만 나오던" 명령 8종
 * (cutsceneControl / checkpointSave / killPlayer / gameOver / returnToTitle /
 *  stopAudio / sleepUntilMorning / breakLoop)을 먼저 검토했으나,
 * 전체 스위트 대조 결과 이들 모두 기존 testid 계약을 테스트로 못박고 있었다.
 * 예: scopedForms.test.ts "keeps truly terminal commands on their hint-only route"
 * 는 gameOver 가 [data-testid="game-over-editor"] 를 내고 input/select/textarea 를
 * 하나도 갖지 않을 것을 요구한다.
 *
 * 따라서 kind 전환은 "한 줄 추가"가 아니라 kind 당 아래 절차를 밟는 작업이다:
 *   1. 해당 kind 의 기존 testid 를 스키마 필드의 testId 로 지정해 계약을 승계한다.
 *   2. 그 kind 를 참조하는 테스트를 돌려 DOM 형태 기대치를 맞춘다.
 *   3. 여기 등재한다.
 *
 * 첫 전환 권장 대상은 cutsceneControl 이다. 지금은 mode 를 폼에서 아예 고칠 수 없고
 * (안내문만 렌더) 스키마는 mode·skippable 편집을 제공하므로 순수 기능 개선이다.
 * 다만 위 hint-only 테스트를 함께 고쳐야 하므로 제품 결정이 필요하다.
 */
export const SCHEMA_RENDERED_KINDS: ReadonlySet<string> = new Set<string>();

/** 프로젝트 상태에서 요약문 조회기를 만든다. */
export function summaryLookup(): SummaryLookup {
  const project = store.getCurrent();
  const named = (id: string): string => {
    if (!id) return "(미지정)";
    const db = project.database;
    const pools = [db.items, db.actors, db.skills, db.enemies, db.troops] as readonly { id: string; name?: string }[][];
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
  } catch {
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
  const wrap = el("span", {
    class: "rich-command-form schema-command-form",
    dataset: { testid: `schema-form-${schema.kind}`, schemaKind: schema.kind },
  });

  const current = (): Record<string, unknown> =>
    (context.getCurrentCommand?.() ?? cmd) as unknown as Record<string, unknown>;

  const patch = (changes: Record<string, unknown>): void => {
    context.actions.replaceCommand(context.path, {
      ...current(),
      ...changes,
      kind: schema.kind,
    } as unknown as Command);
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
  return wrap;
}

function renderField(
  kind: string,
  key: string,
  spec: FieldSpec,
  cmd: Record<string, unknown>,
  patch: (changes: Record<string, unknown>) => void
): HTMLElement | undefined {
  const testid = `${kebab(kind)}-${fieldTestId(key, spec)}`;
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
      const input = numberInput(asNumber(value), spec.label, `${testid}-input`);
      if (spec.min !== undefined) input.setAttribute("min", String(spec.min));
      if (spec.max !== undefined) input.setAttribute("max", String(spec.max));
      input.addEventListener("change", () =>
        patch({ [key]: clamp(Number.parseInt(input.value, 10) || 0, spec.min, spec.max) })
      );
      return amountStepper(input, { testidBase: testid, min: spec.min ?? 0 });
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
      const button = el("button", {
        class: "rich-toggle",
        text: spec.label,
        attrs: { type: "button", "aria-pressed": String(value === true) },
        dataset: { testid: `${testid}-toggle` },
      }) as HTMLButtonElement;
      button.addEventListener("click", () => patch({ [key]: value !== true }));
      return button;
    }

    case "enum": {
      const handle = segmentedSelect({
        options: spec.choices.map((choice) => ({
          value: choice.value,
          label: choice.label,
          key: choice.key ?? choice.value,
        })),
        value: asEnumValue(value, spec.choices[0]?.value ?? ""),
        testid: `${testid}-select`,
        ariaLabel: spec.label,
      });
      handle.select.addEventListener("change", () => patch({ [key]: decodeEnum(handle.select.value) }));
      return handle.root;
    }

    case "op": {
      const handle = segmentedSelect({
        options: spec.ops.map((op) => ({ value: op, label: op, key: opKey(op) })),
        value: asString(value) || spec.ops[0] || "=",
        testid: `${testid}-select`,
        ariaLabel: spec.label,
      });
      handle.select.addEventListener("change", () => patch({ [key]: handle.select.value }));
      return handle.root;
    }

    case "operand": {
      // 고정값 ↔ 변수 참조. 두 컨트롤을 한 행에 두고 모드에 따라 전환한다.
      const isVar = isVarOperand(value);
      const mode = segmentedSelect({
        options: [
          { value: "fixed", label: "고정값", key: "fixed" },
          { value: "var", label: "변수", key: "var" },
        ],
        value: isVar ? "var" : "fixed",
        testid: `${testid}-mode`,
        ariaLabel: `${spec.label} 지정 방식`,
      });
      const row = el("span", { class: "rich-form-row schema-operand" });
      row.append(mode.root);
      if (isVar) {
        const picker = variablePicker({
          selectedId: varOperandId(value),
          selectTestId: `${testid}-variable`,
          onChange: (id) => patch({ [key]: { kind: "var", id } }),
        });
        row.append(picker.root);
      } else {
        const input = numberInput(asNumber(value), spec.label, `${testid}-input`);
        input.addEventListener("change", () =>
          patch({ [key]: clamp(Number.parseInt(input.value, 10) || 0, spec.min) })
        );
        row.append(amountStepper(input, { testidBase: testid, min: spec.min ?? 0 }));
      }
      mode.select.addEventListener("change", () => {
        patch({ [key]: mode.select.value === "var" ? { kind: "var", id: "" } : 0 });
      });
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
