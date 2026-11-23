// 번들 칩셋 킷의 표시 이름 정리 — 영문·로마자 조각 이름(「조선 기와 seodang 6×6」, 「aged-dark-boards · plain-a」)을 한국어로.
// 조수는 이름·태그로 기물을 찾는다(object-search 레인, ~/claude-viz/object-search.html). 생성기가 다시 구워도 남도록
// 번들 정의 JSON 을 읽는 입구(bundledJson.ts)에서 한 번 바꾼다. 킷 id·그림은 그대로이고, 이름이 표의 옛 이름일 때만 바꾼다.
import table from "@/assets/kitDisplayNames.json" with { type: "json" };

type Renames = Readonly<Record<string, readonly [string, string]>>;
const TILESETS = (table as unknown as { tilesets: Readonly<Record<string, Renames>> }).tilesets;

export function applyKitDisplayNames(definition: unknown): void {
  const tileset = definition as { id?: unknown; structureKits?: { id: string; name?: string }[] } | null;
  const renames = typeof tileset?.id === "string" ? TILESETS[tileset.id] : undefined;
  if (!renames || !Array.isArray(tileset!.structureKits)) return;
  for (const kit of tileset!.structureKits) {
    const entry = renames[kit.id];
    if (entry && kit.name === entry[0]) kit.name = entry[1];
  }
}

export function kitDisplayNameTable(): Readonly<Record<string, Renames>> {
  return TILESETS;
}
