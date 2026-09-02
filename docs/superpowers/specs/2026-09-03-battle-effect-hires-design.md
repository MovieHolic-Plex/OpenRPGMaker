# 전투 이펙트 고해상도 개편 — 설계 (2026-09-03)

## 문제

전투 이펙트(`generated-battle-anim-*` 34종)가 몬스터 그림과 해상도가 맞지 않아 "개판"으로 보인다.
실측(`scripts/qa/probe-battle-anim-frames.mjs --label=before`, 기본 스킨 rm2003, 무대 배율 1.5):

| 대상 | 원본 px | 화면 CSS px | 밀도(원본 px / CSS px) |
|---|---|---|---|
| 몬스터(`monster-slime-01.png`) | 384 | 240 | **1.60** |
| 이펙트 시트 셀 | 96 (실제 저작 격자 **48**, 2배 복제) | 288 | 0.33 (**실효 0.17**) |

이펙트 한 픽셀이 화면에서 4~6 CSS px 굵기로 보이고, 몬스터는 부드러운 고해상도 그림이다.
밀도 차 약 **10배**. 게다가 이펙트 자체가 `disc`/`streak` 몇 개로 그린 단순 도형(불꽃 = 동심원,
번개 = 보라색 지그재그)이라 형태도 조악하다. 렌더러는 `image-rendering: pixelated` 로 이 굵기를
그대로 드러낸다.

원인은 세 겹이다.
1. **생성기**가 48×48 논리 격자에 그려 2배 최근접 확대(96×96)한다(`scripts/lib/effectSheet/canvas.mjs`).
2. **런타임**이 모든 시트를 320 시대 자산으로 간주해 `BATTLE_ASSET_PIXEL_SCALE`(2)를 곱한다
   (`battleAnimationDom.animationCell`). 시트 해상도를 표현할 필드가 스키마에 없다.
3. 픽셀아트 전제의 `image-rendering: pixelated` 가 셀에 무조건 걸린다.

## 목표

- 이펙트 밀도를 몬스터와 같은 급으로: **프레임 384×384 px**(몬스터 원본과 같은 해상도)을 무대에서
  192 논리 px 로 그린다 → 밀도 2.0(몬스터 1.92). 지금까지의 화면 크기(192 논리 px)는 유지한다.
- 부드러운 안티에일리어싱 렌더(픽셀 복제 없음). 몬스터가 부드러운 셰이딩이라 이펙트도 같은 언어를 쓴다.
- 34종 전부를 **해상도 독립 페인터**로 다시 그린다. 같은 글로우·파티클 어휘를 공유해 시각 통일.
- 프레임 수(8/10/12)·75ms 간격·효과음/플래시/흔들림 타이밍·리소스 id·DB id 는 그대로 — 저작된
  스킬/아이템 참조가 하나도 깨지지 않는다.
- 레거시 RM 시트(EasyRPG RTP, Scarloxy 4프레임 96px)는 지금처럼 픽셀아트로 2배 표시된다.

## 비목표

- 셀 블렌드 모드(가산 합성). `.battle-animation-layer` 가 `z-index` 로 격리된 스태킹 컨텍스트라
  `mix-blend-mode` 가 뒤의 배틀러와 섞이지 않는다. 광량은 아트에 굽는다(밝은 코어 + 알파 감쇠).
- 배틀러(몬스터/영웅) 그림 교체. 몬스터는 이미 384px 고해상도다.
- 카탈로그 항목 추가/삭제.

## 설계

### 1. 스키마 — `BattleAnimationSheet.assetScale`

```ts
interface BattleAnimationSheet {
  frameWidth: number; frameHeight: number; columns: number;
  /** 시트 1px 이 전투 무대(640×480 논리) 에서 차지하는 논리 px. 없으면 2(320 시대 RM 자산). */
  assetScale?: number;
}
```

- 정규화(`normalizeBattleAnimationRecord`): 기본 2, 범위 0.125~8. 저장된 레코드는 필드가 없어도
  지금과 동일하게 풀린다 → 마이그레이션 없음.
- 파생값 두 개를 `battleAnimationPlayback.ts` 에 둔다(순수 함수, 테스트 대상):
  - `battleAnimationSheetAssetScale(sheet)` → 논리 px 환산 계수(기본 `BATTLE_ASSET_PIXEL_SCALE`).
  - `battleAnimationSheetRmScale(sheet)` = assetScale / 2 → 320 시대 RM px 환산(레거시 1, 신규 0.25).
    편집기 미리보기·맵 `showAnimation` 은 RM px 좌표계라 이 값을 쓴다.
  - `battleAnimationSheetRendering(sheet)` → `"pixelated"`(assetScale ≥ 1) | `"smooth"`.
