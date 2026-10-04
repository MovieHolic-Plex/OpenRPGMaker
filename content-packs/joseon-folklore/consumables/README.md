# 조선 설화 소비품 — 첫 샘플

소비품 4종(쑥단·산삼탕·정화부·환생부), 재료 2종(멧돼지 어금니·짚 매듭).
전체 목표 20+12는 후속 지시 이후다. 현재 `data.json`의 `items`는 실제 엔진 입력이며 `skills`는 빈 배열이다.
`normalizeItemRecord`로 정상화하고 약품 고유 회복·상태 해제 경로를 사용한다.

| 이름 | 가격 | 실제 효과 | 사용 |
|---|---:|---|---|
| 쑥단 | 16 | 생존 아군 1명 HP+50 | 필드·전투 |
| 산삼탕 | 32 | 생존 아군 1명 기력(MP)+16 | 필드·전투 |
| 정화부 | 18 | 생존 아군 1명 `state_poison` 제거 | 필드·전투 |
| 환생부 | 96 | 전투불능 아군 1명 HP=`floor(maxHp×0.25)+1`, 최대치 제한 | 필드 메뉴 |
| 멧돼지 어금니 | 12 | 직접 사용 없음; 기본 판매 6 | 판매용 재료 |
| 짚 매듭 | 6 | 직접 사용 없음; 기본 판매 3 | 판매용 재료 |

가격·획득 제안·아이콘 개성·효과·엔진 제한은 `design.json`에 적었다.
상점/보상/드롭은 제안이며 구현 완료가 아니다. 정화부는 맹독·다른 상태를 해제하지 않는다.
환생부는 자동부활이나 전투 부활을 제공하지 않는다.
`itemAllowsBattle`가 `onlyEffectiveOnDeadActors` 약품을 제외하는 현재 엔진 제한을 그대로 따른다.
현재 prototype에는 `state_death` 행이 없고 HP=0이 전투불능 판정이다. 부활은 HP를 올리고 다른 상태·MP는 보존한다.
`consumptionLimit: "noLimit"`는 무한 사용이 아니라 성공한 사용마다 한 개 소모하는 기존 계약이다.
메뉴의 효과 없는 사용은 수량을 보존한다. 전투에서는 효과가 없는 승인된 행동도 수량을 소모할 수 있다.

## 그림 원본·출처

저자: GPT 6.1 sol high, consumables 작업자, 2026-10-04.
`draw_icons.py`의 정수 좌표·팔레트로 새로 저작한 원본 PNG다. 그림 생성 API·상용게임 그림·기존 아이콘 재색칠 없음.
`assets/item-catalog/style-reference.png`를 직접 열어 기존 32px의 짙은 외곽선·좌상단 조명만 참고했고 바이트나 도형을 복제하지 않았다.
PNG는 투명 RGBA 32×32, 알파 0/255, 아이콘별 5~12색. 원본은 이 폴더 `assets/<slug>.png`다.
권리 출처는 이 작업의 원저작이며 외부 저작물 재배포 없음. 기존 저장소의 다른 에셋 라이선스를 이 그림에 전가하지 않는다.
`art-manifest.json`에 원본 코드 SHA-256, PNG별 SHA-256·색수·경계·저작방식·계약상 배포 경로를 저장했다.

재생성(저장소 루트; Python 3 + Pillow):

```bash
python3 content-packs/joseon-folklore/consumables/draw_icons.py
```

이 명령은 자기 폴더의 PNG, `art-manifest.json`, `review/pilot-sheet.png`만 쓴다.
PNG를 저장 후 다시 디코드해서 native 크기·알파·팔레트·경계를 확인하고 nearest 6배 시트를 만든다.
직접 이미지 검토 기록은 `review/visual-review.json`이며 저자 검토가 사용자 승인은 아니다.
그림을 다시 바꾸면 기존 검토의 해시가 맞는지 다시 확인해야 한다.

## 허용된 개별 스모크

```bash
node content-packs/joseon-folklore/consumables/run-smoke.mjs
```

선택적으로 읽기 전용 prototype JSON 경로를 마지막 인자로 준다.
앱 Vite 설정·미들웨어·환경 파일을 로드하지 않고, listen 없이 단일 스크립트를 실행한다.
캐시는 `/tmp/jf-consumables-script-cache`이며 공유 `node_modules`에 쓰지 않는다.
현재 `normalizeItemRecord`, 실제 `useItemFromMenu`, 실제 `createBattleRuntime`로
정규화 후 JSON 저장/재로드, HP/MP 회복·상한·독 해제·필드 부활·무효대상·소모·재료 사용불가를 확인한다.
`review/smoke.json`은 데이터·읽기 전용 prototype·실행 코드 해시와 실제 전후 수치를 담는다.
엔진 코드 변경이나 gates/vitest/npm test/전체 typecheck 실행은 없다.

## 감독자 통합 경계

`art-manifest.json.icons[].path`는 `assets/joseon-folklore/consumables/<slug>.png`,
resourceId는 `jf-icon-<slug>`이다. 감독자가 원본을 public에 복사·등록하고 데이터를 실제 게임에 합친다.
이번 결과의 `ready`는 첫 샘플 파일이 저장되어 검토 가능한 상태라는 뜻이다.
live SQLite/Supabase/다른 프로젝트, runtime/editorcore/registry/고정 계약을 수정하지 않았다.
정본 저장·실제 게임 화면·오프라인 내보내기 통합 검증은 감독자 단계에 남아 있다.
