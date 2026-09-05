# 생활 실동작 감사 / HTML 디자인 계약

## 분석과 적용 범위

HTML 작성 전에 src/styles/tokens.css와 데이터베이스의 Crop, Character,
LifeCrafting, DailyWeather, FarmAnimals, FarmSpatial, LifeCollections View의
실제 UI 구간을 읽었다. 제품은 DOM el() 조합, db-ws/db-life 접두사,
sectionCard/rowsCard/recordShell의 제목-힌트-필드 구성을 공유한다.
기존 토큰은 4px 기반 간격, 시스템 한글 글꼴, 의미별 danger/success 색,
쿨 화이트/인디고 화면이다. 보고서는 제품 UI를 재구현하지 않는다.
사용자 계약에 따라 별도 밝은 종이색 편집 문서로 구성하되 일관된 토큰과
제목-근거-조건 조합을 계승한다. 제품 CSS나 외부 의존성은 가져오지 않는다.

## 시각 토큰

- 색: paper #f5f1e8, surface #fffdf7, ink #282820, muted #615e54,
  line #d4cdbf, red #a33228, red-soft #f7e7df, green #286044,
  green-soft #e7eee4. 빨강은 결함/승인 보류, 초록은 관측된 실행만.
- 서체: 본문 Malgun Gothic / Apple SD Gothic Neo / Dotum / sans-serif.
  표제 Georgia / Batang / serif, 코드 ui-monospace / Consolas / monospace.
  외부 폰트 요청 없음. 본문 16px, 행간 1.8; 작은 글씨/캡션 14px.
  h1 56px(모바일 36px), h2 32px(모바일 28px), h3 24px, h4 18px.
- 간격: 4, 8, 12, 16, 24, 32, 48, 64, 96px. 본문 최대 폭 1184px,
  산문 폭 76ch. 데스크톱 좌우 여백 48px, 모바일 24px.
- 선 1px, 강조선 4px; 모서리 4px; 그림자/애니메이션 없음.
  초점선 2px red, offset 4px. 모든 시각 값은 CSS 토큰으로 정의.

## 구성과 기본 요소

큰 결론과 필드 실제 캡처를 좌우 비대칭으로 배치한다. 지표 스트립,
번호 목차, 증거 범례, 심각도별 발견사항, 실측 이야기, 7개 탭의
빈 상태/기존 저장본 비교, 51행 상세, 저장/날짜 도식, 테스트/한계/이력 순서.
발견사항은 열린 본문으로, 51행은 ID별 native details/summary로 제공한다.
원장의 각 행 전체(저작값/소비자, 트리거/조건, 저장)를 HTML에 보존한다.
기본 요소는 section-heading, callout, figure, pair, finding, feature, table.
하위 기능은 역할이 있는 dl, 일반 자료는 th scope가 있는 table을 쓴다.
색만으로 판정하지 않고 B-empty/B-loaded/B-play/S/T-현/U/H 문자를 동반한다.

## 반응형, 이미지, 접근성

900px 이하 표제와 도식은 세로, 640px 이하 이미지 비교는 세로로 바뀐다.
표는 모바일에서 행별 라벨을 유지하는 세로 카드로 읽히며 문서 넘침을 숨기지 않는다.
모든 캡처는 img, 고유 설명 alt, 원본 상대 링크, 출처/행동 한계 캡션을 갖는다.
비율을 자르지 않고 전체를 표시한다. 설명 도식은 캡처와 명시적으로 구별한다.
lang=ko, 랜드마크, 건너뛰기 링크, 가시적 키보드 초점, 의미 있는 제목 사용.
