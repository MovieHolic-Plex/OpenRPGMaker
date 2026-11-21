import { DIALOGUE_TAG_COLORS, parseDialogueEmotion } from "@/project/dialogueStyles";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import type { Project } from "@/project/types";
import type { DialogueTextControl, DialogueTextFx, DialogueTextSegment } from "./dialoguePagination";

export type DialogueTextContext = {
  readonly session: Pick<PlaySessionLike, "variables" | "actorNames"> & { readonly gold?: number; readonly stringVariables?: Readonly<Record<string, string>> };
  readonly project: Pick<Project, "database">;
};

export function resolveDialogueText(value: string, context?: DialogueTextContext): string {
  return parseDialogueText(value, context).map((segment) => segment.text).join("");
}

export function parseDialogueText(value: string, context?: DialogueTextContext): DialogueTextSegment[] {
  const segments: DialogueTextSegment[] = [];
  let colorIndex = 0;
  let buffer = "";
  let pendingControls: DialogueTextControl[] = [];
  // 본문 태그 상태. [/] 는 가장 최근에 연 태그 하나를 닫는다.
  let fx: DialogueTextFx | undefined;
  let rate = 1;
  const openTags: ({ readonly type: "fx"; readonly previous: DialogueTextFx | undefined }
    | { readonly type: "rate"; readonly previous: number }
    | { readonly type: "lock" })[] = [];
  const push = (includeEmpty = false): void => {
    if (!buffer && !includeEmpty && pendingControls.length === 0) return;
    segments.push({
      text: buffer,
      colorIndex,
      ...(pendingControls.length > 0 ? { controlsBefore: pendingControls } : {}),
      ...(fx ? { fx } : {}),
    });
    buffer = "";
    pendingControls = [];
  };
  const addControl = (control: DialogueTextControl): void => {
    if (buffer) push();
    pendingControls.push(control);
  };
  const openFx = (patch: DialogueTextFx): void => {
    if (buffer) push();
    openTags.push({ type: "fx", previous: fx });
    fx = { ...fx, ...patch };
  };
  const applyTag = (raw: string): boolean => {
    const tag = parseInlineTag(raw);
    if (!tag) return false;
    switch (tag.kind) {
      case "close": {
        const top = openTags.pop();
        if (!top) return true;
        if (top.type === "fx") {
          if (buffer) push();
          fx = top.previous;
        } else if (top.type === "rate") {
          rate = top.previous;
          addControl({ kind: "rate", factor: rate });
        } else {
          addControl({ kind: "lock", on: false });
        }
        return true;
      }
      case "fx":
        openFx(tag.fx);
        return true;
      case "rate":
        openTags.push({ type: "rate", previous: rate });
        rate = tag.factor;
        addControl({ kind: "rate", factor: rate });
        return true;
      case "lock":
        openTags.push({ type: "lock" });
        addControl({ kind: "lock", on: true });
        return true;
      case "control":
        addControl(tag.control);
        return true;
    }
  };
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === "[") {
      const end = value.indexOf("]", i + 1);
      if (end > i && end - i <= 40 && applyTag(value.slice(i + 1, end))) {
        i = end;
        continue;
      }
    }
    if (char !== "\\") {
      buffer += char;
      continue;
    }
    const next = value[i + 1];
    if (next === "\\") {
      buffer += "\\";
      i += 1;
      continue;
    }
    const control = next?.toLowerCase();
    // \T[id] — 문자열 변수(자유 텍스트 입력 결과). id 는 숫자가 아니어도 된다.
    if (control === "t" && value[i + 2] === "[") {
      const end = value.indexOf("]", i + 3);
      if (end >= 0) {
        buffer += context?.session.stringVariables?.[value.slice(i + 3, end).trim()] ?? "";
        i = end;
        continue;
      }
    }
    if ((control === "v" || control === "n" || control === "c" || control === "s") && value[i + 2] === "[") {
      const end = value.indexOf("]", i + 3);
      if (end >= 0) {
        const rawIndex = value.slice(i + 3, end).trim();
        const index = Number(rawIndex);
        // \V[var_price] — 이름 id 변수(조수·스크립트가 쓰는 id). 숫자 칸 \V[12] 는 아래 그대로.
        if (control === "v" && !Number.isInteger(index) && /^[A-Za-z_][\w-]{0,63}$/u.test(rawIndex)) {
          buffer += String(context?.session.variables[rawIndex] ?? 0);
          i = end;
          continue;
        }
        if (Number.isInteger(index)) {
          if (control === "v") {
            buffer += String(resolveVariable(context, index));
            i = end;
            continue;
          }
          if (control === "n") {
            buffer += resolveActorName(context, index);
            i = end;
            continue;
          }
          if (control === "c") {
            push();
            colorIndex = clampDialogueColor(index);
          } else {
            addControl({ kind: "speed", value: index });
          }
          i = end;
          continue;
        }
      }
    }
    if (next === "_") {
      addControl({ kind: "halfSpace" });
      buffer += " ";
      i += 1;
      continue;
    }
    const simpleControl: DialogueTextControl | undefined =
      next === "$" ? { kind: "gold" }
      : next === "!" ? { kind: "pause" }
      : next === "." ? { kind: "wait", ms: 250 }
      : next === "|" ? { kind: "wait", ms: 1000 }
      : next === ">" ? { kind: "fastOn" }
      : next === "<" ? { kind: "fastOff" }
      : next === "^" ? { kind: "autoClose" }
      : undefined;
    if (simpleControl) {
      addControl(simpleControl);
      i += 1;
      continue;
    }
    buffer += char;
  }
  push(pendingControls.length > 0);
  return segments;
}

