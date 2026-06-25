-- MCGA (Make Chosun Great Again) 초기 스키마 + 시드.
-- 자체 호스팅 Supabase (192.168.100.121)에 schema mcga 로 분리.
-- 부모 리포의 rpg_zzu 스키마 패턴과 동일 (REST 직접 접근, anon-key).

CREATE SCHEMA IF NOT EXISTS mcga;

-- ── 테이블 ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mcga.seasons (
  id           serial PRIMARY KEY,
  start_at     timestamptz NOT NULL DEFAULT now(),
  end_at       timestamptz,
  winner       text  -- FactionId
);

CREATE TABLE IF NOT EXISTS mcga.nations (
  id            text PRIMARY KEY,           -- FactionId: chosun/myung/yeojin/wae/ryukyu/annam/champa/mongol
  name          text NOT NULL,
  color         text NOT NULL,              -- SVG 색
  king_id       text,
  capital_id    text,
  archetype     text NOT NULL DEFAULT '',
  eliminated    boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS mcga.kings (
  id            text PRIMARY KEY,
  nation_id     text NOT NULL REFERENCES mcga.nations(id) ON DELETE CASCADE,
  name          text NOT NULL,              -- 역사적 왕 이름
  personality   text NOT NULL,              -- cruel/benevolent/paranoid
  is_bot        boolean NOT NULL DEFAULT true,
  alive         boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS mcga.users (
  id            text PRIMARY KEY,
  nickname      text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mcga.subjects (
  id            text PRIMARY KEY,
  nation_id     text NOT NULL REFERENCES mcga.nations(id) ON DELETE CASCADE,
  user_id       text REFERENCES mcga.users(id) ON DELETE SET NULL,  -- null = 봇
  nickname      text NOT NULL,
  office        text NOT NULL,              -- interior/military
  territory_id  text,
  fame          integer NOT NULL DEFAULT 0,
  is_bot        boolean NOT NULL DEFAULT true,
  alive         boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS mcga.territories (
  id            text PRIMARY KEY,
  nation_id     text REFERENCES mcga.nations(id) ON DELETE SET NULL,  -- null = 미개척
  name          text NOT NULL,
  population    integer NOT NULL DEFAULT 1000,
  grain         integer NOT NULL DEFAULT 500,
  troops        integer NOT NULL DEFAULT 100,
  combat_power  integer NOT NULL DEFAULT 50,
  q             integer NOT NULL,           -- 헥스 axial 좌표
  r             integer NOT NULL
);

CREATE TABLE IF NOT EXISTS mcga.wars (
  id                text PRIMARY KEY,
  attacker_nation   text NOT NULL REFERENCES mcga.nations(id),
  defender_nation   text NOT NULL REFERENCES mcga.nations(id),
  territory_id      text NOT NULL REFERENCES mcga.territories(id),
  status            text NOT NULL DEFAULT 'active',  -- active/resolved
  attacker_troops   integer NOT NULL,
  created_tick      integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mcga.event_logs (
  id                    bigserial PRIMARY KEY,
  season_id             integer NOT NULL REFERENCES mcga.seasons(id) ON DELETE CASCADE,
  tick_at               integer NOT NULL DEFAULT 0,
  type                  text NOT NULL,    -- invasion/famine/rebellion/...
  payload               jsonb NOT NULL DEFAULT '{}'::jsonb,
  affected_subject_ids  text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS mcga.short_tickets (
  id              text PRIMARY KEY,
  subject_id      text NOT NULL REFERENCES mcga.subjects(id) ON DELETE CASCADE,
  event_id        bigint NOT NULL REFERENCES mcga.event_logs(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending',  -- pending/resolved
  chosen_action   text,                              -- ActionKind
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mcga.world_state (
  id          int PRIMARY KEY DEFAULT 1,
  season_id   integer NOT NULL REFERENCES mcga.seasons(id),
  tick        integer NOT NULL DEFAULT 0,
  CONSTRAINT world_state_singleton CHECK (id = 1)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_territories_nation ON mcga.territories(nation_id);
CREATE INDEX IF NOT EXISTS idx_subjects_nation ON mcga.subjects(nation_id);
CREATE INDEX IF NOT EXISTS idx_subjects_user ON mcga.subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_events_season_tick ON mcga.event_logs(season_id, tick_at);
CREATE INDEX IF NOT EXISTS idx_shorts_subject_status ON mcga.short_tickets(subject_id, status);

-- RLS: 자체 호스팅/anon-key 모델 (부모 리포와 동일). 프로덕션 전환 시 조정.
ALTER TABLE mcga.nations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcga.kings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcga.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcga.subjects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcga.territories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcga.wars           ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcga.event_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcga.short_tickets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcga.seasons        ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcga.world_state    ENABLE ROW LEVEL SECURITY;

-- MVP: anon/authenticated/service_role 전부 허용 (부모 패턴).
DO $$
BEGIN
  PERFORM 1 FROM pg_policies WHERE schemaname='mcga' AND policyname='anon_all' LIMIT 1;
  IF NOT FOUND THEN
    -- nations
    EXECUTE 'CREATE POLICY anon_all ON mcga.nations FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY anon_all_k ON mcga.kings FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY anon_all_u ON mcga.users FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY anon_all_s ON mcga.subjects FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY anon_all_t ON mcga.territories FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY anon_all_w ON mcga.wars FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY anon_all_e ON mcga.event_logs FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY anon_all_st ON mcga.short_tickets FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY anon_all_se ON mcga.seasons FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY anon_all_ws ON mcga.world_state FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ── 시드: 시즌 1 ────────────────────────────────────────

INSERT INTO mcga.seasons (id, start_at) VALUES (1, now())
  ON CONFLICT (id) DO NOTHING;

INSERT INTO mcga.world_state (id, season_id, tick) VALUES (1, 1, 0)
  ON CONFLICT (id) DO NOTHING;

-- ── 시드: 8개 역사 세력 + 왕 ─────────────────────────────
-- 색상은 대략 동아시아 지도 색감. 성격은 MVP 3종만 사람 진입 가능 세력에, 나머진 임의.

INSERT INTO mcga.nations (id, name, color, archetype) VALUES
  ('chosun',  '조선',   '#3b6fd4', '균형·방어 강함. 이순신/거북선'),
  ('myung',   '명',     '#c0392b', '거대 제국. 조공 요구, 느슨한 종주권'),
  ('yeojin',  '여진',   '#7f8c8d', '기병 우세, 약탈 강함 (훗날 청)'),
  ('wae',     '왜',     '#e67e22', '해전/침략 공격적 (임진왜란 주적)'),
  ('ryukyu',  '류큐',   '#16a085', '교역/외교 강함, 군 약함'),
  ('annam',   '안남',   '#27ae60', '게릴라 방어, 쌀 생산'),
  ('champa',  '참파',   '#8e44ad', '해상 교역 소국'),
  ('mongol',  '몽골',   '#d35400', '기병 최강, 내란 많음')
ON CONFLICT (id) DO NOTHING;

-- 왕 (전부 코드 봇 — STEP 3에서 사람 있는 세력만 LLM 왕으로 전환)
INSERT INTO mcga.kings (id, nation_id, name, personality, is_bot) VALUES
  ('k_chosun', 'chosun', '세종',     'benevolent', true),
  ('k_myung',  'myung',  '가정제',   'paranoid',   true),
  ('k_yeojin', 'yeojin', '누르하치', 'cruel',      true),
  ('k_wae',    'wae',    '도요토미', 'cruel',      true),
  ('k_ryukyu', 'ryukyu', '쇼타이왕', 'benevolent', true),
  ('k_annam',  'annam',  '레러안',   'paranoid',   true),
  ('k_champa', 'champa', '포흐느',   'benevolent', true),
  ('k_mongol', 'mongol', '다얀칸',   'cruel',      true)
ON CONFLICT (id) DO NOTHING;

UPDATE mcga.nations SET king_id = sub.king_id FROM (
  VALUES ('chosun','k_chosun'),('myung','k_myung'),('yeojin','k_yeojin'),('wae','k_wae'),
         ('ryukyu','k_ryukyu'),('annam','k_annam'),('champa','k_champa'),('mongol','k_mongol')
) AS sub(nid, king_id) WHERE nations.id = sub.nid;

-- ── 시드: 30개 헥스 고을 ─────────────────────────────────
-- 동아시아 지리 근사 배치. 헥스 axial(q,r). q=동(+)/서(-), r=남(+)쪽으로 대략.
-- 각 세력 수도는 별도, 주변 고을 2~4개.

INSERT INTO mcga.territories (id, nation_id, name, population, grain, troops, combat_power, q, r) VALUES
  -- 조선 (반도, 중앙-약간 동) — 4고을
  ('hanseong',  'chosun', '한성',   2000, 800,  250, 60,  3, -1),
  ('pyongyang', 'chosun', '평양',   1500, 600,  180, 55,  2, -2),
  ('busan',     'chosun', '부산',   1200, 500,  300, 70,  4,  0),  -- 거북선 해전 강함
  ('gangneung', 'chosun', '강릉',   900,  400,  120, 50,  4, -2),
  -- 명 (서북 거대) — 5고을 (가장 영토 많음)
  ('beijing',   'myung',  '북경',   3000, 1200, 400, 65, -2, -3),
  ('nanjing',   'myung',  '남경',   2500, 1000, 280, 60, -1, -2),
  ('xian',      'myung',  '서안',   1800, 700,  200, 55, -4, -3),
  ('guangzhou', 'myung',  '광주',   1600, 900,  150, 50, -2,  1),
  ('chengdu',   'myung',  '성도',   1400, 800,  160, 55, -4, -1),
  -- 여진 (북방) — 3고을
  ('ninguta',   'yeojin', '흑도아', 800,  300,  350, 75,  0, -4),  -- 기병 강함
  ('shenyang',  'yeojin', '심양',   1000, 400,  300, 70,  1, -3),
  ('haixi',     'yeojin', '해서',   700,  250,  280, 72, -1, -4),
  -- 왜 (동쪽 섬) — 3고을
  ('edo',       'wae',    '에도',   1800, 700,  320, 68,  6, -1),
  ('osaka',     'wae',    '오사카', 1500, 600,  280, 65,  5,  0),
  ('hakata',    'wae',    '하카타', 1000, 400,  350, 75,  5,  1),  -- 해전 강함 (부산 침공 기지)
  -- 류큐 (남쪽 섬) — 2고을
  ('naha',      'ryukyu', '나하',   600,  350,  80,  40,  5,  3),
  ('shuri',     'ryukyu', '수리',   500,  300,  60,  38,  6,  3),
  -- 안남 (극남) — 3고을
  ('hanoi',     'annam',  '하노이', 1400, 900,  200, 62, -1,  4),
  ('hue',       'annam',  '후에',   1000, 700,  180, 60,  0,  5),
  ('saigon',    'annam',  '사이공', 1100, 1000, 150, 55,  1,  6),  -- 쌀 생산 높음
  -- 참파 (베트남 남부) — 2고을 (소국)
  ('indrapura', 'champa', '인드라푸라', 700, 400, 100, 45, 1, 5),
  ('vijaya',    'champa', '비자야',     600, 350,  90, 43, 2, 6),
  -- 몽골 (북쪽 초원) — 3고을
  ('karakorum', 'mongol', '카라코룸', 900,  300, 380, 78, -1, -6),
  ('ordos',     'mongol', '오르도스', 800,  250, 340, 76, -2, -5),
  ('liaoyang',  'mongol', '요양',    850,  280, 320, 74,  0, -5),
  -- 미개척 버퍼 (무주공산) — 3고을
  ('jeju',      NULL,     '탐라',   300,  200,  20,  20,  3,  2),
  ('tsushima',  NULL,     '쓰시마', 200,  150,  30,  25,  5, -1),
  ('khabarovsk',NULL,     '북만',   250,  180,  40,  30,  2, -5),
  ('taiwan',    NULL,     '대만',   280,  200,  25,  22,  4,  3)
ON CONFLICT (id) DO NOTHING;

-- 수도 지정
UPDATE mcga.nations SET capital_id = sub.cap FROM (
  VALUES ('chosun','hanseong'),('myung','beijing'),('yeojin','ninguta'),('wae','edo'),
         ('ryukyu','naha'),('annam','hanoi'),('champa','indrapura'),('mongol','karakorum')
) AS sub(nid, cap) WHERE nations.id = sub.nid;

-- ── 시드: 봇 신하 (각 세력에 영의정+병조판서) ─────────────
-- STEP 1에선 전원 봇. STEP 2에서 사람 진입 시 교체.
INSERT INTO mcga.subjects (id, nation_id, nickname, office, territory_id, is_bot)
SELECT
  'bot_' || n.id || '_int', n.id, n.name || ' 영의정', 'interior',  n.capital_id, true
FROM mcga.nations n
ON CONFLICT (id) DO NOTHING;

INSERT INTO mcga.subjects (id, nation_id, nickname, office, territory_id, is_bot)
SELECT
  'bot_' || n.id || '_mil', n.id, n.name || ' 병조판서', 'military', NULL, true
FROM mcga.nations n
ON CONFLICT (id) DO NOTHING;

-- ── 세계 틱: pg_cron 으로 5분마다 bot-step 함수 호출 ─────
-- 자체 호스팅 Supabase에 pg_cron 확장 필요:
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   SELECT cron.schedule('mcga-tick', '*/5 * * * *', ...
-- 실제 틱 로직은 Edge Function bot-step 에서 수행 (여기선 스케줄 등록만).
-- 스키마 한정을 위해 net.http_post 또는 pg_net 필요.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('mcga-tick');
    -- Edge Function 호출 (pg_net 이 있을 때). 없으면 no-op.
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
      PERFORM cron.schedule(
        'mcga-tick',
        '*/5 * * * *',
        $$SELECT net.http_post(
          url := current_setting('app.mcga_function_baseurl', true) || '/bot-step',
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := jsonb_build_object('source', 'cron')
        );$$
      );
    END IF;
  END IF;
END $$;
