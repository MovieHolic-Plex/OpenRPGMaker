# 라이선스 구조

저장소 루트의 네 문서가 정본이다. 이 쪽은 에이전트가 코드를 바꿀 때 지켜야 할 경계만 적는다.

| 대상 | 문서 | 요지 |
|---|---|---|
| 에디터·저장소 소스 | `LICENSE.md` (Sustainable Use License 1.0 + Additional Permissions) | 내부·개인·비상업 사용. 에디터 재판매·유료 배포·서비스화 금지 |
| 만든 게임·산출물 | `LICENSE.md` 「Your Games」「Ownership of Outputs」 | 상업 출시 자유, 산출물(AI 조수 결과 포함)은 사용자 소유 |
| 런타임 | `LICENSE-RUNTIME.md` (MIT) | **컴파일된** 플레이어 빌드 산출물만. 저장소의 원본 소스는 SUL 그대로 |
| 기본 그림·소리 | `ASSET-LICENSE.md` (OPRN 게임 사용) | 게임 안 자유, 소재 단독 재배포 금지. 스토어 `OPRN-GAME`과 같은 문서 |
| 이름·로고 | `TRADEMARKS.md` | 어떤 라이선스에도 안 들어간다 |
| 기여 | `CLA.md` | 재라이선스·승계 가능한 허락. 엑시트 실사 대비 |
| UGC 약관 | `docs/legal/ugc-terms-draft.md` | 초안. 스토어 약관 보강 조항 |

## 코드 경계 (에이전트가 지킬 것)

- **런타임 MIT 고지는 빌드가 붙인다.** `scripts/lib/runtimeLicenseBanner.mjs`가 `vite.player.config.ts`·`vite.standalone.config.ts`
  산출 JS 청크마다 `LICENSE-RUNTIME.md`의 MIT 전문을 `/*! … */`로 붙인다(압축 뒤 `generateBundle`). 문구를 플러그인에 다시 적지 말 것.
  복사만 하는 제3자 파일(`phaser.min`)은 청크가 아니라 붙지 않는다 — 그 고지는 원 라이선스 몫이다.
- **내보낸 게임에 실리는 것은 전부 MIT로 공개되는 셈이다.** 플레이어 import 그래프(`src/player/exportEntry.ts`에서 시작)에
  에디터·하네스·프롬프트 코드를 끌어들이지 말 것. 실측(2026-10-07): `src/project/gameDesignBrief.ts`가
  `harnesses/_core/registry`를 import해서 `interior-props` 러너(약 243KB)가 내보낸 게임 청크로 나간다 — 미수정.
  그래프 확인: esbuild `metafile`로 `exportEntry.ts`를 묶어 `src/editor|harnesses` 입력이 있는지 본다.
- **제3자 자료**는 `public/assets/ATTRIBUTION.md`에 적힌 것만 원 라이선스로 남는다. 새로 들이지 않는다(2026-10-07 정리 결정).
- 저작권자 이름 자리 `[LICENSOR]`는 법인명이 정해지면 `LICENSE.md`·`LICENSE-RUNTIME.md`·`TRADEMARKS.md`·`CLA.md`에서 함께 바꾼다.
