# 월드맵 · 사람 선택 아이콘

World / EasyRPG RTP를 바탕으로 만든 OPRN 월드맵 아이콘의 사람 선택 사본이다.
그림 라이선스: CC BY 4.0. 상세 출처는 `tiledata/worldmap-kit/ATTRIBUTION.md`.

- 앞 480칸: `public/assets/easyrpg-chipset-world-transparent.png`의 변경 없는 RGBA 사본.
- 뒤 칸: fantasy·desert-east·modern-sf 중 사람이 받은 원본72개와 고른 후보7개.
- 원본 PNG·선택 판/시도·원본 해시·현재 SHA256: `tiledata/worldmap-kit/selected/selected.json`.
- 처리: 16px 고정 칸 배치, 분홍 키 제거, 그림자 키를 검정 alpha80로 변환. 리샘플링·새 픽셀 저작 없음.
- 굽기 코드: `src/harnesses/worldmap-icons/bake.py` (저장소 코드 라이선스).

미선택·검수만 통과한 아이콘은 이 시트에 포함하지 않는다.

## 연결 지형 붓

`worldmap-authoring.png`는 현재 월드맵 키트 질감·숲·산 조각과 새 경계·길·다리 픽셀을 조립한
CC BY 4.0 파생물이다. 저작 원본은 `tiledata/worldmap-kit/authoring/pixels.json`,
빌드는 `scripts/content/build-worldmap-authoring.py`이며 상세 출처는 같은 키트의 `ATTRIBUTION.md`에 있다.
