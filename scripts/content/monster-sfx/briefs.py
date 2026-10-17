"""Sound briefs for the monster-collection genre default set.

`dur` is the hard duration window (seconds) enforced by qa.gate().
`rms` is the loudness target (dBFS, active part) applied after rendering.
`ref` names a comparison-only reference file (outside the repository) used to
rank candidates by whole-sound similarity of band balance / length / brightness.
`old` names what the sound is *today* for the inventory / A-B page.
"""

BRIEFS = {
    "ui-cursor": {
        "title": "메뉴 커서", "rank": 1, "dur": (0.03, 0.12), "rms": -24, "centroid": (1500, 5500), "max_trail": 40,
        "brief": "Menu cursor tick when the highlight moves. Heard 100+ times per hour: tiny, dry, friendly, never tiring. One or two ultra-short pulse blips; no tail.",
        "ref": "ref-ui-cursor", "old": "RTP Cursor1.wav (0.18s)",
    },
    "ui-confirm": {
        "title": "결정", "rank": 2, "dur": (0.07, 0.22), "rms": -22, "centroid": (1200, 5500), "max_trail": 50,
        "brief": "Menu confirm / select. A crisp two-note rising blip that says 'yes, done'. Bright pulse wave, short, a small sparkle is fine.",
        "ref": "ref-ui-confirm", "old": "RTP Decision1/2.wav (1.3s, much longer)",
    },
    "ui-cancel": {
        "title": "취소", "rank": 3, "dur": (0.08, 0.25), "rms": -22, "centroid": (600, 3500), "max_trail": 60,
        "brief": "Menu cancel / back. A short falling two-note blip, softer and lower than confirm, clearly its opposite.",
        "ref": "ref-ui-cancel", "old": "RTP Cancel1.wav (0.08s)",
    },
    "ui-error": {
        "title": "오류(못 함)", "rank": 13, "dur": (0.10, 0.32), "rms": -21, "centroid": (300, 2600), "max_trail": 60,
        "brief": "Invalid action buzz ('you can't do that'). Low square/pulse double buzz with a slight pitch dip. Polite, not alarming.",
        "ref": None, "old": "RTP Buzzer1.wav (0.32s)",
    },
    "hit-weak": {
        "title": "타격 · 효과가 별로", "rank": 4, "dur": (0.15, 0.50), "rms": -21, "centroid": (900, 4200), "max_trail": 80,
        "brief": "A weak/resisted physical hit in a creature battle: soft, short, a dull 'pff-tap'. Quiet noise tick plus a thin low blip. Clearly weaker than a normal hit.",
        "ref": "ref-hit-weak", "old": "RTP Damage2.wav (0.56s, volume 0.6 / pitch +22%)",
    },
    "hit-normal": {
        "title": "타격 · 보통", "rank": 5, "dur": (0.20, 0.65), "rms": -17, "centroid": (1200, 4800), "max_trail": 90,
        "brief": "A normal physical hit in a creature battle: punchy 'thwack'. Fast noise burst (7-bit or 15-bit register) layered with a downward-swept low pulse or triangle thump, a short decaying tail.",
        "ref": "ref-hit-normal", "old": "RTP Damage2.wav (0.56s)",
    },
    "hit-super": {
        "title": "타격 · 효과가 굉장", "rank": 6, "dur": (0.40, 1.30), "rms": -15, "centroid": (1200, 5200), "max_trail": 120,
        "brief": "A super-effective hit: bigger and more satisfying than a normal hit. Two impacts in quick succession (a second echoing hit about 60-110 ms later, lower), deeper thump, longer decaying noise tail.",
        "ref": "ref-hit-super", "old": "RTP Damage2.wav x2 (volume 1.3 / pitch -12%)",
    },
    "ball-shake": {
        "title": "포획 볼 흔들림", "rank": 7, "dur": (0.15, 0.45), "rms": -20, "centroid": (900, 4500), "max_trail": 80,
        "brief": "A capture ball wobbling on the ground: a hollow wooden-ish 'tok-kk' with a quick pitch drop and a tiny rattle. Plays three times in a row with pauses, so it must be short and repeatable.",
        "ref": "ref-ball-shake", "old": "무음",
    },
    "capture-success": {
        "title": "포획 성공", "rank": 8, "dur": (0.7, 2.0), "rms": -19, "centroid": (900, 4500), "max_trail": 150,
        "brief": "Capture succeeded: a happy, short jingle (about 1-1.5 s). Rising pulse-wave arpeggio ending on a held bright chord, a triangle bass note under it, a sparkle on top. Original tune; do not quote any known melody.",
        "ref": None, "old": "무음 (연출만)",
    },
    "level-up": {
        "title": "레벨 업", "rank": 9, "dur": (0.7, 1.9), "rms": -19, "centroid": (900, 4800), "max_trail": 150,
        "brief": "Level-up fanfare, about 1-1.4 s: quick rising major run into a held top note with a shimmer, answered by a low triangle. Rewarding and bright. Original tune; do not quote any known melody.",
        "ref": None, "old": "무음 (문장만)",
    },
    "faint": {
        "title": "기절", "rank": 10, "dur": (0.45, 1.5), "rms": -19, "centroid": (300, 3200), "max_trail": 150,
        "brief": "A creature faints: a long downward pitch fall (pulse then triangle) that slumps away, with a short noise puff at the start and a soft thud at the end. Sad but not scary.",
        "ref": "ref-faint", "old": "RTP Collapse2.wav (1.6s)",
    },
    "center-heal": {
        "title": "센터 회복 징글", "rank": 11, "dur": (1.2, 3.2), "rms": -20, "centroid": (800, 4200), "max_trail": 200,
        "brief": "Healing station jingle, 1.8-2.6 s: calm, warm, reassuring. A gentle ascending arpeggio of soft pulse (25%) and triangle that resolves to a hopeful chord, slight echo. Original tune; do not quote any known melody.",
        "ref": None, "old": "무음",
    },
    "encounter": {
        "title": "야생 조우 전환", "rank": 12, "dur": (0.45, 1.4), "rms": -18, "centroid": (700, 5000), "max_trail": 120,
        "brief": "Wild encounter screen transition: alarming but playful. Fast pulse arpeggio that sweeps upward in pitch, a burst of noise like a wipe, ending on a punchy accent as the battle begins.",
        "ref": None, "old": "무음",
    },
    "ball-throw": {
        "title": "포획 볼 던지기", "rank": 14, "dur": (0.15, 0.50), "rms": -22, "centroid": (900, 4800), "max_trail": 80,
        "brief": "Throwing a capture ball: a quick rising 'whoop' (pulse pitch sweeping up about an octave and a half in 0.15-0.25 s) with a faint breathy noise whisper underneath. Ends cleanly.",
        "ref": "ref-ball-throw", "old": "무음",
    },
    "ball-break": {
        "title": "포획 실패(볼이 깨짐)", "rank": 15, "dur": (0.30, 0.85), "rms": -18, "centroid": (900, 5200), "max_trail": 100,
        "brief": "The creature breaks out of the capture ball: a sharp 'pop' (noise burst with a click) followed by a short falling sparkle of 3-4 pulse notes. Cheeky, not harsh.",
        "ref": "ref-ball-break", "old": "무음",
    },

    "evolve-before": {
        "title": "진화 전(빛이 모임)", "rank": 20, "dur": (0.8, 1.8), "rms": -20, "centroid": (500, 4500), "max_trail": 150, "set": 2,
        "brief": 'Evolution begins: a creature starts to glow. A rising shimmer: slow upward pulse sweep (about two octaves over 1 s), soft triangle swell underneath, tiny sparkle ticks. Mysterious, anticipating. Original; no known melody.',
        "ref": None, "old": "무음 / 합성 팡파레",
    },

    "evolve-during": {
        "title": "진화 중(실루엣 점멸)", "rank": 21, "dur": (3.8, 5.4), "rms": -21, "centroid": (500, 4500), "max_trail": 200, "set": 2,
        "brief": 'Evolution in progress, about 4.6 s long: the creature silhouette flickers faster and faster (first flicker every 0.8 s, last ones every 0.12 s). Make a pulsing two-channel blip that accelerates, with pitch rising by about an octave overall and a gradually building triangle bass. Ends on a held glowing tone fading out.',
        "ref": None, "old": "승리 큐 합성/저작음",
    },

    "evolve-after": {
        "title": "진화 완료", "rank": 22, "dur": (1.4, 3.0), "rms": -19, "centroid": (800, 5000), "max_trail": 200, "set": 2,
        "brief": 'Evolution complete: a triumphant, warm fanfare, 1.8-2.4 s. Bright pulse lead playing a short rising phrase that lands on a held major chord, triangle bass, a shimmer on top. Original tune; do not quote any known melody.',
        "ref": None, "old": "승리 큐 한 번 더",
    },

    "badge-get": {
        "title": "배지 획득 징글", "rank": 23, "dur": (2.0, 3.8), "rms": -19, "centroid": (800, 5000), "max_trail": 250, "set": 2,
        "brief": 'Gym badge obtained: a proud fanfare jingle, 2.6-3.2 s. Two-channel pulse harmony (25% and 50% duty), triangle bass, a bell-like shimmer at the end. Longer and more ceremonial than a level-up. Original tune; do not quote any known melody.',
        "ref": None, "old": "무음/저작 ME",
    },

    "item-get": {
        "title": "아이템 획득", "rank": 24, "dur": (0.5, 1.4), "rms": -20, "centroid": (900, 5000), "max_trail": 120, "set": 2,
        "brief": 'Picking up an item: a short happy jingle, about 0.8 s: a quick three-to-four note rising pulse arpeggio with a bright last note and small sparkle. Lighter than the level-up fanfare. Original.',
        "ref": None, "old": "이벤트 SE 의존",
    },

    "shop-buy": {
        "title": "상점 구매", "rank": 25, "dur": (0.2, 0.7), "rms": -21, "centroid": (1200, 6000), "max_trail": 100, "set": 2,
        "brief": 'Completing a purchase at a shop: a cash-register-like coin chime. Two quick bright bell/pulse notes (a small interval) then a short metallic ring. About 0.35-0.5 s. Satisfying, tidy.',
        "ref": None, "old": "확정음(Decision1)",
    },

    "status-poison": {
        "title": "상태이상 · 독", "rank": 26, "dur": (0.3, 0.9), "rms": -20, "centroid": (300, 3500), "max_trail": 100, "set": 2,
        "brief": 'Poisoned: a short ominous bubbling sting, 0.5-0.7 s. Low pulse (12.5%) wobbling in pitch downward with fast vibrato, plus a few popping 7-bit noise ticks like bubbles. Slightly sickly.',
        "ref": None, "old": "기술 이펙트 의존",
    },

    "status-burn": {
        "title": "상태이상 · 화상", "rank": 27, "dur": (0.3, 0.9), "rms": -19, "centroid": (800, 5000), "max_trail": 100, "set": 2,
        "brief": "Burned: a short crackling 'fsss' flare, 0.4-0.7 s. A burst of 15-bit noise with the clock sweeping up then down like flame, and a quick rising-then-falling pulse note. Hot and sharp.",
        "ref": None, "old": "기술 이펙트 의존",
    },

    "status-paralysis": {
        "title": "상태이상 · 마비", "rank": 28, "dur": (0.3, 0.9), "rms": -19, "centroid": (1200, 6500), "max_trail": 100, "set": 2,
        "brief": 'Paralyzed: an electric zap-stutter, 0.4-0.7 s. A very fast alternating two-pitch pulse (arpeggio rate over 60 Hz) with sharp 7-bit noise ticks, stuttering and cutting out abruptly. Zappy, high.',
        "ref": None, "old": "기술 이펙트 의존",
    },

    "status-sleep": {
        "title": "상태이상 · 수면", "rank": 29, "dur": (0.5, 1.5), "rms": -22, "centroid": (300, 3000), "max_trail": 150, "set": 2,
        "brief": 'Fell asleep: a soft lullaby drop, 0.8-1.2 s. Three slow descending triangle/pulse (25%) notes with gentle vibrato and a long fade, sleepy and soft. Original tune.',
        "ref": None, "old": "기술 이펙트 의존",
    },

    "status-confusion": {
        "title": "상태이상 · 혼란", "rank": 30, "dur": (0.4, 1.2), "rms": -20, "centroid": (500, 4500), "max_trail": 120, "set": 2,
        "brief": 'Confused: a dizzy wobble, 0.6-0.9 s. A pulse note whose pitch swirls up and down (fast vibrato of about two semitones, drifting) with a detuned second pulse, a spinning feel, ending off-key.',
        "ref": None, "old": "기술 이펙트 의존",
    },

    "stat-up": {
        "title": "능력 상승", "rank": 31, "dur": (0.3, 0.9), "rms": -20, "centroid": (900, 5000), "max_trail": 100, "set": 2,
        "brief": 'A stat rose: a short bright upward chirp, 0.4-0.6 s: three quick rising pulse notes (a major arpeggio or a fast sweep up) with a sparkle at the top. Clearly positive.',
        "ref": None, "old": "기술 이펙트 buff 의존",
    },

    "stat-down": {
        "title": "능력 하락", "rank": 32, "dur": (0.3, 0.9), "rms": -20, "centroid": (300, 3500), "max_trail": 100, "set": 2,
        "brief": 'A stat fell: a short downward droop, 0.4-0.6 s: three quick falling pulse notes (a minor descent or a sweep down) ending low and dull. Clearly negative but not scary.',
        "ref": None, "old": "기술 이펙트 debuff 의존",
    },

    "weather-rain": {
        "title": "날씨 시작 · 비", "rank": 33, "dur": (0.7, 1.8), "rms": -22, "centroid": (400, 5000), "max_trail": 150, "set": 2,
        "brief": 'Rain starts: a soft rain-onset sting, 1.0-1.4 s. Many tiny high noise ticks (7-bit and 15-bit) like drops, thickening gradually, with a gentle falling two-note triangle motif. Cool and calm.',
        "ref": None, "old": "합성 빗소리만",
    },

    "weather-sun": {
        "title": "날씨 시작 · 쾌청", "rank": 34, "dur": (0.7, 1.8), "rms": -21, "centroid": (800, 5500), "max_trail": 150, "set": 2,
        "brief": 'Sunlight intensifies: a warm bright swell, 1.0-1.4 s. A rising pulse (50%) chord arpeggio with slow vibrato blooming into a shimmering held high note, triangle underneath. Radiant.',
        "ref": None, "old": "무음",
    },

    "weather-sand": {
        "title": "날씨 시작 · 모래바람", "rank": 35, "dur": (0.7, 1.8), "rms": -21, "centroid": (500, 5000), "max_trail": 150, "set": 2,
        "brief": 'Sandstorm starts: a gritty rising wind, 1.0-1.4 s. Filtered 15-bit noise with the clock sweeping slowly up and a low wobbling 25% pulse drone with tremolo. Dry, rough.',
        "ref": None, "old": "무음",
    },

    "weather-hail": {
        "title": "날씨 시작 · 싸라기눈", "rank": 36, "dur": (0.7, 1.8), "rms": -21, "centroid": (1000, 6500), "max_trail": 150, "set": 2,
        "brief": 'Hail begins: icy pattering, 1.0-1.4 s. Sparse bright 7-bit noise ticks and high glassy pulse (12.5%) pings in a random-feeling scatter over a cold thin triangle whistle.',
        "ref": None, "old": "무음",
    },

    "walk-grass": {
        "title": "풀밭 걷기", "rank": 37, "dur": (0.08, 0.35), "rms": -27, "centroid": (1500, 7000), "max_trail": 60, "set": 2,
        "brief": 'One footstep through tall grass: a very short soft rustle, 0.12-0.25 s. A quick burst of filtered 15-bit noise (gentle swish up then down), quiet and dry, no tonal part. Heard every other step, so it must never fatigue.',
        "ref": None, "old": "무음",
    },

    "dialogue-tick": {
        "title": "대화 글자 틱", "rank": 38, "dur": (0.02, 0.09), "rms": -27, "centroid": (1200, 6000), "max_trail": 30, "set": 2,
        "brief": 'One dialogue text-letter tick: the tiniest soft blip, 0.03-0.07 s. A single short 25% pulse note at about 900-1100 Hz with a very fast decay. Heard 20+ times per second of text, so it must be tiny, round, never harsh.',
        "ref": None, "old": "합성 오실레이터(화자별)",
    },

    "crit": {
        "title": "급소", "rank": 39, "dur": (0.12, 0.5), "rms": -19, "centroid": (1500, 7000), "max_trail": 60, "set": 2,
        "brief": "Critical hit accent layered over a normal hit: a sharp bright 'ting-ka' sting, 0.2-0.35 s: a high pulse (12.5%) ping that drops a fifth, plus a tiny noise snap at the start. Short, sparkling, decisive.",
        "ref": None, "old": "상성음 그대로",
    },

    "battle-start": {
        "title": "전투 시작 징글", "rank": 40, "dur": (0.5, 1.6), "rms": -19, "centroid": (700, 5000), "max_trail": 150, "set": 2,
        "brief": 'Battle begins sting: a short bold two-bar-ish riff, 0.9-1.2 s: punchy pulse (50%) staccato notes climbing then a firm accent on the last note, triangle bass hits underneath. Tense and ready. Original tune.',
        "ref": None, "old": "무음(BGM만)",
    },

    "door-open": {
        "title": "문 열림", "rank": 41, "dur": (0.15, 0.7), "rms": -21, "centroid": (400, 4500), "max_trail": 100, "set": 2,
        "brief": "A door opening and a step through it: a short 'ka-chk' latch click followed by a brief rising swish and a soft low thump. 0.3-0.5 s. Mostly noise and a low pulse blip.",
        "ref": None, "old": "무음",
    },

    "gym-door": {
        "title": "체육관 문·장치 열림", "rank": 42, "dur": (0.6, 1.8), "rms": -19, "centroid": (250, 4000), "max_trail": 200, "set": 2,
        "brief": 'A heavy gym gate or puzzle barrier slides open: a rumbling stone-scrape, 1.0-1.4 s. Low noise rumble (15-bit, low clock) with a slow rising pulse tone and a final heavy thud/clunk. Grand and weighty.',
        "ref": None, "old": "무음 (장치 changeTile)",
    },

    "hm-rock-smash": {
        "title": "바위 깨기", "rank": 43, "dur": (0.25, 0.9), "rms": -18, "centroid": (800, 5500), "max_trail": 100, "set": 2,
        "brief": 'Smashing a rock: a punchy crack-and-crumble, 0.4-0.6 s. A hard noise burst (7-bit then 15-bit) plus a low thump, then a few falling debris ticks. Solid.',
        "ref": None, "old": "무음",
    },

    "hm-cut": {
        "title": "나무 베기", "rank": 44, "dur": (0.2, 0.8), "rms": -19, "centroid": (1200, 6500), "max_trail": 100, "set": 2,
        "brief": "Cutting a tree: a quick blade swish and wood chop, 0.3-0.5 s. A fast upward-sweeping noise swish followed by a sharp woody 'tok' (short pulse with fast pitch drop).",
        "ref": None, "old": "무음",
    },

    "hm-surf": {
        "title": "물 · 파도타기", "rank": 45, "dur": (0.5, 1.6), "rms": -21, "centroid": (500, 5500), "max_trail": 150, "set": 2,
        "brief": 'Starting to surf / water splash: a splashy wave, 0.8-1.1 s. Filtered 15-bit noise swelling and falling like a wave, bubbly rising pulse blips on top, ending in a soft splash.',
        "ref": None, "old": "무음",
    },
}
