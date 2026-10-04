# 조선 설화 monsters — full 15종

일반12 + 보스3. 전종 원본 3×3 9포즈·idle_a 초상, 적15개·고유 단독 트룹15개. 원본 픽셀 코드 저작이며 새 적을 Actor1 칩으로 만들지 않았다.

## 2026-10-05 그림 교정

사용자는 숲은 현재 그림을 유지하고 적은 새 후보 방향으로 더 고치도록 지시했다.
산멧돼지·볏짚 도깨비·처녀귀신3종은 후보 비례를 유지하면서 얼굴·명암·옷·손과9개 전투 자세를
교정했다. 나머지12종과 데이터/행동/리소스 ID는 이번에 바꾸지 않았다.

3종의 저작 이력과 비교는 `../art-direction/monsters/refinement/`, 배포용27개 문자 격자는
`source/refined-grids/`에 있다. `draw.py`는 이3종을 `refined.py`에 연결한다.
재생성할 때 이전 좌표 도형 함수로 덮어쓰지 않는다. 원본 PNG 재현·셀 경계·초상 일치는
`review/asset-smoke.json`, 실제 내보내기 전투·정본 재로드는
`verify-shots/joseon-enemy-refinement/`에서 확인한다. 작업자 검토와 최종 사용자 그림 선택은 구분한다.

| slug | 이름 | 레벨 / HP | 셀 / 이동 | 출현 구분 | 경험치 / 금 |
|---|---|---|---|---|---|---|
| field-rat | 들쥐 | 1 / 65 | 64 / dash | common | 10 / 5 |
| wild-boar | 산멧돼지 | 2 / 110 | 64 / dash | common | 22 / 9 |
| cave-bat | 굴박쥐 | 2 / 85 | 64 / swoop | common | 18 / 8 |
| straw-dokkaebi | 볏짚 도깨비 | 3 / 140 | 64 / stomp | common | 35 / 13 |
| lantern-wisp | 도깨비불 | 4 / 125 | 64 / float | common | 32 / 12 |
| maiden-ghost | 처녀귀신 | 5 / 145 | 64 / float | common | 42 / 17 |
| drowned-ghost | 물귀신 | 8 / 220 | 64 / float | common | 75 / 25 |
| grave-ghoul | 묘지귀물 | 10 / 280 | 64 / stomp | common | 95 / 32 |
| fox-spirit | 여우요괴 · 희귀 | 12 / 360 | 64 / dash | rare-elite | 150 / 55 |
| stone-dokkaebi | 돌 도깨비 · 강적 | 13 / 480 | 64 / stomp | rare-elite | 185 / 65 |
| bamboo-specter | 대숲귀물 | 15 / 420 | 64 / shoot | common | 165 / 50 |
| masked-bandit | 복면산적 | 17 / 510 | 64 / dash | common | 210 / 75 |
| bronze-dokkaebi | 청동 도깨비 | 6 / 680 | 96 / stomp | unique-boss | 210 / 120 |
| bride-wraith | 신부 원귀 | 12 / 1400 | 96 / float | unique-boss | 650 / 350 |
| mountain-tiger | 산군 호랑이 | 19 / 2600 | 96 / dash | unique-boss | 1400 / 800 |

## 데이터·그림 계약

- `assets/<slug>.png`: 일반 native64, 보스 native96, 투명 RGBA 3×3 시트. idle_a/b/c → windup/move/attack → recover/hit/dead. 오른쪽을 향하며 기준선 y=cell−4를 넘지 않는다. 박쥐는 발이 기준선 근처에서 떠 있는 공중 자세다.
- `assets/portraits/<slug>.png`: idle_a 픽셀을 그대로 잘라낸 초상15장. 일반 이미지에 시트 전체를 넣지 않는다.
- `sheets.json`: 엔진의 resourceId/path/cell/motion/idleFrameMs 배열. 경로는 향후 public 상대경로이며 실제 원본은 이 폴더의 assets 안에 있다.
- `data.json`: enemies15/troops15. 행동은 전종 skill_attack always/priority50 fallback, 치명타 비활성. behavior 담당이 최종 행동을 교체한다.
- `design.json`: 전종 지역·권장 파티레벨·드롭·희귀 강적·디자인·후속 역할 계약. 여우와 돌 도깨비는 희귀 강적, 보스3은 고유 단독 보스로 명시했다. 드롭은 ids.json 예약 재료12종을 모두 사용한다. full 소비품 담당이 재료 레코드를 정의한다.
- 단독 트룹 ID는 `troop_jf_<slug의 하이픈을 밑줄로 바꾼 값>`, enemyIds/members 한 명씩, autoAlign=true/uncapturable=true. 배경은 실제 기존 `battle-scenery-forest`/`battle-scenery-cave`만 사용한다.

감독자가 시트를 public/assets/joseon-folklore/monsters/로 복사하고 초상은 별도 portraits/로 배선한다. 등록기·runtime/editor core·고정계약·실제 SQLite/Supabase는 이 작업에서 수정하지 않았다. 현재 엔진 등록/내보내기/정본 저장 완료를 주장하지 않는다. actual canonical은 root 담당이다.

## 독립 디자인과 출처

이 역할에서 직접 작성한 Python/Pillow 정수 좌표 코드다. 공용 helper만 공유하고 종별 몸 구조·시점·무기·행동·쓰러짐을 별도로 그렸다. 기존 고블린 그림/코드·상용 그림·이미지 생성 API·Actor1 픽셀은 사용하지 않았다.

