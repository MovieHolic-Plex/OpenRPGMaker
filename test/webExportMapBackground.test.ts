// 내보낸 게임에서 맵 배경(파노라마) PNG 를 실제로 찾을 수 있는지.
//
// 왜 이 테스트가 필요한가: 맵 배경은 번들 자산이 아니라 public 아래 낱장 파일
// (assets/easyrpg/backdrop/Sky1.png)이다. vite.player.config.ts 는 publicDir:false 라 플레이어
// 번들이 public/ 를 복사하지 않으므로, 내보내기 자산 목록에 그 경로가 없으면 내보낸 게임에서
// 하늘만 404 로 사라진다 — 런타임은 조용히 아무것도 그리지 않아 화면만 보고는 알 수 없다.
//
// 실측(2026-09-14): 빈 프로젝트도 배경 프로필 13개를 등록하므로(`resourceProfiles`) 배경 PNG 는
// **맵 배경을 저작하지 않아도** 내보내기에 들어간다(총 688개 자산). 그래서 «저작하면 담긴다» 는
// 단정은 아무것도 증명하지 못한다. 여기서 못박는 것은 **런타임이 만드는 URL 과 내보낸 경로가
// 같은가**, 그리고 스탠드얼론 인라인 표가 그 경로를 키로 받는가다.
import { describe, expect, it } from "vitest";
import { registerInlineAssets } from "@/assets/inlineAssetStore";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { collectWebExportAssets } from "@/project/webExportAssets";
import { createBlankProject } from "@/project/defaults";

const BACKDROP_ID = "easyrpg-backdrop-sky1";
const BACKDROP_PATH = "assets/easyrpg/backdrop/Sky1.png";

describe("내보내기의 맵 배경", () => {
  it("런타임이 배경 id 로 만드는 경로가 내보내기 자산 목록에 있다", () => {
    const url = resolveAssetResourceUrl(BACKDROP_ID, { project: createBlankProject() });
    expect(url).toBe(`/${BACKDROP_PATH}`);
    const paths = collectWebExportAssets(createBlankProject()).map((asset) => asset.zipPath);
    expect(paths).toContain(BACKDROP_PATH);
  });

  it("런타임 URL 이 스탠드얼론 인라인 표의 키(= zip 경로)로 치환된다", () => {
    // 스탠드얼론 HTML 은 zip 경로를 키로 data URL 을 심는다. 런타임이 만드는 URL 이 그 키로
    // 해석되지 않으면 실행형 HTML 에서만 배경이 사라진다(출하 경로 전용 결함).
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
    registerInlineAssets({ [BACKDROP_PATH]: dataUrl });
    try {
      expect(resolveAssetResourceUrl(BACKDROP_ID, { project: createBlankProject() })).toBe(dataUrl);
    } finally {
      registerInlineAssets(null);
    }
  });
});