type ParsedInlineTag =
  | { readonly kind: "close" }
  | { readonly kind: "fx"; readonly fx: DialogueTextFx }
  | { readonly kind: "rate"; readonly factor: number }
  | { readonly kind: "lock" }
  | { readonly kind: "control"; readonly control: DialogueTextControl };

/**
 * 본문 태그 하나(대괄호 안쪽)를 읽는다. 모르는 태그는 undefined — 그대로 글자로 보인다.
 * 목록·예시는 project/dialogueStyles.ts DIALOGUE_INLINE_TAGS 가 정본이다.
 */
function parseInlineTag(raw: string): ParsedInlineTag | undefined {
  const text = raw.trim();
  if (text === "/") return { kind: "close" };
  const colon = text.search(/[:：]/u);
  const name = (colon >= 0 ? text.slice(0, colon) : text).trim().toLowerCase();
  const arg = colon >= 0 ? text.slice(colon + 1).trim() : "";
  switch (name) {
    case "흔들": case "shake": return { kind: "fx", fx: { shake: true } };
    case "물결": case "wave": return { kind: "fx", fx: { wave: true } };
    case "크게": case "big": return { kind: "fx", fx: { size: "big" } };
    case "작게": case "small": return { kind: "fx", fx: { size: "small" } };
    case "색": case "color": {
      const color = DIALOGUE_TAG_COLORS[arg] ?? DIALOGUE_TAG_COLORS[arg.toLowerCase()]
        ?? (/^#[0-9a-f]{6}$/iu.test(arg) ? arg : undefined);
      return color ? { kind: "fx", fx: { color } } : undefined;
    }
    case "쉼": case "pause": {
      const seconds = Number(arg || "0.5");
      if (!Number.isFinite(seconds) || seconds < 0) return undefined;
      return { kind: "control", control: { kind: "wait", ms: Math.round(Math.min(5, seconds) * 1000) } };
    }
    case "빠르게": case "fast": return { kind: "rate", factor: 0.5 };
    case "느리게": case "slow": return { kind: "rate", factor: 2 };
    case "표정": case "face": {
      const emotion = parseDialogueEmotion(arg);
      return emotion ? { kind: "control", control: { kind: "expression", emotion } } : undefined;
    }
    case "소리": case "sound":
      return arg ? { kind: "control", control: { kind: "sound", soundId: arg } } : undefined;
    case "화면흔들": case "screenshake": return { kind: "control", control: { kind: "screenShake" } };
    case "넘기기금지": case "noskip": return { kind: "lock" };
    default: return undefined;
  }
}

function resolveVariable(context: DialogueTextContext | undefined, index: number): number {
  if (!context) return 0;
  const slotId = `var_${String(index).padStart(4, "0")}`;
  return context.session.variables[slotId] ?? context.session.variables[String(index)] ?? context.session.variables[`v${index}`] ?? 0;
}

function resolveActorName(context: DialogueTextContext | undefined, index: number): string {
  if (!context) return "";
  const actor = context.project.database.actors[index - 1];
  if (!actor) return "";
  return context.session.actorNames?.[actor.id] ?? actor.name;
}

function clampDialogueColor(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(19, Math.trunc(index)));
}

/**
 * 이름표·화자 프로필에 쓸 이름. `\n[1]`·`\v[1]`·`\t[id]` 는 본문과 같은 규칙으로 푼다.
 * 코드가 비면(없는 배우 번호) 원문을 남겨 오타가 이름표에 그대로 보이게 한다.
 */
export function resolveDialogueSpeakerName(speaker: string | undefined, context?: DialogueTextContext): string | undefined {
  const name = speaker?.trim();
  if (!name) return undefined;
  if (!context || !name.includes("\\")) return name;
  const resolved = resolveDialogueText(name, context).trim();
  return resolved || name;
}
