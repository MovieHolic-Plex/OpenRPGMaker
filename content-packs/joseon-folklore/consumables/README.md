# 조선 설화 소비품·재료 — 전체 20+12

소비품 20종, 재료 12종, 원본 투명 32×32 PNG 32장, 전용 아이템 기술 4개.
`data.json.items`와 `data.json.skills`를 실제 `normalizeItemRecord`/`normalizeSkillRecord`로 정상화한다.
아이템 기술 ID는 `skill_jf_item_smoke_powder`, `skill_jf_item_fire_charm`, `skill_jf_item_ice_charm`, `skill_jf_item_thunder_charm`이다.
다른 담당의 직업24+적12 예약 기술과 충돌하지 않는다. 이 role은 상태·속성을 정의하지 않는다.

## 소비품

모든 회복은 최대치 제한, 살아 있는 아군 1명 대상이다. 환생부만 전투불능 아군 대상이다.
가격 단위 '전'은 기획 표기이며 실제 게임 terms 변경은 감독자 담당이다.

| 이름 | slug | 가격 | 실제 효과 | 사용 |
|---|---|---:|---|---|
| 쑥단 | `mugwort-pill` | 16 | HP +50 | 필드·전투 |
| 산삼탕 | `ginseng-tea` | 32 | 기력 +16 | 필드·전투 |
| 정화부 | `purification-charm` | 18 | 해제 state_poison | 필드·전투 |
| 환생부 | `revival-charm` | 96 | 전투불능 HP=최대HP 25%(내림)+1 | 필드 전용 |
| 주먹밥 | `rice-ball` | 12 | HP +35 | 필드 전용 |
| 시루떡 | `rice-cake` | 30 | HP +80 | 필드·전투 |
| 꿀약과 | `honey-cake` | 36 | HP +35 / 기력 +8 | 필드·전투 |
| 약초탕 | `herbal-decoction` | 56 | HP +140 | 필드·전투 |
| 홍삼 | `red-ginseng` | 84 | 기력 +40 | 필드·전투 |
| 샘물 | `spring-water` | 25 | 기력 +12 | 필드 전용 |
| 옥수 | `jade-water` | 72 | 기력 +25%(내림)+8 | 필드·전투 |
| 해독초 | `antidote` | 24 | HP +15 / 해제 state_poison | 필드·전투 |
| 청심단 | `clear-mind-pill` | 28 | 해제 state_sleep, state_silence | 필드·전투 |
| 온기차 | `warming-tea` | 26 | HP +40 / 해제 state_paralysis | 필드·전투 |
| 청량차 | `cooling-tea` | 36 | 기력 +12 / 해제 state_agility_down | 필드·전투 |
| 연막가루 | `smoke-powder` | 24 | 민첩 하락 기본100%(상태 저항), 배율0.5 | 전투 전용 |
| 화염부 | `fire-charm` | 32 | 기본 HP 피해 32 (상성·상태 보정) | 전투 전용 |
| 빙결부 | `ice-charm` | 32 | 기본 HP 피해 30 (상성·상태 보정) | 전투 전용 |
| 뇌전부 | `thunder-charm` | 36 | 기본 HP 피해 34 (상성·상태 보정) | 전투 전용 |
| 생기탕 | `vitality-tonic` | 140 | HP +25%(내림)+50 / 기력 +20%(내림)+8 | 필드·전투 |

공격 부적 3종은 기본 피해가 화염32·빙결30·뇌전34이고 MP 비용0, 분산0, 치명타0, 기본 명중100이다.
실제 피해는 속성·상태·엔진 보정에 따라 달라진다. 불·얼음·번개는 skills 담당의 예약 `element_jf_*`를 참조한다.
연막가루는 `state_agility_down`만 부여한다. 민첩 계산 배율0.5가 실제 효과이며 암흑·명중 저하·확정 도주는 구현하지 않는다.
정화부는 독만 해제하며 맹독을 해제하지 않는다. 해독초는 독 해제와 HP15 회복을 함께 제공한다.
환생부는 현재 **약품**의 필드 메뉴 부활만 제공한다. `itemAllowsBattle`는 `onlyEffectiveOnDeadActors` 약품을 거절한다.
공유 steering의 도사 healing+state_death 전투 부활 기술은 다른 소유권·다른 경로이며 이 약품에 연결하지 않는다.
환생부는 HP 외 MP·다른 상태를 보존한다. 자동부활·전멸구제·전투중 약품 부활은 없다.

`consumable=true` + `consumptionLimit=noLimit`는 성공한 메뉴 사용/승인된 전투 행동마다 한 개 소비한다.
메뉴의 효과 없는 사용은 거절하고 수량을 보존한다. 전투에서는 실패·면역·이미 가득 찬 대상에도 승인된 행동이면 소비할 수 있다.

## 순수 재료

모든 재료는 normalGoods/scope:none/occasion:never/consumable:false이며 필드·전투 직접 사용 불가다.
판매가는 기본 반값 기준이고 프로젝트 판매표·흥정 등은 통합 시 달라질 수 있다.
드롭·획득은 아래와 `design.json`의 **미설치 제안**이다. 제작·교환 효과도 여기서 구현하지 않았다.

