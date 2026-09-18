import { projectWithoutEventDrafts } from "@/project/eventDrafts";
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
      this.cached = { project, ...version, json: JSON.stringify(projectWithoutEventDrafts(project)) };
    }
    return `{"project":${this.cached.json},"editor":${JSON.stringify(editor)},"history":${JSON.stringify(history)}}`;
  }

  clear(): void {
    this.cached = null;
  }
}
