import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { EventPageGraphic } from "@/project/types";

export function iceMonsterGraphic(textureKey: string, characterIndex: number): EventPageGraphic {
  return {
    sprite: { type: "bundled", id: textureKey },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
  };
}
