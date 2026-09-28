# 걷기 칩 기반 전투 도트: art2

담당: `actor2-0`, `actor1-5`, `actor1-6`, `actor1-7`, `actor2-1`.

`draw.py`는 왼쪽 걷기 칩의 머리·얼굴·의복 무늬를 부위별로 잘라 사용한다.
팔과 무릎, 신발, 단검과 지팡이는 정수 격자에 `putpixel`로 그린다.
쓰러짐은 머리와 몸통을 각각 눕힌 뒤 구부린 사지를 별도로 구성한다.
캐릭터 원본을 확대하거나 통째 기울여 전투 포즈로 사용하지 않는다.
걷기 세 칸과 정면 한 칸은 요청대로 원본을 그대로 보존한다.

- actor2-0: 회색 머리 도적, 단검. 뒤쪽 준비→위쪽 휘두름→왼쪽 착탄→아래쪽 여운.
- actor1-5: 검정 마녀 모자·자주색 머리, 큰 수정 지팡이. 모자와 머리카락은 원본 픽셀.
- actor1-6: 검은 머리·푸른 로브, 작은 수정 지팡이. 원본 흰 소맷단과 앞섶 보존.
- actor1-7: 파란 모자·검은 머리, 작은 수정 지팡이. 낮은 자세의 로브 밑단을 무릎 위로 접음.
- actor2-1: 주황 머리·회색 옷. 직업은 원본 설명에 없으며 작은 단검을 저작 선택으로 사용.

재생성(저장소 루트에서):

```sh
python3 -B scripts/asset-gen/charset-battler/art/rpg-zzu-cb-art2/draw.py
python3 -B scripts/asset-gen/charset-battler/build.py actor2-0 actor1-5 actor1-6 actor1-7 actor2-1
python3 -B scripts/asset-gen/charset-battler/art/rpg-zzu-cb-art2/verify.py
```

`--manifest`는 사용하지 않는다. `draw.py`는 담당 외 id를 거절한다.
`source.png`는 원본 왼쪽 3칸/정면 1칸 확대 판독 자료다.
각 캐릭터 폴더의 `_motion.png`는 요청 순서의 16칸을 가로 한 줄로 놓은 4배 PNG,
`_motion.gif`는 같은 순서로 120ms씩 재생하는 4배 nearest GIF다.
`_motion_rows.png`는 같은 PNG를 동작별 다섯 줄로 접은 육안 검토용이다.
`_validation.json`은 실제 PNG/시트/GIF를 다시 열어 검사한 근거다.

공용 검사 도구는 y=45도 허용하고 빌드 전 알파를 이진화한다.
이 작업의 별도 검사는 원본 PNG 자체의 알파가 0/255이고 마지막 불투명 행이 정확히 y=44인지 확인한다.
공용 도구는 수정하지 않았다. 런타임 통합·manifest 갱신·정본 프로젝트 저장은 감독의 후속 범위다.

## 출처와 변경

모든 캐릭터 픽셀 원본은 저장소의 `public/assets/easyrpg/charset/Actor1.png`와
`Actor2.png`다. 생성형 그림이나 다른 캐릭터 이미지를 사용하지 않았다.
출처 목록: `public/assets/easyrpg/AUTHORS.md`.

- Actor1: Marina Navarro Travesset (base), VictorSena (edit), 2010/2023.
  https://muerteatartajo.blogspot.com / https://vashmaker.blogspot.com/p/works.html
- Actor2의 담당 1·2번째 캐릭터: VictorSena, 2023.
  https://vashmaker.blogspot.com/p/works.html
- 무기 모양 참고: `public/assets/easyrpg/battle-weapon/Weapon.png`, russidan (Alephman), 2010.
  본 작업의 단검·지팡이는 참고 그림을 본 뒤 새로 찍은 정수 격자 도트다.

라이선스: CC BY 4.0, https://creativecommons.org/licenses/by/4.0/ .
변경: 원본 부위 재배치, 새 팔·다리·무기·마법빛, 눈 감김, 전투 시트와 동작 증거 제작.
