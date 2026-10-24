// editor/dialogue/storyScriptText.ts
// 대본을 조수가 읽는 짧은 글로 푼다(read_story_script · get_story_outline). 줄마다 끝에 ⟨S12.3·a1b2c3⟩ 꼬리표를 단다 —
// 장면 번호.줄 번호 와 원문 해시 앞 6자. rewrite_dialogue 는 이 꼬리표(ref + hash)를 그대로 받는다.

import type { Project } from "@/project/types";
import { speakerVoiceNote } from "@/project/dialogueDesk";
import type { DialogueLine } from "./dialogueIndex";
import { buildStory, sceneHeading, sceneMeta, sceneSummary, type ScriptNode, type Story, type StoryScene } from "./storyScript";

export const STORY_HASH_PREFIX = 6;

function tag(story: Story, line: DialogueLine): string {
  const at = story.lineRefs.get(line.id);
  const scene = at ? story.scenes.get(at.sceneId) : undefined;
  return scene ? ` ⟨${scene.ref}.${at!.index}·${line.hash.slice(0, STORY_HASH_PREFIX)}⟩` : "";
}

function oneLine(text: string): string {
  return text.replace(/\n/gu, " / ");
}

function renderNodes(story: Story, nodes: readonly ScriptNode[], indent: string, out: string[]): void {
  for (const node of nodes) {
    switch (node.k) {
      case "line": {
        const who = node.line.speaker || (node.line.kind === "text" ? "(내레이션)" : "");
        out.push(`${indent}${who ? `${who}: ` : ""}${oneLine(node.line.text)}${tag(story, node.line)}`);
        break;
      }
      case "dir":
        out.push(`${indent}[${node.text}]`);
        break;
      case "choice":
        out.push(`${indent}[선택지]${node.prompt ? ` ${oneLine(node.prompt.text)}${tag(story, node.prompt)}` : ""}`);
        for (const option of node.options) {
          out.push(`${indent}  > ${option.head ? `${oneLine(option.head.text)}${tag(story, option.head)}` : option.label}`);
          renderNodes(story, option.children, `${indent}    `, out);
        }
        break;
      case "block":
        out.push(`${indent}{${node.label}}`);
        renderNodes(story, node.children, `${indent}  `, out);
        break;
    }
  }
}

export function renderSceneText(project: Project, story: Story, scene: StoryScene, options: { readonly withSummary?: boolean } = {}): string {
  const out: string[] = [];
  out.push(`### ${sceneHeading(scene)}${scene.lane === "side" ? " (곁가지)" : ""}`);
  const meta = sceneMeta(scene);
  if (meta) out.push(`(${meta})`);
  const twin = scene.sameAs ? story.scenes.get(scene.sameAs) : undefined;
  if (twin) {
    out.push(`(${twin.ref} 와 대사가 똑같다 — 생략. 고칠 때는 둘 다 고친다: 이 장면 줄은 ${scene.ref}.1~${scene.ref}.${scene.lines.length})`);
    return out.join("\n");
  }
  if (options.withSummary !== false) {
    const summary = sceneSummary(project, scene);
    out.push(`요약${summary.auto ? "(자동)" : ""}: ${summary.text}`);
  }
  renderNodes(story, scene.nodes, "", out);
  return out.join("\n");
}

export interface ScriptSelection {
  readonly chapterId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly sceneRefs?: readonly string[];
  readonly speaker?: string;
  readonly includeSide?: boolean;
}

