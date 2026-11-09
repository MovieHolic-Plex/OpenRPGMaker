import { projectDefaultLeaks } from "@/project/defaultLeaks";
import type { Project } from "@/project/types";
import type { Finding } from "./types";

export function checkDefaultLeak(project: Project): Finding[] {
  return projectDefaultLeaks(project).map((leak): Finding => ({
    severity: "warning",
    code: `default-leak-${leak.id}`,
    message: `[${leak.field}] ${leak.message}`,
  }));
}
