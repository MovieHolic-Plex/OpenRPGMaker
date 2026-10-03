# deprecated/ — 더 이상 쓰지 않는 그림 보관소

여기 있는 파일은 **앱이 싣지도 내보내지도 않는다**(`public/` 밖이라 dev 서버·빌드·웹 내보내기·PWA 캐시에 안 잡힌다).
지우지 않고 옮긴 것은 출처·이력 확인용이다. 다시 쓰려면 `public/` 아래 원래 경로로 되돌리고 참조를 다시 잇는다.
경로는 원래 위치를 그대로 따른다(`deprecated/public/...`).

## 2026-10-03 — 옛 전투 그림

사용자 결정: 전투는 RM2003식 도트 측면(retro2003)과 포켓몬식 둘뿐이다. 둘 다 쓰지 않는 옛 그림을 옮겼다.

| 옮긴 것 | 예전에 보이던 곳 | 지금은 |
|---|---|---|
| `generated/battle-skins/*-backdrop.png` 13장(은퇴 스킨 배경) | 은퇴 스킨, retro2003 기본 배경 id, 옛 저장본 | id 는 리졸버 별칭: 도트 풀밭 겹 배경 미리보기 / 포켓몬 배경은 Scarloxy 숲 |
| `generated/battle-reference-forest.png` | 전투 첫 프레임 CSS 바닥, 기본 적 그룹 배경 | 기본 배경 `battle-scenery-forest`, id 는 도트 숲 미리보기 별칭 |
| `generated/battle-skins/sprites/party-{warrior,mage}-{front,back}.png` | 걷기 칩 대응이 없는 배우의 retro2003 폴백 | `RETRO_FALLBACK_PARTY_BATTLERS`(도트 배틀러) |
| `generated/battle-skins/sprites/ally-creature-back.png`, `demo-battler-magenta.png` | 참조 없음 | — |
| `generated/battle-skins/sprites/reference-{cocoon-front,seed-back}.png` | 몬스터 고르기·조수 목록 | 목록에서 뺐고 id 는 도트 말벌·Scarloxy 뒷모습 별칭 |
| `easyrpg/monster/Hornet.png` | 숲 말벌 종족, 이슬마을 적 4종, 고르기·조수 목록 | 기본값·픽스처는 도트 몬스터로, id 는 도트 말벌 별칭 |
| `easyrpg/battle/{Blow,Sword1,Arrow}.png` | retro2003 일반 공격(anim_hit) | anim_hit/sword/arrow 는 번들 효과 시트, 불러오기 때 옛 기록 수리(`ensureBundledBattleAnimations`), retro2003 은 도트 효과(`retroPixelAnimations.ts`)로 바꿔 그림 |
| `generated/starter/generated-monster-manifest.json` | 참조 없음(이미 지운 몬스터 그림 목록) | — |

남긴 것: 384px 생성 효과(`generated/effects`, 포켓몬 전투가 씀), Scarloxy, EasyRPG 하늘 배경(오프닝·게임 오버에서 씀),
OGA 배경(맵 배경), 영웅 48px·고해상도 전투 시트(`starter/hero-0N-battle`, `starter/hires/` — 지금 전투에는 안 나오고 자료집 미리보기·테스트가 묶여 있어 다음 차례).
