# 갓파 기본 자세 재저작 초안

2026-10-03 사용자가 공용 몬스터 139종 리프레시 그림을 반려한 뒤, 갓파부터 다시 그린 단일 자세 초안이다.
사용자는 이 그림에 “오 괜찮은데”라고 답하고 다른 몬스터 몇 종 추가 제작을 요청했다.
기본 그림에 대한 긍정 평가이며, 전체 139종이나 갓파 9포즈의 승인이 아니다.
이후 전투 에셋 요청으로 같은 기본 그림의 9포즈·공용 시트·초상을 배선했다.
후속 결과는 `tiledata/monster-battle-four/README.md`, `verify-shots/monster-battle-four/SUMMARY.md`를 본다.

- 원본: `scripts/asset-gen/pixel-enemy/kappa-redraw-draft.py`.
- `kappa-native.png`: 직접 저작한 투명 64×64px 원본, 정수 픽셀·알파 0/255.
- `kappa-study-6x-v3.png`: 같은 원본의 nearest 6배 확대, 단색 배경.
- `kappa-study-3x-v3.png`: 같은 원본의 nearest 3배 확대.
- 최종 격자에 체형·등껍질 조각·물접시·얼굴·물갈퀴 손발을 직접 배치한다.
- 공용 휴머노이드 템플릿, 생성형 이미지 모델, 원본 이미지 입력이나 큰 그림 축소를 쓰지 않는다.
- `pixels.json`은 원본 PNG 재로드·색 수·알파·경계 기록이다. 그림 품질 승인 근거는 아니다.

재생성: `python3 scripts/asset-gen/pixel-enemy/kappa-redraw-draft.py`.
이 폴더는 기본 그림의 검토 이력이다. 후속 갓파 9포즈 결과가 전체 139종 재저작 완료를 뜻하지 않는다.
