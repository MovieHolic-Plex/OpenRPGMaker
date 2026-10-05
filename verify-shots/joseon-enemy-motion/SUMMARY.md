# 조선 설화 · 실제 몬스터 전투 동작

2026-10-05. 사용자 지시: 몬스터가 실제 전투에서 돌격·타격·기술을 사용하도록 만들고,
중간 녹화로 속도와 타격감을 검토한다. 현재 숲과 교정한 3종을 쓴다.

## 확인한 장면

| 적 | 실제 행동 | 녹화 |
|---|---|---|
| 산멧돼지 | 엄니돌진 예고 → 흙먼지 → 표적 앞까지 가속 → HP 피해 → 복귀 | `boar.mp4` |
| 볏짚 도깨비 | 기본 공격 + 짚방망이 접근 → 무기 호 → HP 피해/반동 → 복귀 | `dokkaebi.mp4` |
| 처녀귀신 | 한의울음 예고 → 제자리 영창 → 화면 울음/대상 파동 → 귀봉 부여·해제 | `ghost.mp4` |

세 기술의 실제 FX 6개를 관측했다: mon_charge_dust, mon_tusk_hit, mon_cleave_arc,
mon_slam_hit, mon_wail_sky, mon_screech_ring. 돌진/강타는 화면 가로 약 530px 이동했고
대기·준비·이동·공격·회복 칸을 각각 관측했다. 귀신은 원래 자리에서 시전했다.
피해/상태는 원래 기술 레코드로 계산한다. 한의울음은 HP 피해가 없는 전체 상태 기술이다.

PNG는 다음 두 장만 즉시 확인한다:

- `02-ghost-pulse-contact.png`: 실제 영상의 연속 프레임. 화면 울음과 파티 위 파동이 함께 보인다.
- `04-shipped-victory.png`: 원본 2종 사냥터 조우에서 기술을 받은 뒤 F 자동 전투로 실제 승리.

## 검토 편성과 원본 게임 구분

- `review-runtime-proof.json`: 원본 능력치를 유지한 검토용 3종 편성. 방어 21명령 뒤
  세 기술/준비 띠/좌표/FX를 기록했다. 별도 게임 저작이나 강제 피해를 넣지 않았다.
- `shipped-runtime-proof.json`: 서버의 원본 `/project.json`. 볏짚 도깨비+산멧돼지 2종
  조우, 방어 21명령, 두 기술 관측 뒤 F 자동 전투로 승리. 플레이어와 적 기술을 모두 사용했다.
  UI의 승리·경험치57·전22·멧돼지 어금니·레벨 상승은 실제 결과 화면에서 확인했다.
- 두 실행 모두 title→village→new-monsters 3비트 실패0, JS 오류0, HTTP 누락0.
  마우스 클릭을 쓰지 않는다. 이 플레이어는 키보드 입력을 소유한다.
- MP4는 출하 player.html의 실제 WebM 녹화를 잘라 압축한 무음 영상이다.
  전체 원본 영상은 무시되는 `output/jf-motion-20261005/{video,native/video}/`에 있고 재생성
  명령은 아래에 있다. 정적 스프라이트 이동을 게임 녹화로 꾸미지 않았다.

## 정본·공용 배포

프로젝트 `f84dfa19-5b71-43f1-8523-b10910d23be7`:
`/home/main/z-project/rpg-zzu/.oprn-projects/joseon-starter-preset-20261004`.
SQLite API로 필요한 기존 필드만 적용, close→reopen revision9, 참조 오류0.
문서 SHA-256 `324573d3b54f3ea898cb49d185bdc48e68e15f27367e44f749e5d1f99753ce6b`.
`storage-proof.json`, `preservation-proof.json`에 근거를 둔다.

revision6과 비교해 기존 데이터는 두 적의 actions와 세 기술의 retroChoreographyId만 바뀌었다.
프로젝트 연출 3개를 추가했다. 맵·숲·그림·세션·능력치·위력·기력·확률은 같고 다른 적은 같다.
선택형 공용 팩에도 연출 컬렉션을 등록했다. `pack-proof.json`: 새 프리셋 연결3개,
기존 프로젝트 누락 컬렉션 추가3개, 반복 추가0, 저자 연출 이름 보존.

`npm run build:player` 완료, SDK artifact `c8f3a4caf67547ce`, source `4102eb0491caa501`.
내보내기 assets 누락/외부 fallback0. 기존 18345 서버의 같은 디렉터리에 갱신했다.
전체 gates/Vitest/typecheck는 실행하지 않았다. 전체 난이도나 다른 12종 연출의 합격을 뜻하지 않는다.
두 초기 캡처 assertion(준비 띠를 boolean으로 오해, 아군 기술까지 적 기술로 집계)은
관측기 오류였고 수정한 관측기로 다시 캡처했다. 실패 기록은 output에 보존했다.

## 재생성

```bash
node scripts/content/prepare-joseon-folklore.mjs
npm run build:player
node scripts/content/export-joseon-folklore-game.mjs --starter
node scripts/qa/runtime/joseon-enemy-motion.capture.mjs --out output/joseon-enemy-motion
node scripts/qa/runtime/joseon-enemy-motion.capture.mjs --shipped --out output/joseon-enemy-motion/native
```

내보내기 입력은 같은 SQLite 대상을 실제로 재로드한 JSON이어야 한다. export만으로 정본 저장을
대체하지 않는다. 실제 기존 게임에는 누락 추가 팩 적용만으로 저자가 가진 기존 레코드를
덮어쓰지 않으므로, 승인된 행동/기술 필드를 SQLite API로 따로 갱신해야 한다.

검토 화면:
http://100.73.251.77:8811/2026/10/04/01a10467-e079-7e92-83c5-234af352260e/joseon-enemy-motion.view.html
736/320px에서 폭 넘침 없음, 탭 3개 영상 디코드/재생과 JS 오류0 확인. 사용자 최종 선택은 별도다.
