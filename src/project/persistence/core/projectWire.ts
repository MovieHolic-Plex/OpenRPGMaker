import { serialize } from "../../io";
import type { Project } from "../../types";
import { sha256HexText } from "@/util/sha256";

/** 저장 와이어: 직렬화 텍스트, 그 JSON, 그 텍스트의 sha256. 세 값은 같은 바이트에서 나온다. */
export type ProjectWire = {
  readonly json: unknown;
  readonly serialized: string;
  readonly sha256: string;
};

export async function projectWire(project: Project): Promise<ProjectWire> {
  const serialized = serialize(project);
  return {
    serialized,
    json: JSON.parse(serialized) as unknown,
    sha256: await sha256HexText(serialized),
  };
}
