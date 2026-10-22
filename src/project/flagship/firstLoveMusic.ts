/**
 * 『첫사랑』 원곡 두 곡 — generate_original_bgm 으로 합성해 프로젝트 안에 싣는다(CDN·설치 팩 없이 재생).
 * 주제곡: F장조 72bpm 16마디(I–V/3–vi–IV …), 피아노 선율 + 현 패드 + 베이스 + 뜯는 분산화음.
 * 기억: 같은 선율 앞 8마디를 오르골(종)로 느리게.
 */
type Note = { pitch: number; beat: number; duration: number; velocity: number };

const CHORDS: readonly (readonly [number, number, number])[] = [
  [53, 57, 60], [52, 55, 60], [50, 53, 57], [50, 53, 58],
  [53, 57, 60], [55, 58, 62], [52, 55, 60], [52, 55, 60],
  [50, 53, 58], [52, 55, 60], [52, 57, 60], [50, 53, 57],
  [50, 55, 58], [52, 55, 60], [53, 57, 60], [53, 57, 60],
];
const BASS = [41, 40, 38, 46, 45, 43, 48, 48, 46, 48, 45, 38, 43, 48, 41, 41];
// 마디마다 [음높이, 길이] — 합이 4박.
const MELODY: readonly (readonly (readonly [number, number])[])[] = [
  [[69, 1.5], [72, 0.5], [77, 1], [76, 1]],
  [[74, 1.5], [72, 0.5], [67, 2]],
  [[69, 1], [74, 1], [72, 1], [69, 1]],
  [[70, 2], [69, 1], [67, 1]],
  [[69, 1.5], [72, 0.5], [77, 1], [79, 1]],
  [[81, 1.5], [79, 0.5], [77, 1], [74, 1]],
  [[76, 2], [74, 1], [72, 1]],
  [[72, 3], [67, 1]],
  [[74, 1.5], [72, 0.5], [70, 1], [74, 1]],
  [[76, 1.5], [74, 0.5], [72, 2]],
  [[72, 1], [76, 1], [81, 1], [79, 1]],
  [[77, 2], [76, 1], [74, 1]],
  [[74, 1], [70, 1], [74, 1], [79, 1]],
  [[76, 1.5], [74, 0.5], [72, 1], [76, 1]],
  [[77, 3], [72, 1]],
  [[77, 4]],
];

function melody(bars: number, velocity: number): Note[] {
  const out: Note[] = [];
  for (let b = 0; b < bars; b++) {
    let t = b * 4;
    for (const [pitch, duration] of MELODY[b]!) {
      out.push({ pitch, beat: t, duration: Math.max(0.25, duration - 0.05), velocity });
      t += duration;
    }
  }
  return out;
}

function pad(bars: number, velocity: number): Note[] {
  return CHORDS.slice(0, bars).flatMap((c, b) => c.map((pitch) => ({ pitch, beat: b * 4, duration: 3.9, velocity })));
}

function bass(bars: number, velocity: number): Note[] {
  return BASS.slice(0, bars).flatMap((root, b) => [
    { pitch: root, beat: b * 4, duration: 1.9, velocity },
    { pitch: root + 7 <= 60 ? root + 7 : root, beat: b * 4 + 2, duration: 1.9, velocity: velocity * 0.8 },
  ]);
}

function arpeggio(bars: number, velocity: number): Note[] {
  const order = [0, 1, 2, 3, 2, 1, 0, 1];
  return CHORDS.slice(0, bars).flatMap((c, b) => order.map((k, i) => ({
    pitch: (k === 3 ? c[0] + 12 : c[k]!) + 12,
    beat: b * 4 + i * 0.5,
    duration: 0.45,
    velocity: velocity * (i % 2 === 0 ? 1 : 0.8),
  })));
}

export const FIRST_LOVE_THEME_ARGS = {
  name: "첫사랑 — 주제곡",
  brief: "현대 오피스 로맨스 『첫사랑』의 주제곡. 피아노 선율이 망설이다가 후렴에서 조금 용기를 내는, 따뜻하고 조금 아픈 곡. 타이틀·회상 직후·마지막 장면에 쓴다.",
  score: {
    tempo: 72,
    bars: 16,
    loop: true,
    tracks: [
      { instrument: "piano", gain: 0.85, pan: 0.05, notes: melody(16, 0.78) },
      { instrument: "strings", gain: 0.42, pan: -0.15, notes: pad(16, 0.5) },
      { instrument: "bass", gain: 0.5, pan: 0, notes: bass(16, 0.6) },
      { instrument: "pluck", gain: 0.3, pan: 0.25, notes: arpeggio(16, 0.42) },
    ],
  },
} as const;

export const FIRST_LOVE_MEMORY_ARGS = {
  name: "첫사랑 — 금요일의 방송실",
  brief: "10년 전 고등학교 방송실을 떠올리는 회상 장면의 곡. 주제곡 앞 여덟 마디를 오르골처럼 느리고 작게.",
  score: {
    tempo: 60,
    bars: 8,
    loop: true,
    tracks: [
      { instrument: "bell", gain: 0.6, pan: 0.1, notes: melody(8, 0.6) },
      { instrument: "strings", gain: 0.3, pan: -0.1, notes: pad(8, 0.4) },
    ],
  },
} as const;
