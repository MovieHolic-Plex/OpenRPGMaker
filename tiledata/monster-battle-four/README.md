# 갓파·늑대·박쥐·해골 전사 전투 에셋

갓파 기본 그림에 대한 사용자 긍정 평가 후 세 종을 추가로 그렸고, 이어서 요청한
전투용 포즈를 네 종류 모두 제작했다. 이전 139종 일괄 초안의 품질 반려는 별도 기록이다.
이 네 종류의 전투 에셋 제작이 나머지 135종의 그림 승인을 뜻하지 않는다.

## 파일과 재생성

```bash
python3 scripts/asset-gen/pixel-enemy/build-study-battles.py
```

| 리소스 ID | 그림 원본 함수 | 공격 이동 유형 |
|---|---|---|
| generated-enemy-kappa-01 | `kappa-redraw-draft.py`의 `draw` | stomp |
| generated-enemy-wolf-grey | `monster-redraw-studies.py`의 `wolf` | dash |
| generated-enemy-bat-cave | `monster-redraw-studies.py`의 `bat` | swoop |
| generated-enemy-skeleton-knight | `monster-redraw-studies.py`의 `skeleton` | stomp |

모션 원본은 같은 폴더의 `study_motion.py`이다. 완성된 비트맵을 회전/이동하지 않고,
종별 부위의 정점과 얼굴 픽셀 좌표를 관절에 따라 바꾼 뒤 최종 64px 격자에 다시 찍는다.
쓰러짐은 네 종류 모두 별도의 직접 저작이다. 생성형 이미지나 그림 축소를 사용하지 않는다.

- 공개 전투 시트: `public/assets/generated/pixel-enemies/<slug>.png`, 192×192px.
- 기본 초상: `public/assets/generated/pixel-enemy-portraits/<slug>.png`, 64×64px.
- 투명 원본 9칸: `tiledata/monster-refresh/<slug>/<pose>.png`.
- 보기용 포즈 표와 GIF: `verify-shots/monster-battle-four/`.
- 기본 자세는 직전 갓파/세 종 초안의 픽셀과 완전히 같다.
- 원본 알파 0/255, 실제 포즈 팔레트 22/15/17/16색, 접지 y60.
- 셀 순서는 idle_a / idle_b / idle_c, windup / move / attack, recover / hit / dead.

## 공용 배선

공용 ID와 경로를 그대로 사용한다. 늑대와 해골은 기존 48px에서 **64px 셀**로 바꿨고,
`pixelEnemySheets.ts`와 재생성 manifest를 함께 갱신했다. 기존 개별/retirement 명령도
registry에서 이 네 종의 새 원본을 부르므로 이전 초안으로 되돌아가지 않는다.
초상·접촉 경계·자료집 설명/이미지 해시·PWA 캐시 v8도 함께 갱신했다.
일반 타격 이펙트와 효과음은 기존 RM2003 전투 시스템을 사용한다.

## 확인 범위

최종 36칸과 시트/초상을 저장 후 재로드하여 원본 일치, 기본 그림 보존, 여백·알파·팔레트·
포즈별 그림 차이를 확인한다. 직접 검토한 포즈 표와 기록은 `verify-shots/monster-battle-four/SUMMARY.md`.
실제 player.html 확인은 `runtime/SUMMARY.md`부터 읽는다. GIF는 저작 동작 미리보기이며 게임 녹화가 아니다.

공용 파일의 로컬 변경이며 커밋/PR/배포하지 않았다. 사용자 SQLite 프로젝트와 원격 저장소를 수정하지 않았다.
임시 QA fixture를 정본 프로젝트 저장으로 보고하지 않는다. 전체 gates/vitest/typecheck는 실행하지 않았다.
