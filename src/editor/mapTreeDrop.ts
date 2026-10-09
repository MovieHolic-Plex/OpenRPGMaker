export type MapTreeDropRelation = "before" | "after" | "child";

export function mapTreeDropRelation(
  offsetY: number,
  height: number,
  isRoot: boolean,
): MapTreeDropRelation {
  if (isRoot || height <= 0) return "child";
  if (offsetY < height / 3) return "before";
  if (offsetY > (height * 2) / 3) return "after";
  return "child";
}