| 이름 | slug | 기본 판매가 | 획득 제안 |
|---|---|---:|---|
| 들쥐 꼬리 | `rat-tail` | 2 | `enemy_jf_field_rat` 45% 제안 |
| 멧돼지 어금니 | `boar-tusk` | 6 | `enemy_jf_wild_boar` 35% 제안 |
| 박쥐 날개 | `bat-wing` | 4 | `enemy_jf_cave_bat` 40% 제안 |
| 짚 매듭 | `straw-knot` | 3 | `enemy_jf_straw_dokkaebi` 45% 제안 |
| 귀화재 | `ghost-ash` | 5 | `enemy_jf_lantern_wisp` 35% 제안 |
| 깨진 옥 | `broken-jade` | 8 | `enemy_jf_maiden_ghost` 30% 제안 |
| 여우 털 | `fox-fur` | 10 | `enemy_jf_fox_spirit` 30% 제안 |
| 돌 심지 | `stone-core` | 12 | `enemy_jf_stone_dokkaebi` 30% 제안 |
| 대나무 심 | `bamboo-heart` | 9 | `enemy_jf_bamboo_specter` 35% 제안 |
| 녹슨 패 | `rusted-token` | 7 | `enemy_jf_masked_bandit` 40% 제안 |
| 청동 조각 | `bronze-shard` | 16 | `enemy_jf_bronze_dokkaebi` 100% 제안 |
| 호랑이 발톱 | `tiger-claw` | 20 | `enemy_jf_mountain_tiger` 100% 제안 |

## 저작 출처와 재생성

저자: GPT 6.1 sol high / consumables 작업자, 2026-10-04.
그림 원본은 이 폴더 `assets/<slug>.png`, 원본 코드는 `draw_icons.py`(파일럿6)와 `extra_icons.py`(신규26)다.
정수 좌표·한정 팔레트·native pixel로 새로 저작했다. API 생성·외부 그림 샘플링·기존 그림 재색칠 없음.
기존 `assets/item-catalog/style-reference.png`에서 외곽선과 좌상단 조명만 참고했고 도형/바이트를 복제하지 않았다.
외부 저작물 재배포 없음; 기존 저장소의 다른 그림 라이선스를 이 원저작에 전가하지 않는다.
파일럿 PNG6장 SHA는 그대로 보존했다. 전체32장 SHA가 서로 다르고 alpha0/255, 각5~12색이다.
`art-manifest.json`에 코드·PNG SHA, 경계·색수·실제 원본과 계약상 배포 경로를 저장했다.

저장소 루트, Python3+Pillow 및 현재 node_modules 사용:

```bash
python3 content-packs/joseon-folklore/consumables/author_data.py
python3 content-packs/joseon-folklore/consumables/draw_icons.py
node content-packs/joseon-folklore/consumables/run-smoke.mjs
```

데이터 재생성은 ready를 false로 돌린다. PNG 재생성은 원본을 저장·재디코드하고 검토 시트4장을 만든다.
원본32장과 `review/full-sheet-1~4.png`를 직접 열어 검토한 뒤 `review/visual-review.json`의 해시/관찰을 다시 확인한다.
저자 관찰은 사용자 승인이 아니다(`userApproval:null`). `review/pilot-sheet.png`는 해시가 보존된 파일럿6의 과거 검토 시트다.
스모크는 첫 인자로 읽기전용 prototype JSON, 둘째 인자로 skills 담당의 실제 data.json 경로를 받는다.
기본 경로는 이 작업의 지정 prototype 및 jf-skills 워크트리다. 참조 파일을 읽어 메모리 fixture에만 합친다.
Vite 앱 설정·env·미들웨어·저장 브리지 없이 단일 스크립트를 실행하며 listen하지 않는다. 캐시는 /tmp다.

개별 스모크 161개 확인: 아이템32/기술4 정규화·JSON 재로드·ID/참조/그림/디자인,
실제 메뉴85경우, 실제 RM식 gauge 전투39경우, 환생부 약품 제한1경우.
전투39경우에는 전체32종과 공격3종 반감/면역6경우, 연막 상태면역1경우가 포함된다.
메뉴는 실제효과·최대치·생사대상·소지0·해제할 상태없음·재료/공격부 사용불가를 검사한다.
`review/smoke.json`에 실제 전후 수치와 입력·실행 코드·읽기 전용 참조 SHA를 저장했다.
전체 gates/vitest/npm test/typecheck/stash/push·DB·공용 코드 변경은 없다.

모든 파일과 직접 검토/스모크 근거가 저장된 뒤 마지막으로:

```bash
python3 content-packs/joseon-folklore/consumables/finalize.py
```

이 명령은 기존 근거의 SHA를 대조하고 `status.json`을 마지막 파일 쓰기로 `phase:full, ready:true` 저장한다.
ready는 감독자가 검토 가능한 role 산출물 상태다. 사용자 그림 승인·실제게임 설치·정본 저장 완료라는 뜻이 아니다.

## 감독자 인계

`art-manifest.json`의 resourceId=`jf-icon-<slug>`, path=`assets/joseon-folklore/consumables/<slug>.png`.
public 리소스 등록·게임 데이터 합치기·획득/상점/드롭 배선·게임 화면/오프라인 QA·정본 저장은 감독자 담당이다.
자세한 완료 근거와 한계는 `full-report.md`를 본다. 자기 role 밖 파일·live SQLite·Supabase는 수정하지 않았다.
