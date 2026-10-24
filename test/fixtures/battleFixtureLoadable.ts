import { deserialize } from "@/project/io";
import type { Project } from "@/project/types";
import battleFixture from "./projects/battle-v3.json";

/**
 * battle-v3 픽스처를 읽는다. 2026-10-07 저작권 정리로 EasyRPG 소리·그림이 번들에서 빠져 픽스처의 easyrpg-* 참조가
 * 참조 검사(ProjectFormatError)에 걸린다 — 그 참조만 비우고 읽는다(전투 규칙 시험은 그림·소리를 보지 않는다).
 */
export function loadBattleFixture(): Project {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, inner] of Object.entries(value)) {
        if (typeof inner === "string" && inner.startsWith("easyrpg-")) continue;
        out[key] = strip(inner);
      }
      return out;
    }
    return value;
  };
  return deserialize(JSON.stringify(strip(battleFixture)));
}
