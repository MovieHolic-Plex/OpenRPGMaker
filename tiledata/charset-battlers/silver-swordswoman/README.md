# 은발 여검사 — 직접 찍은 전투 도트

2026-10-03 사용자 요청에 따라 원본 이미지 없이 최종 48×48 격자에 직접 저작했다.
은발 긴 머리, 붉은 망토와 분할 코트, 강철 갑옷, 청동 장식, 한손검을 가진 여검사다.
얼굴·머리카락·갑옷·팔다리·검의 윤곽과 색 면은 아래 Python의 정수 좌표가 원본이다.
생성형 이미지, 기존 캐릭터 픽셀 복사, 트레이싱, 큰 그림 축소, 회전 합성을 사용하지 않았다.

## 재현

```bash
python3 scripts/asset-gen/charset-battler/silver-swordswoman.py
```

- 원본 코드: `scripts/asset-gen/charset-battler/silver-swordswoman.py`.
- 원본 포즈: 이 폴더의 24 PNG와 `cast/`의 21 PNG, 모두 48×48.
- 배포 전투 시트: `public/assets/generated/charset-battlers/silver-swordswoman.png` (144×384).
- 배포 시전 시트: `public/assets/generated/charset-battlers/cast/silver-swordswoman.png` (144×336).
- 공용 ID: `charset-battler-silver-swordswoman`.
- 피커 이름: **손 도트 전투 · 은발 여검사**. 배우의 전투 캐릭터셋에서 명시 선택한다.
- 독립 전투 그림이므로 기존 걷기 칩과 자동으로 연결하지 않는다.

## 계약과 확인

포즈 순서는 `src/battle/battlePose.ts`의 24포즈 및 CAST_TYPES 7종×3단계와 같다.
왼쪽 보기, 마지막 불투명 행 y=44, 16색, 알파 0/255. 관절 좌표를 바꿔 각 자세를 다시 그린다.
전투 불능 칸은 별도 누운 그림이다. 시전 종류마다 손의 작은 빛 색을 바꾼다.
배포 PNG를 다시 열어 크기·색·알파·전체 칸 경계를 확인하며, 실제 RM2003 화면 증거는
`verify-shots/silver-swordswoman/SUMMARY.md`에 있다. 확인판 확대만 nearest-neighbour를 사용한다.

출처: OPRN 프로젝트에서 직접 저작한 픽셀 그림. 외부 이미지 소재를 포함하지 않는다.
기존 저장소 코드·에셋 정책을 따른다.
