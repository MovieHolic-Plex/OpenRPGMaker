import type { Project } from "../../types";

// Runtime still imports/clones the JSON. Do not infer thousands of heterogeneous rows.
declare const project: Project;
export default project;
