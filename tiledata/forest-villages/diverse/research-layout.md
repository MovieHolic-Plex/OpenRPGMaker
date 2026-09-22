# 최근 연구를 이 타일 마을에 적용한 범위 (2026-09-23)

연구의 설계 원리를 16px 고정 조각에 맞게 적용했다. 원 논문의 학습 모델·유전 알고리즘·WFC 솔버·생태 시뮬레이터를 구현했다는 뜻은 아니다.

## 출처와 실제 적용

- Liu et al., **Controllable Procedural Generation of Landscapes**, ACM MM 2024. https://github.com/omegafantasy/ControllableLandscape / https://doi.org/10.1145/3664647.3681129 . 지형 계획→입구/관심점과 길→식생 배치라는 단계 분리를 참고했다. 여기서는 절벽/계단을 먼저 확정하고 입구·집 문앞·계단 착지칸을 A*로 연결한 뒤 도로 주변2칸을 예약한다. 맵 가장자리의 입구는 폭3, 안쪽5칸을 모두 접근점으로 검사한다.
- Villar López & Chover, **Procedural Generation of 3D Maps with Wave Function Collapse: Optimization and Advanced Constraints**, CEIG 2025. https://diglib.eg.org/handle/10.2312/ceig20251107 . 국소 타일 이웃 규칙과 비국소 제약을 함께 다루는 원리를 참고했다. 여기서는 좌우 절벽 열 문법·완전한 잔디 마감과 전체 엔진 통행 검사를 분리해 둘 다 통과해야 저장한다. WFC 엔트로피/전파/백트래킹은 사용하지 않는다.
- Wiegand et al., **Latitudinal scaling of aggregation with abundance and coexistence in forests**, Nature 2025. https://pubmed.ncbi.nlm.nih.gov/40011772/ . 여러 종의 공간 군집을 분석한 연구다. 시각 설계에는 균등 난수보다 군집과 빈터를 구분한다는 점만 참고했다. 실제 종별 생존·수분·생태 법칙을 재현하지 않는다.

## 실행할 입력과 수식

각 마을 지형 문서의 patches / clearings는 [cx,cy,rx,ry,strength] 목록이다.

1. 점 (x+0.5,y+0.5)에서 기존 forestContourScore(area,seed,coverage=0.48)를 계산한다. 기존 함수는 7.5칸 domain warp, 3옥타브 fBm, 큰 빈터와 작은 요철을 합성한다.
2. 각 patch는 strength*exp(-(((x-cx)/rx)^2+((y-cy)/ry)^2))를 더한다. clearing은 같은 값을 뺀다. 큰 덩어리와 빈터 위치는 설계 입력, 작은 굴곡은 seed로 재현한다.
3. score>0, lower=240, upper=-1, 예약 영역 아님, 아래2행 자유인 후보만 정렬한다. 전체 면적의48%를 상한으로 취한다. plateau 분류를 배제 조건으로 쓰지 않는다. 절벽 면 자체는 이미 상위가 차 있어 후보가 아니다.
4. 4방향 연결 성분이8칸 미만이면 제거한다. 47형 수관과 검수된 **3행 전체 몸통**을 맞춘다. 뿌리가 들어가지 않으면 노출 수관 행을 줄이고 재시도한다. 몸통을 자르거나 늘이거나 새 그림으로 바꾸지 않는다.
5. 숲 뒤에 소품과 독립 나무를 놓고, 모든 문앞/계단/부두/동굴/입구의 엔진 도달성을 검사한다. 소품이 접근 불가라면 그 소품만 철회한다.

절벽은 소음값을 타일마다 직접 반올림하지 않는다. points에 큰 굴곡의 골·돌출부를 먼저 지정하고 |dy|≤dx, 폭2 이상의 극값, 계단 폭2의 같은 높이를 지킨다. 높이5/6의 윗선·몸통·밑단을 같은 윤곽으로 연결한다. 두 이웃보다 혼자 낮게 튀어나온 한 열은 양쪽 마감이 충돌하므로 입력 오류다. 각 마을 문서의 cliffs.points와 전체 배열이 재현 입력/출력이다.

## 정정과 적용 범위

개정3의 ‘대지 내부에는 큰 숲을 놓지 않는다’ 및 ‘사선4칸을 놓다가 충돌하면 건너뛴다’는 규칙을 폐기한다. 전자는 직선 숲 경계를 만들고 후자는 /—\ 마감을 끊는다. 개정4는 complete crest를 한 번에 예약·조립하며 충돌시 중단한다.

이슬여울 및 큰 폭포 아래 마을 원본은 보존한다. 새 지역3종만 개정한다. 이는 공용 참고 지역/재현용 저작기이며 모든 AI 마을의 기본 프리셋을 일괄 교체하는 변경이 아니다. 실내·NPC·맵 이동 이벤트는 포함하지 않으며 입구는 타일 통행 출입구다.