- **셀 오프셋(`cell.x/y`)은 계속 RM px** 다. 시트 해상도와 무관하게 `BATTLE_ASSET_PIXEL_SCALE` 로 환산한다.
  시트 배율은 **프레임 비트맵 크기**에만 곱한다.

### 2. 런타임 렌더러

- `battleAnimationDom.animationCell`: 캔버스 CSS 크기 = `frameWidth × assetScale`, `data-rendering` 을 심는다.
- `04-anim-damage-layers.css`: `.battle-animation-cell[data-rendering="smooth"] { image-rendering: auto; }`.
- 크로마키(`applyAutoTransparencyKey`)는 알파 PNG 에서 no-op 이라 그대로 둔다.
- 편집기 미리보기 3곳(`databaseAnimationPreview`, `databaseSkillAnimationStage`,
  `eventEditor/showAnimationPlayback`)과 맵 `playSceneMapAnimations` 는 프레임 크기·배경 크기·
  스프라이트 스케일에 `RmScale` 을 곱한다. 레거시는 1 이라 픽셀 하나도 달라지지 않는다.

### 3. 생성기

- 좌표계: **디자인 단위 = 전투 논리 px**. 프레임 192×192 단위, 중심 96. 래스터 해상도는 카탈로그
  `sheet.frameWidth / 192` 배(384 → 2 px/단위). 페인터는 화면에 보이는 크기로 생각하고 그린다.
- `raster.mjs`: float RGBA 누적 버퍼 + 부호 거리(SDF) 기반 AA 프리미티브. 모든 프리미티브는
  자기 경계 상자만 순회한다(비용 ∝ 그린 면적). over 합성과 add(가산) 합성 두 모드.
  프리미티브: `disc`(soft 감쇠), `ring`, `arc`(초승달, 끝 테이퍼), `capsule`(줄기/줄무늬, 양끝 테이퍼),
  `polyline`(번개), `polygon`(파편), `glow`(가우시안 광), `sparkle`(4점 별), `blob`(각도 노이즈로
  가장자리를 흔든 원 — 불꽃·연기·안개), `rays`(방사선).
- `recipes.mjs`: 이펙트가 조합하는 상위 어휘 — `burst`(코어+링+파편), `shockRing`, `shards`,
  `bolt`, `column`, `mist`, `orbit`, `beam`, `particles`, `slashArc`, `aura`, `sigil`.
- `effects/*.mjs`: 34 페인터. 시그니처는 기존과 같다 `painter(frame, progress, rng)`. 결정성
  규약도 같다(slug 시드 PRNG, 프레임마다 같은 시드로 재생성).
- `canvas.mjs` 와 구 페인터 4파일은 삭제한다(죽은 코드).
- 카탈로그: `sheet: { frameWidth: 384, frameHeight: 384, frameDurationMs: 75, assetScale: 0.5 }`.
- `generatedEffectSheet(seed)` 가 `assetScale` 을 레코드 시트에 싣는다.
- 예산: 34종 렌더 30초 이내, PNG 총량 6MB 이내(현재 0.2MB). 넘으면 프레임 크기를 288 로 내린다.

### 4. 검증

- `test/generatedEffectSheets.test.ts`: 384×384·assetScale 0.5·프레임 수/지속시간/효과음 타이밍 불변·
  바이트 재현성 유지. 추가: 프레임 경계 4px 안쪽은 투명(잘림 없음).
- 새 단위 테스트: 정규화 기본값/범위, 파생 함수 3개, `animationCell` 크기·`data-rendering`,
  미리보기·맵 배율(레거시 1 / 신규 0.25).
- 시각 증거: `probe-battle-anim-frames.mjs --label=after` 로 같은 6종을 같은 장면에서 찍고
  `verify-shots/battle-anim-overhaul/` 에 before/after 병치 + 34종 카탈로그 시트.
- 게이트: `npm run typecheck:app`, 관련 vitest, `npm run gates`(새 실패 0).

## 결정 기록

- 384 vs 192: 192 는 무대 배율 1 에서만 1:1 이고 1.5~2 배율(실제 플레이 1080p)에서 다시 흐려진다.
  몬스터가 384 이므로 같은 값을 택했다. PNG 예산이 넘치면 288 로 타협한다.
- 부드러운 렌더 vs 고밀도 픽셀아트: 몬스터·배경이 부드러운 그림이라 픽셀아트 이펙트는 밀도가
  맞아도 질감이 어긋난다. 픽셀아트 배틀러(48px 영웅 시트)는 기본 스킨에서 필드에 서지 않는다.
- 스키마 필드 vs resourceId 특례: 프레임 간격은 이미 resourceId 특례로 처리돼 있지만, 해상도는
  저작 시트에도 필요한 정보라 스키마에 둔다. 기본값이 있어 기존 저장물은 그대로 읽힌다.
