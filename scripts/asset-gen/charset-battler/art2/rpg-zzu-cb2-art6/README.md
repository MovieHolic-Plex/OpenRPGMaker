# Actor4 담당 여섯 명의 시전 2차 도트

담당: `actor4-2` ~ `actor4-7`. `Actor4.png`의 1:1 도트를 부위별로 조립하고 팔·손·무릎을 다시 찍었다. AI 생성 캐릭터 그림은 사용하지 않는다. 공용 도구와 런타임 파일은 변경하지 않는다.

## 변경

- 6명 × 7종 × 3단계 = **126개 시전 셀**과 배포 시트 6장.
- 화염: 허리 뒤로 모으기 → 가슴에 포개기 → 앞발과 함께 밀기.
- 냉기: 교차 팔 → 위아래로 펼치기 → 머리 위와 앞쪽으로 손을 분리.
- 번개: 무릎 굽히기·팔 뒤로 → 수직 팔 → 앞 아래로 내려찍기.
- 치유: 고개 숙인 기도 → 두 팔 위옆으로 → 한 손으로 빛 건네기.
- 어둠: 낮게 웅크린 갈퀴손 → 뒤로 휘감기 → 앞으로 갈퀴손 찌르기.
- 비전: 앞에서 세우기 → 머리 위로 회전 → 앞으로 겨누기. 검 사용자는 빈손으로 수행.
- 보조: 손목 들기 → 옆으로 쓸기 → 입 앞의 손바닥에서 불기.
- 빛은 손 주위 4픽셀 이내, 1~7픽셀. 투사체 없음. 캐릭터별 전투·시전 전체를 합쳐 추가색 6색.
- 무기는 기존 직업 판정을 유지: 2번 검, 3·4·6·7번 지팡이, 5번 검·방패. 마법사가 검을 든 경우는 없었다.
- 걷기 18칸에서 사라지던 무기를 복원. 원본 세 걸음의 발·골반은 유지하고 팔과 무기 파지를 다시 저작했다.
- 기존 공통 영창 3칸도 비전 시전 3칸으로 교체해 손에서 무기가 사라지지 않게 했다.
- 전투 시트의 무기·장식·빛 색을 원본 팔레트로 정리했다. 새 색 여섯 개는 시전 빛에만 쓴다.
- 공격 예비 → 중간 → 착탄 → 마무리의 기존 관절/전방 타격 연속은 확인 후 유지했다. 실제 접근 이동은 런타임 담당 범위다.

## 생성물

각 `tiledata/charset-battlers/<id>/` 아래:

- `cast_<type>_<1|2|3>.png`: 48×48 시전 원본.
- `_cast_board.png`: 공용 빌더의 7행×3열 확인판.
- `_cast.gif`: 화염 → 냉기 → 번개 → 치유 → 어둠 → 비전 → 보조, 총 21프레임, 프레임당 160ms, nearest 4배. 상단 20px 이름표 포함 192×212.
- `_cast_motion.png`: 같은 21칸을 마법마다 가로 세 칸으로 나눈 정지 확인판.
- `_cast_parallel.gif`: 7종을 가로로 나란히 비교하는 3프레임, 1344×212, 프레임당 160ms.
- `_board.png`, `_motion.*`, `_motion_detail.png`: 변경된 전투 칸을 반영한 기존 증거 갱신.

배포 시트는 `public/assets/generated/charset-battlers/<id>.png`(144×384)와 `cast/<id>.png`(144×336)이다.

## 재현

```sh
python3 scripts/asset-gen/charset-battler/art2/rpg-zzu-cb2-art6/draw.py
python3 scripts/asset-gen/charset-battler/build_cast.py actor4-2 actor4-3 actor4-4 actor4-5 actor4-6 actor4-7
python3 scripts/asset-gen/charset-battler/build.py actor4-2 actor4-3 actor4-4 actor4-5 actor4-6 actor4-7
python3 scripts/asset-gen/charset-battler/art2/rpg-zzu-cb2-art6/verify.py
```

`draw.py actor4-3`처럼 한 명만 저작할 수 있다. 전체 `audit.json`과 `verification.json`을 만들 때는 인자 없이 여섯 명 모두 생성한다. 1차 스크립트의 부위·무기 드로잉 함수를 읽기 전용으로 재사용한다.

## 검증

- 공용 `build_cast.py`, `build.py` 여섯 명 모두 **통과 / exit 0**.
- `verify.py` **exit 0**: 저장된 270칸을 다시 읽어 48×48, 알파 0/255, 마지막 불투명 행 정확히 y=44, 팔레트 추가색 6개 이하 확인.
- 배포 시트의 270개 셀이 각 원본 PNG와 픽셀 단위로 일치.
- 캐릭터마다 21개 시전 픽셀 데이터와 알파 실루엣이 모두 서로 다름. 추가색 빛 도트의 손 주변 범위 및 가장자리 잘림 없음 확인.
- `_cast.gif` 6개 각각 21프레임·160ms·nearest 4배 확인. GIF를 디코딩해 원본 확대 PNG와 RGB 완전 일치 확인.
- 6명의 최종 `_cast_board.png` 및 `_board.png`를 직접 열어 시각 검토. 검토 중 번개·냉기·치유의 과도한 팔 길이와 검끝 잘림을 수정했다.
- 사용자 지정 타입 검사 `NODE_OPTIONS=--max-old-space-size=12288 npx tsc -p tsconfig.app.json --noEmit`를 마지막에 한 번 실행: 출력 오류 없음, **exit 0**(파이프 없음).
- JSON 측정 근거: `audit.json`(손/무기/빛 좌표), `verification.json`(저장 파일 재로드 결과).

이번 작업은 공용 그림 파일 저작이며 프로젝트 맵·이벤트 저장 작업이 아니다. 실제 전투의 좌우 배치·접근 이동·투사체 제거·시전 종류 선택 배선 및 브라우저 통합 QA는 이 담당 범위 밖이다. 프로젝트 SQLite/외부 DB는 수정하지 않았다. 전체 테스트·게이트·stash는 실행하지 않았다.

## 출처와 라이선스

- 캐릭터 원본: VictorSena (2023), `public/assets/easyrpg/charset/Actor4.png`, CC BY 4.0. [작가](https://vashmaker.blogspot.com/p/works.html).
- 무기 형태 참고: russidan (Alephman) (2010), `public/assets/easyrpg/battle-weapon/Weapon.png`, CC BY. 1차 작가가 참고해 저작한 검·지팡이 함수를 재사용했다.
- 출처 정본: `public/assets/easyrpg/AUTHORS.md`. 파생 도트와 확인판도 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
