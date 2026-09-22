# Slates 작업을 시작하는 에이전트에게

이 페이지가 **지속 보관되는 Slates 학습 자료의 진입점**이다. 이전 대화나 브라우저 세션 없이 아래 파일을 읽는다. 이미지도 저장소에 함께 보관한다.

## 필수 읽기 순서

**새 저작은 [단계별 조립 지침](slates-assembly-playbook.md)부터 시작한다.** 이 문서의 실습과 카탈로그 해독을 먼저 마친다. 아래 자료 전체 열람량은 완성도 점수가 아니다.

1. [구조 학습·교정](slates-structure-learning.md): 좌표 단위, 깊은 지붕, 돌출층, 성벽 단면, 남은 오차.
2. [구조 표본 40개](slates-structure-samples.md): 각 비교 PNG와 부품 번호판을 실제로 연다.
3. [원본 전체 46구역](slates-atlas-review.md): 1,232슬롯의 번호판과 사용 규칙.
4. [저작·레이어·통행·저장](slates-village-authoring.md): 구조를 새 맵에 적용하는 계약.
5. 필요 시 [초기 연구](slates-study.md). 초기 단순 주택 마을은 성곽 마을의 품질 기준이 아니다.

사람이 볼 때에는 [이미지 HTML 도감](../reports/slates-mastery/index.html)을 연다. HTML만 남긴 것이 아니라 Markdown, PNG, JSON 원본을 함께 보관했다.

## 파일과 의미

| 파일 | 역할 |
|---|---|
| `openwiki/images/slates/mastery/*.png` | 구조 비교판·원본 부품 번호판·46개 구역 그림 |
| `public/assets/slates/slates-mastery-catalog.json` | 표본 규칙, 검토 상태, 원본 사각형과 파생 타일 레시피 |
| `public/assets/slates/slates-mastery-fine-recipes.json` | 16/8px 부품 출처·합성 위치 |
| `public/assets/slates/slates-study-catalog.json` | 지형·소품·초기 조립 근거 |
| `public/assets/slates/slates-v2-32px.png` | 원본 v2: 56열, 32px, 1,232칸 |
| `public/assets/slates/slates-v1-32px.png` | 원본 v1: 48열, 32px |
| `public/assets/ATTRIBUTION.md` | Ivan Voirol, CC BY 4.0, 변경 표기 |

원본 버전, 픽셀 사각형, 그리는 순서를 출처로 남긴다. 참고 이미지의 픽셀을 잘라 새 맵에 붙이지 않는다. 관찰 스탬프에는 배경이 섞여 있고 통행도 미저작이다. 특히 `hold` 성문을 완성 키트로 사용하지 않는다. 조립이 불확실하면 검토 후 수정하거나 한계를 기록한다.

## 새 맵의 완료 조건

새 map/tileset ID로 기존 콘텐츠를 보존한다. 배치·레이어·충돌을 저작하고 실제 맵 PNG로 구조를 확인한다. LegacyDb 연결을 먼저 확인한 뒤 저장/재로드 일치를 증명한다. 저장 담당과 저작 담당이 나뉘어도 최종 작업은 원격 저장 전 완료가 아니다.

## 문서만 전달하는 독립 실험

[GPT 6 Astra Medium 실험 계약](../docs/experiments/slates-astra/README.md)은 대화 이력을 전달하지 않고 위 자료만으로 새 50×50 성곽 마을을 만드는 절차다. 입력 해시·프롬프트·산출물·실제 저장 증거를 구분한다. 문서의 부족함도 결과에 기록하며 감독자가 배치를 대신 만든 뒤 독립 결과라고 부르지 않는다.
