// 몬스터 게임 요청 분류 표본 점검. bun scripts/qa/poke-audit-fix/classify-probe.mts
import { classifyMonsterGameRequest, requestsEmeraldMonsterGame } from '../../../src/ai/piAgent/monsterGameRequest';
const positive: readonly string[] = [
  '포켓몬 같은 몬스터 수집 게임 만들어 줘',
  '바다 마을에서 시작하는 몬스터 수집 RPG, 체육관 3개, 배지를 모으면 챔피언',
  '내 몬스터 한 마리가 진화하며 라이벌과 경쟁하는 짧은 포켓몬 라이크, 낚시와 HM 로 길을 여는 구조',
  '포켓몬 라이크 만들어 줘', 'RPG 몬스터 수집 게임', '포켓몬 라이크', '포켓몬 같은 RPG', '포켓몬 라이크 RPG 하나',
  'pokemon-like game', 'a pokemon like RPG', '몬스터 수집 RPG',
];
const negative: readonly string[] = [
  '연애 시뮬레이션 RPG 만들어 줘', '일반 RPG 게임 만들어 줘', '용사가 마왕을 쓰러뜨리는 RPG', '몬스터 헌터 같은 RPG 만들어 줘',
  '좀비 서바이벌 RPG', '포켓몬 게임 어떻게 만들어요?', '포켓몬 말고 연애 게임', '로그라이크 RPG 만들어 줘', '몬스터를 쓰러뜨리는 액션 RPG',
  '포켓몬 블랙 같은 게임 만들어', '포켓몬 NPC 추가해', '몬스터 상점 고쳐', '추리 RPG 만들어 줘', '카드 배틀 라이크 게임', 'I like pokemon cards', '포켓몬 RPG 추천해 줘', 'recommend a pokemon RPG', '소울라이크 몬스터 헌터 게임',
];
let bad = 0;
for (const [label, list, want] of [['POS', positive, true], ['NEG', negative, false]] as const) {
  for (const text of list) {
    const blank = classifyMonsterGameRequest(text, true), non = classifyMonsterGameRequest(text, false);
    const got = blank !== null || non !== null || requestsEmeraldMonsterGame(text);
    if (got !== want) bad += 1;
    console.log(`${got === want ? 'ok  ' : 'FAIL'} ${label} blank=${blank} nonblank=${non} emerald=${requestsEmeraldMonsterGame(text)}  ${text}`);
  }
}
console.log(bad ? `${bad} mismatches` : 'all ok');
process.exit(bad ? 1 : 0);
