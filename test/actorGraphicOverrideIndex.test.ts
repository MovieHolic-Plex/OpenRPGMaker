// 주인공 모습 변경이 시트 안 칸(characterIndex)을 지킨다 — 2026-09-24 꿈 세계 도그푸딩(효과로 외형 바꾸기).
import { describe, expect, it } from "vitest";
import { formatActorGraphicOverride, parseActorGraphicOverride } from "@/project/actorGraphicOverride";
import { resolvePlayerSpriteResource } from "@/player/playerSpriteResources";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";

describe("actor graphic override", () => {
  it("검색 id·#칸·맨 id 를 모두 읽는다", () => {
    expect(parseActorGraphicOverride("charset:tex_easyrpg_charset_people1:3")).toEqual({ resourceId: "tex_easyrpg_charset_people1", characterIndex: 3 });
    expect(parseActorGraphicOverride("easyrpg-charset-actor2#5")).toEqual({ resourceId: "easyrpg-charset-actor2", characterIndex: 5 });
    expect(parseActorGraphicOverride("easyrpg-charset-actor2")).toEqual({ resourceId: "easyrpg-charset-actor2", characterIndex: 0 });
    expect(formatActorGraphicOverride("x", 0)).toBe("x");
    expect(formatActorGraphicOverride("x", 4)).toBe("x#4");
  });

  it("필드 스프라이트가 오버라이드의 칸을 쓴다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const actorId = session.partyActorIds[0]!;
    session.actorCharacterResourceIds = { [actorId]: "tex_easyrpg_charset_people1#3" };
    const sprite = resolvePlayerSpriteResource(project, session);
    expect(sprite.characterIndex).toBe(3);
    session.actorCharacterResourceIds = { [actorId]: "tex_easyrpg_charset_people1" };
    expect(resolvePlayerSpriteResource(project, session).characterIndex).toBe(0);
  });
});
