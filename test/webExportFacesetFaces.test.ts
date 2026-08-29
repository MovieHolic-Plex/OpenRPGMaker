// 내보낸 게임에 얼굴 낱장 PNG 가 실리는지.
//
// 왜 이 테스트가 필요한가: vite.player.config.ts 는 publicDir:false 라 플레이어 JS 번들이
// public/ 를 복사하지 않는다. 얼굴은 번들 자산이 아니라 public 아래 낱장 파일
// (assets/easyrpg/faceset/People1/07.png)이므로, 내보내기가 참조를 따라 zip 에 담아 주지
// 않으면 내보낸 게임에서 대사창 얼굴이 통째로 깨진다.
//
// 실제 경로는 collectWebExportAssets 가 프로젝트 문자열 → resolveAssetResourceUrl →
// localPublicPath 로 훑어 담는다. 그 연결이 낱장 얼굴 id 에도 걸리는지 못박는다.
import { describe, expect, it } from "vitest";
import { collectWebExportAssets, prepareWebExport } from "@/project/webExport";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

function projectWithFaceCommand(faceId: string): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing start map");
  // 빈 프로젝트의 시작 맵에는 이벤트가 없다 — 얼굴을 말하는 NPC 를 하나 세운다.
  map.events.push({
    id: "ev_face_export",
    x: 3,
    y: 3,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "p1",
        name: "얼굴 NPC",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          { kind: "changeFace", resourceId: faceId, position: "left", flipHorizontally: false },
          { kind: "text", speaker: "얼굴", body: "안녕" },
        ],
      },
    ],
  });
  return project;
}

function zipPathsFor(faceId: string): readonly string[] {
  const project = prepareWebExport(projectWithFaceCommand(faceId)).project;
  return collectWebExportAssets(project).map((asset) => asset.zipPath);
}

describe("내보내기의 얼굴 낱장", () => {
  it("changeFace 가 가리키는 낱장 PNG 를 zip 에 담는다", () => {
    const paths = zipPathsFor("easyrpg-faceset-people1-07");
    expect(paths).toContain("assets/easyrpg/faceset/People1/07.png");
  });

  it("생성 얼굴 낱장도 담는다", () => {
    const paths = zipPathsFor("generated-actor-hero-01-face-03");
    expect(paths).toContain("assets/generated/starter/hero-01-face/03.png");
  });

  it("주인공 기본 얼굴은 아무것도 안 해도 담긴다", () => {
    // 액터 기본값이 이미 낱장 id 다(easyrpg-faceset-actor1-00). 데이터베이스만 있어도
    // 얼굴이 나가야 상태 메뉴·전투 초상이 빈칸이 되지 않는다.
    const project = prepareWebExport(createBlankProject()).project;
    const paths = collectWebExportAssets(project).map((asset) => asset.zipPath);
    expect(paths).toContain("assets/easyrpg/faceset/Actor1/00.png");
  });

  it("등록된 얼굴은 대사에 안 써도 함께 나간다(현재 동작)", () => {
    // collectProjectStrings 는 resourceProfiles 도 훑는데, 번들 얼굴 112장이 전부
    // 프로필로 등록돼 있어 참조로 잡힌다. 결과적으로 내보내기는 얼굴을 통째로 싣는다.
    // 용량은 더 쓰지만 저작 중 고른 얼굴이 빠지는 사고는 나지 않는다.
    // 실측으로 확인한 현재 계약이다 — 좁히려면 프로필 참조를 제외해야 하고, 그건
    // "등록만 하고 아직 안 쓴 얼굴"을 떨어뜨릴 위험이 있어 별도 판단이 필요하다.
    const paths = zipPathsFor("easyrpg-faceset-people1-07");
    expect(paths).toContain("assets/easyrpg/faceset/People1/08.png");
  });

  it("분할 전 4×4 시트는 담지 않는다", () => {
    const paths = zipPathsFor("easyrpg-faceset-people1-07");
    expect(paths).not.toContain("assets/easyrpg/faceset/People1.png");
  });
});