/** 고른 장면들(이야기 순서). */
export function selectScenes(story: Story, selection: ScriptSelection): StoryScene[] {
  const wanted = selection.sceneRefs?.length ? new Set(selection.sceneRefs.map((ref) => ref.trim().toUpperCase())) : null;
  const chapters = selection.chapterId ? story.chapters.filter((chapter) => chapter.id === selection.chapterId) : story.chapters;
  const result: StoryScene[] = [];
  for (const chapter of chapters) {
    // 화자로 고르면 곁가지도 본다 — NPC(대장장이·여관 주인)는 대개 곁가지에만 나온다.
    const ids = [...chapter.mainIds, ...(selection.includeSide || wanted || selection.speaker ? chapter.sideIds : [])];
    for (const id of ids) {
      const scene = story.scenes.get(id);
      if (!scene) continue;
      if (wanted && !wanted.has(scene.ref)) continue;
      if (selection.speaker && !scene.speakers.some((name) => name === selection.speaker || name.includes(selection.speaker!))) continue;
      result.push(scene);
    }
  }
  if (!wanted && (selection.from || selection.to)) {
    const number = (ref: string | undefined): number | undefined => (ref ? Number(/\d+/u.exec(ref)?.[0]) : undefined);
    const from = number(selection.from);
    const to = number(selection.to);
    return result.filter((scene) => {
      if (scene.lane === "side") {
        // 곁가지는 닻(본줄 장면)이 범위 안일 때만.
        const anchor = scene.anchorId ? story.scenes.get(scene.anchorId) : undefined;
        const value = anchor ? number(anchor.ref)! : 0;
        return (from === undefined || value >= from) && (to === undefined || value <= to);
      }
      const value = number(scene.ref)!;
      return (from === undefined || value >= from) && (to === undefined || value <= to);
    });
  }
  return result;
}

export function storyCast(project: Project, story: Story): { speaker: string; lines: number; scenes: number; voice?: string }[] {
  const counts = new Map<string, { lines: number; scenes: Set<string> }>();
  for (const scene of story.scenes.values()) {
    for (const line of scene.lines) {
      if (!line.speaker) continue;
      const entry = counts.get(line.speaker) ?? { lines: 0, scenes: new Set<string>() };
      entry.lines += 1;
      entry.scenes.add(scene.id);
      counts.set(line.speaker, entry);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].lines - a[1].lines)
    .map(([speaker, entry]) => {
      const voice = speakerVoiceNote(project, speaker);
      return { speaker, lines: entry.lines, scenes: entry.scenes.size, ...(voice ? { voice } : {}) };
    });
}

export function renderOutlineText(project: Project, story: Story = buildStory(project), options: { readonly includeSide?: boolean; readonly chapterId?: string } = {}): string {
  const out: string[] = [];
  for (const chapter of story.chapters) {
    if (options.chapterId && chapter.id !== options.chapterId) continue;
    out.push(`# ${chapter.title} [${chapter.id}] — 본줄 ${chapter.mainIds.length}장면 · 곁가지 ${chapter.sideIds.length}장면`);
    for (const section of chapter.sections) {
      out.push(`## ${section.title}`);
      for (const id of section.sceneIds) {
        const scene = story.scenes.get(id)!;
        const summary = sceneSummary(project, scene);
        const side = chapter.sideIds.filter((sideId) => story.scenes.get(sideId)?.anchorId === id).length;
        const twin = scene.sameAs ? story.scenes.get(scene.sameAs)?.ref : undefined;
        const gate = scene.conditions.length ? ` [${scene.conditions.join(", ")}]` : "";
        out.push(`- ${scene.ref} ${scene.place} — ${scene.title} (${scene.trigger}${gate} · ${scene.lines.length}줄${side ? ` · 곁가지 ${side}` : ""})${twin ? `: ${twin} 와 같은 대사` : `: ${summary.text}${summary.auto ? " (자동)" : ""}`}`);
      }
    }
    if (options.includeSide) {
      out.push("## 곁가지");
      for (const id of chapter.sideIds) {
        const scene = story.scenes.get(id)!;
        const anchor = scene.anchorId ? `${story.scenes.get(scene.anchorId)?.ref} 뒤` : "처음부터";
        const twin = scene.sameAs ? story.scenes.get(scene.sameAs)?.ref : undefined;
        out.push(`- ${scene.ref} ${scene.place} — ${scene.title} (${scene.lines.length}줄 · ${anchor})${twin ? `: ${twin} 와 같은 대사` : `: ${sceneSummary(project, scene).text}`}`);
      }
    }
  }
  return out.join("\n");
}
