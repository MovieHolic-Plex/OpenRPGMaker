# 공용 몬스터 전투 도트 전체 재저작

사용자가 긍정적으로 평가한 하이드라와 갓파·회색 늑대·동굴 박쥐·해골 전사 이후,
나머지 몬스터에도 같은 수준의 직접 저작과 전투 포즈를 요청했다. 이전 139종 일괄 그림은
반려된 초안이며 이번 그림의 품질 기준으로 쓰지 않는다.

## 저작과 공용 배선

- 135종을 새로 그리고 종당 9포즈를 만든다. 기존에 평가받은 5종은 시트와 초상을 그대로 보존한다.
- 원본은 `scripts/asset-gen/pixel-enemy/redraw/{organic,arcane,humanoid,bosses}*.py`.
  좌표·선·다각형·작은 픽셀 군집으로 최종 64/96px 격자에 직접 그린다. 생성형 이미지,
  참고 비트맵 추적, 완성 그림의 회전·축소로 포즈를 만드는 과정은 없다.
- 원래 48px였던 나머지 종도 64px 격자에서 새로 저작한다. 확대 복사하지 않는다.
  공용 카탈로그는 64px 126종·96px 14종이며, 이전 48px의 읽기 호환성은 런타임에 남는다.
- 알파 0/255, 종별 시트의 사용색 32색 이하. 실제 모양·색 수는 `pixels.json`에 기록한다.
- 3×3 순서: 대기 A/B/C, 준비/이동/공격, 복귀/피격/쓰러짐. 관절·턱·날개·사지·무기가
  소스 좌표에서 움직인다. 쓰러짐은 별도 누운/붕괴 몸을 그린다.
- 유기체의 부위 경계는 개별 점을 잘라 맞추지 않는다. 부착점 기준으로 부위 전체의
  원본 좌표를 함께 맞추고 윤곽·명암·선 두께의 최종 경계를 확인한다.
  `verify-shots/monster-redraw-all/organic/source-geometry-audit.json`에396포즈의 기록이 있다.
- 공용 ID와 PNG 경로는 유지한다. `pixelEnemySheets.ts`의 셀, `pixelEnemyPortraits.ts`가
  파생하는 초상, 자료집의 실제 특징 설명·해시, 접촉 경계를 함께 갱신한다.
- 사용자 업로드가 같은 ID를 소유하면 기존 업로드 우선권을 유지한다.
  사람이 선택한 수집용 `sparkit-fire`의 앞/뒤 시트는 이 일반 JRPG 전투 작업의 대상이 아니다.
- PNG 원본 칸은 `tiledata/monster-refresh/<slug>/`에 유지한다. 파일별 좌표 소스는 새 `redraw/`를 쓴다.

## 재생성

```bash
python3 scripts/asset-gen/pixel-enemy/redraw/export.py organic
python3 scripts/asset-gen/pixel-enemy/redraw/export.py arcane
python3 scripts/asset-gen/pixel-enemy/redraw/export.py humanoid
python3 scripts/asset-gen/pixel-enemy/redraw/export.py bosses
```

기존 `refresh/registry.py`와 개별/retirement 명령도 새 소스를 우선한다. 이미 평가받은
네 종은 `kappa-redraw-draft.py`, `monster-redraw-studies.py`, `study_motion.py`를,
하이드라는 별도 `hydra-three.py`를 유지한다. `redraw/integrate.py <group>`는 실제 그림을
검토한 뒤 해당 종의 공용 메타데이터만 갱신한다. 사용자 프로젝트 저장소에 쓰지 않는다.

원본 재현·메타데이터 확인:

```bash
python3 scripts/asset-gen/pixel-enemy/redraw/inspect-native.py
node node_modules/vite-node/vite-node.mjs --script scripts/content/audit-monster-redraw-all.mts
node scripts/qa/runtime/monster-redraw-all.mjs
```

미리보기는 `redraw/build-gallery.py <절대 HTML 경로>`로 만든다. 전체140종을 lossless PNG
데이터로 포함하며 그림 픽셀은 그대로다. 정수 배율 확대와 각9포즈 선택·재생을 제공한다.
상태에는 고른 종과 포즈만 저장하며 에디터·사용자 프로젝트를 수정하지 않는다.

## 확인 범위

`verify-shots/monster-redraw-all/SUMMARY.md`가 최신 근거다. 연락판과 전체 포즈판을 직접
검토하고, 소스 재생성 픽셀·PNG 재로드·초상 일치·여백·팔레트·중복·해시·ID·내보내기
참조를 확인한다. 수치 확인만으로 그림이 좋거나 사용자 승인을 받았다고 결론내리지 않는다.

실제 플레이어 확인은 `player.html` + export shim 전용 경로에서 한다. 전 종 이미지 디코드와
7가지 이동 방식 대표 종의 실제 공격·피격을 구분한다. 강제 칸 표시와 실제 행동 계측도
구분한다. 죽음 칸 선택이 관측됐다고 해서 모든 종의 쓰러짐이 여러 프레임 유지된다는 뜻은 아니다.

공용 코드·에셋 작업이다. 사용자 SQLite 프로젝트를 저장한 것으로 보고하지 않는다.
전체 테스트·게이트는 실행하지 않는다. 후속 사용자 요청으로 현재 그림의 커밋·PR·머지를 진행하며,
실제 전투의 소리 포함 녹화는 `scripts/qa/runtime/monster-battle-av.mjs`를 쓴다.
독립 Xvfb 화면과 Pulse 출력 모니터를 함께 캡처하므로 플레이어가 낸 BGM·타격음이 그대로 들어간다.
