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
}
