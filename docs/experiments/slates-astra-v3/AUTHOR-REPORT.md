# Slates Astra v3 — 저작 인계 완료

**최종 파일 확정. 저작 담당은 이후 수정하지 않는다.**
프로젝트 `rpg-zzu-slates32-38e6`, 맵 `slates_astra_v3_walled_50` 「처마맞댄 은실성」.
원격 저장·재로드·실제 에디터/런타임 검증은 감독자가 이어서 한다.

## 핵심 결과

- 고정 내부 `[3,4,44,42]`: 1,848칸 / 1,892,352픽셀.
- 건물 alpha 합집합 **988,745.8745098929픽셀 상당 / 52.24957484177853%**. 감독자 독립 재합성도 일치했다고 전달받았다.
- 40개 건물: 상점 15, 여관 9, 작업장 10, 돌출집 6. 건물군 10개.
- 건물 간 footprint 교차 **0셀**, 비그림자 원본 건물 픽셀 교차 **0**, 가린 문 **0/64**.
- 문앞 64개 포함 목표 **68/68 연결**. 완전 빈 5×5, 가로 동일 모듈 3연속, 성문 봉쇄 시 성벽 유출 모두 **0**.
- 열린 바닥 최대 빈 사각형 `[22,10,2,20]`: 두 칸 연결길. 실제 foreground 기준 최대 `[3,44,20,2]`.
- 바닥·그림자·성벽·나무·소품·패딩은 건물 밀도에서 제외. `buildingEmpty`는 건물 전용 진단이며 실제 빈 바닥인 `walkableEmpty`/`visibleEmpty`와 구분한다.
- 아틀라스 **1792×800 / 1,397슬롯**: 원본 1,232 + 파생 165. 원본 슬롯 RGBA 및 번들 재합성 대 map.png 차이 모두 **0바이트**.
- 예외 공간은 사전 선언한 우물 `[12,26,4,4]`, 정원 `[41,18,5,5]` 그대로다.

## 실제 입력과 그림 검토

`AGENTS.md`, `openwiki/quickstart.md`, `INDEX.md`의 Slates 좌표, `PROJECT_WIKI.md` 관련 절, `slates-agent-entry.md` → `slates-dense-town.md` → `slates-assembly-playbook.md` → `slates-village-authoring.md`, `slates-structure-learning.md` 1~6절, `slates-atlas-review.md` 관련 절, `ATTRIBUTION.md` Slates 절을 읽었다.

조립 입력은 `docs/experiments/slates-astra-v2/modules.json`의 operations/review/fixedParts/collision/anchors 및 `public/assets/slates/slates-v1/v2-32px.png`다. 원본 사각형만 1:1 alpha-over 했다. 입력별 정확한 경로·해시는 `INPUTS.json`에 있다.

`view_image`로 dense-v3 참고/반례, 사용한 6개 모듈 complete 그림, battlement/stone-border 번호판을 열었다. 산출물 전체·확대 3장·밀도판과 마지막 접합/동쪽 문 그림도 직접 보았다. v2 전체 지도 데이터/생성기/번들/readback, 감독자 스냅샷, DB/.env는 읽지 않았다.

## 수정 요약

첫 격자 초안은 `rejected-layout/`에 보존했다. 중앙 길을 서쪽 2칸·동쪽 3칸 꺾고 건물 높이/종류를 섞었다. 여관 17개를 9개로 줄였으며 서쪽 겹침·막힌 문앞·남문 보행면 잔디선을 수정했다.

감독자가 수용한 52.235%/40개 배치 이후에는 국소 수정만 했다. b06 작업장을 아래로 16px 옮겨 뒤 상점 기단과의 285픽셀 접촉을 분리했다. 동쪽 성벽 안쪽 부재를 오른쪽 8px 옮겨 두 여관 문 테두리의 46픽셀씩 가림을 해소했다. 원본 투명 RGB도 보존하도록 아틀라스 패킹을 보정했다.

## 파일과 재생성

```bash
node scripts/content/build-slates-astra-v3.mjs
```

- `bundle.json`, `layout.json`, `map-operations.json`: 통합 데이터·배치·모든 원본 연산/패킹 출처.
- `metrics.json`, `author-validation.json`: 계산 및 저작 검증 근거.
- `map.png` **1600×1600**, `density.png`, `atlas.png`.
- `crop-1/2/3.png` 각각 **544×480**. 범위 `[3,13,17,15]`, `[23,15,17,15]`, `[30,31,17,15]`.
- `contact-final.png`, `east-door-north.png`, `east-door-garden.png`: 마지막 국소 수정 증거.
- `FINAL-FILES.sha256.json`: 확정 파일 해시. `rejected-layout/`는 통합 입력이 아니다.

## 한계와 인계

기존 모듈의 partial 한계(상점 지붕 텍스처 접합, 여관 날개의 얕은 뒤 능선, 작업장 지붕 끝, 얇은 세로 성벽)는 유지한다. 문은 외관이며 실내 이동/NPC/상점 이벤트는 없다. 일부 교차점과 문앞 여백은 국소적으로 넓다.

lower 충돌 footprint와 upper X/star를 분리했으며 같은 그림이라도 통행/priority가 다르면 ID를 분리했다. 저작 mask와 번들 계산은 통과했지만 실제 배우 가림과 원격 지속성은 감독자 검증 대상이다.

저작 spawn **(24,44)**. **감독자 전용 런타임 QA는 남문 밖 (24,49)에서 시작**한다. DB 저장 성공을 본 담당의 결과로 주장하지 않는다. gates/vitest/test/typecheck/stash/commit/다른 에이전트는 실행하지 않았다.

타일: **Ivan Voirol — CC BY 4.0**. 원본 사각형 재조립·새 배치·파생 타일 패킹. 내보내기에 출처·라이선스·변경 표기를 유지한다.