- `source/draw.py`: 전종 패킹. 교정3종은 `refined.py`를 사용하고 나머지12종은 기존 좌표 소스를 사용한다.
- `source/refined.py`와 `source/refined-grids/`: 교정3종×9자세의 native64 문자 격자와 팔레트를 직접 픽셀로 변환한다.
- `source/organic.py`: 들쥐·박쥐·세 꼬리 여우·산군 호랑이의 각각 다른 해부 구조.
- `source/spirits.py`: 도깨비불·상투와 젖은 포의 물귀신·굽은 묘지귀물·마디/뿌리/잎의 대숲귀물.
- `source/figures.py`: 깨진 외뿔/바위 가면과 돌 방망이의 도깨비·복면/바지저고리/환도의 산적·족두리/원삼/옥 비녀의 신부 원귀.
- `source/pixels.py`: 이 역할에서 직접 만든 기본 좌표 래스터 helper.
- 조선풍 복식/설화는 독자 판타지 디자인이며 정밀한 역사 복원은 아니다. 사용자 그림 승인과 작업자 자체 검토를 구분한다.

## 재생성·자체 검수

저장소 루트, Python3/Pillow와 기존 node_modules:

```bash
python content-packs/joseon-folklore/monsters/source/draw.py
python content-packs/joseon-folklore/monsters/source/data.py
python content-packs/joseon-folklore/monsters/source/asset-smoke.py
node content-packs/joseon-folklore/monsters/source/run-smoke.mjs
python content-packs/joseon-folklore/monsters/source/preview.py
```

`source/balance-inputs.json`은 읽기 전용으로 취득한 현재 클래스4종×1–20 성장곡선/장비4급/기존 skill_attack의 스냅샷이다. 원본 경로와 SHA-256이 들어 있으며 위 재현에는 다른 작업트리 접근이 필요 없다. 새 클래스·장비 입력으로 갱신할 때만 `source/capture-balance.py --classes <data.json> --equipment <data.json> --prototype <prototype-database.json>`를 실행한다. 이 명령도 이 역할의 스냅샷만 쓴다.

- `review/art-manifest.json`: 모든 그림 소스 해시·실제 시트 해시·135포즈 해시/bounds/색/알파. 색은10~17색(대숲9색), alpha0/255.
- `review/asset-smoke.json`: PNG 재로드, 135포즈 원본 코드 재현, 종마다9개 다른 픽셀, idle15개 다른 실루엣, 바닥/셀경계, 초상 픽셀, 예약 ID/드롭 확인.
- `review/normalize-smoke.json`: 실제 normalizeEnemyRecord/normalizeTroopRecord와 JSON 왕복. 15개 stats/rewards/actions/members 보존.
- `review/balance-probe.json`: 실제 applySkillLike로15종×4직업 기본 공격 점검. 최대 양의 분산/치명타0 기준, 해당 레벨 무장 없는 직업 HP 대비 한 방35% 미만. 실제 게임의 승패 검증은 아니다.
- `review/VISUAL-REVIEW.md`: 최종 native 시트15장과 초상15장을 각각 view_image로 직접 확인한 작업자 관찰.
- `review/roster.png`, `review/*-poses.png`: 각각2배 전체도감·3배 포즈보드. nearest neighbor 정수 확대, 검토용 그림만 체커/라벨 포함.
- `review/index.html`: 실제 원본 PNG를 내장한 이동 가능한 포즈 재생 화면. 브라우저로 파일을 열면15종 idle/행동/9칸/피격/쓰러짐을 재생한다. 정지·단일 칸·배경 변경. 실제 게임 런타임 화면이 아니다. JS 구문 확인은 통과했고 브라우저 동작 자동 검사는 하지 않았다.

## 보스와 확인 한계

청동 Lv6 HP680 → 신부 Lv12 HP1400 → 산군 Lv19 HP2600. 보상은 경험치210/650/1400, 금120/350/800으로 증가한다. 각 재료는100% 하나 드롭이다. 적정급 무기를 낀4인이 기본 공격만 하면 각각7/12/18라운드의 벤치마크이며 기술·회복·ATB·행동 패턴이 들어간 실제 시간은 아니다. 보스 최대 기본 공격은 무장 없는 직업 HP의16.6%/18.6%/17.5%였다.

특수 스킬·약점·상태·반격은 아직 행동 데이터에 넣지 않았다. 전용 연출/behavior가 합류한 실제 RM2003 화면, 내보내기, 정본 저장/재로드, 전투 난도는 root 통합 후 확인한다. 첫4종을 사용자가 보았다는 지시는 기록했으나 full15종의 사용자 승인으로 확대하지 않았다.

`status.json`은 모든 파일 저장·직접 시각 검토·개별 확인 후 마지막에 쓴 full 로컬 인계 상태다. ready=true가 사용자 그림 승인·공용 등록·정본 저장을 뜻하지 않는다. 재저작하면 해당 status/시각 검토는 무효이며 새 해시 기준으로 다시 검토해야 한다. 보고서는 `FULL-REPORT.md`다.

## Git 전달

공유 index의 쓰기 거절로 현재 브랜치 HEAD를 갱신할 수 없어 임시 Git 저장소의 feat 커밋/bundle로 인계한다. bundle은 `/tmp/jf-monsters-full-xcmewnny/monsters-full.bundle`다. 상세 제약과 root의 가져오기 명령은 FULL-REPORT.md를 따른다.
