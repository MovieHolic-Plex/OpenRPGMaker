// editor/tools/assistantSkillTools.ts
// 조수 스킬 읽기 — 저장소 assistant-skills/<id>/SKILL.md 를 굽은 번들(src/assets/assistantSkills.json)을 그대로 돌려준다.
// 원본은 하나다: Claude 스킬(~/.claude/skills 심링크)과 편집기 조수가 같은 글을 읽는다. 번들은
// `node scripts/content/bundle-assistant-skills.mjs` 로 다시 굽는다(test/assistantSkillTools.test.ts 가 어긋남을 막는다).
// 고정 텍스트라 한 번 읽으면 된다(read_directing_guide 와 같은 꼴). 긴 스킬은 6000자씩 쪽으로 읽는다.
// 스킬 폴더의 references/**/*.md 는 «부분(part)» 이다. 본문은 src/assets/assistantSkillParts.json 에 따로 굽고
// (편집기 첫 번들 밖), read_assistant_skill({id, part}) 의 prepare 가 동적 import 로 받는다.

import bundle from "@/assets/assistantSkills.json";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export interface AssistantSkill {
  readonly id: string;
  readonly description: string;
  readonly body: string;
  readonly extras?: readonly { readonly title: string; readonly text: string }[];
  /** references 아래 md 문서 목록(본문은 assistantSkillParts.json). id 는 references/ 기준 상대 경로에서 .md 를 뺀 것. */
  readonly parts?: readonly { readonly id: string; readonly characters: number }[];
}

type SkillParts = Readonly<Record<string, readonly { readonly id: string; readonly text: string }[]>>;
let skillParts: SkillParts | null = null;
let partsLoadError = "";

async function loadSkillParts(): Promise<void> {
  if (skillParts) return;
  try {
    const mod = await import("@/assets/assistantSkillParts.json");
    skillParts = ((mod.default ?? mod) as { parts: SkillParts }).parts;
    partsLoadError = "";
  } catch (error) {
    partsLoadError = error instanceof Error ? error.message : String(error);
    throw error;
  }
}

const PAGE = 6000;

export const ASSISTANT_SKILLS: readonly AssistantSkill[] = (bundle as { skills: AssistantSkill[] }).skills;

export function assistantSkillById(id: string): AssistantSkill | undefined {
  const key = id.trim().toLowerCase();
  return ASSISTANT_SKILLS.find((skill) => skill.id.toLowerCase() === key);
}

const listAssistantSkills: ToolDefinition = {
  name: "list_assistant_skills",
  description:
    "조수 스킬 목록(id·언제 쓰는가)을 돌려준다. 스킬은 데모 게임을 사람이 손으로 고친 교훈을 정리한 작업 지침이다 — " +
    "이야기·이벤트·컷신·NPC 등장/퇴장·문/이동/계단·대화창·BGM 은 game-scene-polish, 대사·자막·선택지·아이템 설명을 쓰거나 윤문할 때는 dialogue-polish(공식 윤문 스킬, general-good-writing), 손 도트 실내는 interior-room-authoring, 일본 상가 거리는 jp-city-building-authoring. " +
    "본문은 read_assistant_skill 로 읽는다.",
  mode: "read",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  invalidArgsExample: {},
  run(): ToolExecResult {
    const skills = ASSISTANT_SKILLS.map((skill) => ({ id: skill.id, description: skill.description, characters: skill.body.length }));
    return { summary: `조수 스킬 ${skills.length}개`, data: { skills } };
  },
};

const readAssistantSkill: ToolDefinition = {
  name: "read_assistant_skill",
  description:
    "조수 스킬 본문을 읽는다(6000자씩, nextOffset 이 있으면 이어 읽는다). 이야기 장면·이벤트·컷신·NPC 등장과 퇴장·문과 이동·계단·대화창·맵 BGM·탈것·전투 균형을 " +
    "만들거나 고치기 전에 id:\"game-scene-polish\" 를 한 번 끝까지 읽는다 — 세 데모에서 사람이 손으로 고친 실수와 확인법이다. " +
    "대사·자막·선택지·설명 글을 쓰거나 고치기 전에는 id:\"dialogue-polish\" 를 읽는다. 스킬의 부분 문서(원본 규칙 등)는 part 로 하나씩 읽는다(결과 parts 가 목록). 고정 텍스트라 같은 턴에 반복 호출하지 않는다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "스킬 id(list_assistant_skills). 예: game-scene-polish" },
      part: { type: "string", description: "스킬의 부분 문서(references) 하나만 읽는다. 목록은 이 도구의 결과 parts 또는 스킬 본문의 표. 예: dialogue-polish 의 ko/README" },
      offset: { type: "integer", minimum: 0 },
    },
    required: ["id"],
    additionalProperties: false,
  },
  invalidArgsExample: { id: "game-scene-polish" },
  prepare: (args) => (typeof args.part === "string" && args.part.trim() ? loadSkillParts() : Promise.resolve()),
  run(_project, args): ToolExecResult {
    const id = typeof args.id === "string" ? args.id : "";
    const skill = assistantSkillById(id);
    if (!skill) {
      throw new ToolError(`조수 스킬 없음 — ${id}. 있는 id: ${ASSISTANT_SKILLS.map((s) => s.id).join(", ")}`, { code: "invalid-args" });
    }
    const partId = typeof args.part === "string" ? args.part.trim().replace(/^references\//, "").replace(/\.md$/, "") : "";
    let text: string;
    let label = skill.id;
    if (partId) {
      const known = skill.parts ?? [];
      if (!known.some((part) => part.id === partId)) {
        throw new ToolError(`스킬 ${skill.id} 에 부분 ${partId} 없음. 있는 part: ${known.map((part) => part.id).join(", ") || "없음"}`, { code: "invalid-args" });
      }
      const found = skillParts?.[skill.id]?.find((part) => part.id === partId);
      if (!found) {
        throw new ToolError(`스킬 부분 문서를 불러오지 못했다${partsLoadError ? ` (${partsLoadError})` : ""}. 비동기 실행 경로(runToolAsync/prepareTool)로 부른다.`, { code: "skill-part-not-prepared" });
      }
      text = found.text;
      label = `${skill.id}/${partId}`;
    } else {
      text = [skill.body, ...(skill.extras ?? []).map((extra) => `\n\n# ${extra.title}\n\n${extra.text}`)].join("");
    }
    const offset = typeof args.offset === "number" && Number.isInteger(args.offset) && args.offset >= 0 ? args.offset : 0;
    if (offset > text.length) throw new ToolError("offset 이 본문 길이를 넘는다.", { code: "invalid-args" });
    const end = Math.min(offset + PAGE, text.length);
    return {
      summary: `스킬 ${label} · ${offset}–${end}/${text.length}${end < text.length ? ` — 이어 읽기 offset:${end}` : ""}`,
      data: {
        id: skill.id,
        ...(partId ? { part: partId } : { description: skill.description }),
        content: text.slice(offset, end),
        offset,
        nextOffset: end < text.length ? end : null,
        totalCharacters: text.length,
        ...(!partId && skill.parts?.length ? { parts: skill.parts.map((part) => part.id) } : {}),
      },
    };
  },
};

export const ASSISTANT_SKILL_TOOLS: readonly ToolDefinition[] = [listAssistantSkills, readAssistantSkill];
