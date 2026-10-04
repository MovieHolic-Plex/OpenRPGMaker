# 공용 몬스터 손 도트 리프레시

**현재 원본:** 후속 전체 제작 요청에 따른 새 135종은 `scripts/asset-gen/pixel-enemy/redraw/`에서 저작한다.
청록 히드라와 긍정 평가를 받은 갓파·늑대·박쥐·해골 5종을 유지한다. 현재 140종은 native64/96이며,
최신 재현과 확인 기록은 `tiledata/monster-redraw-all/README.md`, `verify-shots/monster-redraw-all/SUMMARY.md`를 따른다.
이 폴더의 종별 PNG도 현재 원본으로 갱신한다. 아래는 반려된 첫 일괄 초안의 기록이다.
`refresh/run.py`와 개별 생성기는 registry를 통해 최신 원본을 호출하며, 옛 본체 소스는
`refresh/rejected-archive/`에만 기록으로 남는다. 새 135종의 사용자 검토는 별도다.

**사용자 그림 검토: 반려 (2026-10-03).** 히드라 외 139종은 미승인 초안이다.
아래 재생성·파일 확인 기록은 그림 품질 승인이나 작업 완료를 뜻하지 않는다.

후속 요청으로 갓파·회색 늑대·동굴 박쥐·해골 전사는 새 기본 그림의 9포즈를 배선했다.
이 네 종은 모두64px이며, 최신 원본/전투 확인은 `tiledata/monster-battle-four/README.md`를 따른다.
registry가 네 종의 새 원본을 우선하므로 이 페이지의 명령으로 재생성해도 이전 초안으로 돌아가지 않는다.

범위는 `scripts/asset-gen/pixel-enemy/refresh/manifest.json`의 공용 전투 몬스터 140종이다.
승인된 청록 히드라 1종을 유지하고 나머지 139종은 새 원본 도트로 다시 그렸다.
9포즈 × 140종 = 1,260칸. 사용자 프로젝트의 적 레코드·능력치·행동은 수정하지 않는다.

## 그림과 동작

- 최종 48/64/96px 격자에서 정수 좌표의 폴리곤·픽셀·선으로 직접 저작한다.
- 원본 이미지, 생성형 이미지 모델, 큰 그림의 축소·추적·보간을 사용하지 않는다.
- 예시 확대와 GIF만 nearest로 정수 배율 확대한다. GIF는 저작 동작 미리보기이며 전투 녹화가 아니다.
- 짙은 윤곽, 큰 명암 군집, 얼굴·턱·치아와 종별 체형을 함께 그린다. 재색칠만으로 종을 나누지 않는다.
- 전투 포즈는 대기 a/b/c, 준비, 이동, 공격, 복귀, 피격, 쓰러짐 순서다.
- 눈·턱·목·팔·다리·날개·꼬리의 관절 좌표를 바꿔 각 칸을 다시 그린다. 시트 한 칸을 통째로 옮겨 포즈를 만들지 않는다.
- 쓰러짐은 접힌 날개, 누운 몸, 떨어진 무기·뼈·흩어진 덩어리를 각 종의 구조에 맞춰 그린다.
- 원본 알파는 0/255, 포즈 전체의 색 상한은 32색이다. 접지선은 cell−4, 공중형의 대기 위치는 그 위다.
- 같은 리소스의 일반 이미지에는 idle_a 한 칸을 그대로 사용한다.

## 원본과 재생성

```bash
python3 scripts/asset-gen/pixel-enemy/refresh/run.py
python3 scripts/asset-gen/pixel-enemy/refresh/run.py --group organic
python3 scripts/asset-gen/pixel-enemy/refresh/run.py --species dragon-blue
```

원본은 `refresh/{organic,arcane,humanoid,bosses}.py`와 같은 폴더의 세부 저작 모듈이다.
히드라는 승인한 `scripts/asset-gen/pixel-enemy/hydra-three.py`를 그대로 호출한다.
기존 개별/retirement 생성 명령도 새 원본으로 연결하여 재생성 때문에 옛 그림이 복구되지 않게 한다.
이 폴더의 종별 하위 디렉터리에 9개 원본 PNG가 있다. 묶음별 해부 구조·특징은 각 `*-README.md`를 본다.

## 공용 배선과 확인

`pixelEnemySheets.ts`의 ID·경로·셀·공격 이동 유형·대기 속도를 유지한다.
초상과 자료집 설명/검토 해시, `battleContactBounds.json`, PWA 자산 캐시(v7)를 갱신한다.
사람이 선택한 별도 수집용 `generated-enemy-sparkit-fire`는 기존 하네스 ledger의 자산을 쓴다.
사용자 업로드가 같은 공용 ID를 소유할 때 업로드를 우선하는 계약도 그대로 적용된다.

```bash
python3 scripts/content/measure-battle-contact-bounds.py
node node_modules/vite-node/vite-node.mjs --script scripts/content/audit-monster-refresh.mts
node scripts/qa/runtime/monster-refresh.mjs
```

첫 명령은 그림의 접촉 경계 재저작, 둘째는 PNG·초상·ID·기본 적·내보내기 참조 확인이다.
셋째는 임시 fixture로 출하 플레이어(`player.html` + export shim)를 띄워 실제 RM2003 화면과
모든 시트/초상의 브라우저 디코드를 확인한다. `verify-shots/monster-refresh/runtime/SUMMARY.md`부터 읽는다.
전후 비교, 9포즈, GIF와 실제 확인 범위는 `verify-shots/monster-refresh/SUMMARY.md`에 기록한다.
공용 파일 작업이며 정본 SQLite 저장 완료를 주장하지 않는다. 전체 테스트/게이트 근거가 아니다.
