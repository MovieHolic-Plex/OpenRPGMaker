import { projectJsonWithoutEventDrafts } from "@/project/eventDrafts";
import type { Project } from "@/project/types";

/** Preserve the automation mirror without cloning/serializing the entire project
 * whenever only the selected map, camera or editing tool changes. */
export class ProjectExportMirror {
  private cached: {
    readonly project: Project;
    readonly lineage: number;
    readonly generation: number;
    readonly json: string;
  } | null = null;

  serialize(
    project: Project,
    version: { readonly lineage: number; readonly generation: number },
    editor: object,
    history: object,
  ): string {
    if (this.cached?.project !== project || this.cached.lineage !== version.lineage
      || this.cached.generation !== version.generation) {
      // 복제 없이 같은 JSON 을 만든다 — 이 경로는 곧바로 stringify 만 하므로 깊은 복제가
      // 순수 낭비였다(칠하기 드래그 중 이 미러 비용의 62%).
      this.cached = { project, ...version, json: projectJsonWithoutEventDrafts(project) };
    }
    return `{"project":${this.cached.json},"editor":${JSON.stringify(editor)},"history":${JSON.stringify(history)}}`;
  }

  clear(): void {
    this.cached = null;
  }
}
