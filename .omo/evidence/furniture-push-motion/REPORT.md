# 가구 밀기 — 연속 프레임 QA

사용자 피드백: 의자 밀기 등의 애니메이션이 자연스럽지 않다.
기존 QA는 이동 전후 좌표와 스틸 두 장만 확인했다. 이것으로 애니메이션 품질을 판정한 것은 부족했다.

## 결과와 실제 화면

- 수정 전 조사 키: 의자 발 위치 y176→160이 첫 변경 프레임(약 28ms)에 한 번에 바뀌고,
  플레이어 발은 y192에 그대로 남았다. `before.json`은 그 좌표 기록이다.
  첫 WebGL 캔버스 비트맵은 이미 지워진 프레임이어서 검은 이미지였다. 그 이미지를 시각 증거로 쓰지 않는다.
- 수정 후 조사 키: 실제 렌더 샘플 34개, 중간 위치 13개. 플레이어와 의자 간격은 모든 샘플에서 16px.
  의자 그림/프레임은 유지되며, 종료 위치는 의자 y160 / 플레이어 y176이다. `after.png`, `after.json`.
- 수정 후 방향키 탭: 샘플 31개, 중간 위치 11개. 같은 간격과 정확한 종료 위치. `after-direction.png`,
  `after-direction.json`, `direction-motion.gif`. PNG 두 장을 직접 열어 중간 자세와 정렬을 확인했다.
- 두 실행 모두 브라우저 런타임 오류 0개. 실제 `player.html`을 사용했고 편집기 셸을 거치지 않았다.

GIF는 방향키 실행에서 실제 캔버스 프레임을 샘플 간 시간대로 재생한다. 처음의 DOM 포함 셋업 스크린샷은
제외했다. 이 머신은 공유 호스트와 소프트웨어 GPU를 쓰므로 입력부터 관측된 종료까지는 조사 551ms /
방향키 416ms였다. 엔진 시간은 기본 설정에서 19×60Hz 틱(약 317ms)이다. 브라우저 측정 시간을 엔진의
고정 재생 시간으로 혼동하지 않는다.

## 공통 엔진 변경

`tryStartFurniturePush`가 방향키와 조사 키 모두의 충돌/시작 경로다. 2틱 준비 뒤 같은 smoothstep으로
몸과 가구를 함께 가속·감속한다. 대시는 밀기를 가속하지 않는다. 가구 스프라이트의 위치·깊이만 바꾸며
전체 이벤트 재생성은 하지 않는다. 다른 이유로 재렌더되어도 진행 중 위치를 유지한다.

메뉴는 양쪽을 같이 정지하고, 이동 도중 조사 키는 다음 밀기를 예약하지 않는다. 맵 리셋은 표현 상태를
비우며, 이동 명령 취소는 가구도 원점으로 되돌린다. 도착 칸은 기존 세션 계약대로 시작 시 예약하고
출발 발자국도 종료까지 NPC 충돌에서 예약한다. 저장 데이터에는 소수 좌표나 애니메이션 객체를 넣지 않는다.
이동 중 저장/복원은 기존 보행처럼 플레이어 출발 칸 + 가구의 예약된 도착 칸으로 정착한다.

순수 런타임 변경이다. 스키마·게임 콘텐츠 변경 및 Supabase 쓰기는 없다.
검증에 사용한 게임은 기존 저장/재로드 스냅샷 `rpg-zzu-night-monster-20260905`다.
기존 프로젝트와 에디터가 저작한 모든 `interaction.kind=pushable` 이벤트에 적용된다.

## 재현

```bash
# 원격 게임을 읽기만 해서 스냅샷을 받는다. 환경은 quickstart / AGENTS.md를 따른다.
npx tsx scripts/revise-night-monster.mts --read
node scripts/qa/runtime/furniture-push.probe.mjs --project output/evidence/night-monster-upgrade/before.json
node scripts/qa/runtime/furniture-push.probe.mjs --project output/evidence/night-monster-upgrade/before.json --direction
```

결과의 `SUMMARY.md`를 먼저 읽고 `motion-sheet.png`를 연다. `review.json`에는 모든 연속 좌표가,
`samples/`에는 실제 프레임이 있다. 자동화 성공은 시각 검토 완료를 뜻하지 않는다.

## 검증

관련 3개 파일 52/52 통과 (`focused.txt`): 4방향, 조사/이동 키, 중간 좌표와 접촉 간격,
연타·종료 틱 입력, 막힌 목적지, 30/60/120Hz, 메뉴 정지/재개, 재생성, 취소, 맵 리셋,
이동 중 세이브 복원, 기존 점프·일반 보행·공포 상태 계약.

전체 `npm run gates -- --json` 결과는 완료 후 이 절에 추가한다. 게이트 실행 중 소스/테스트는 변경하지 않았다.
