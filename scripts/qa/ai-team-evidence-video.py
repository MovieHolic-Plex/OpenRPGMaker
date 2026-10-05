"""Cut live browser recordings into a short MP4; preserve source offsets in JSON."""
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'verify-shots/ai-team-exploration-findings'
OUT.mkdir(parents=True, exist_ok=True)
CONTINUED = ROOT / 'verify-shots/ai-team-exploration-20261005-continued'
PARALLEL = ROOT / 'verify-shots/ai-team-exploration-20261005-parallel'
report = json.loads((CONTINUED / 'report.json').read_text())
labels = [
    '팀 토글: 두 맵의 대사 수정 · 폴더 문제로 순차 완료',
    '같은 맵: 첫 작업 완료 뒤 다음 조수에게 배정',
    '공통 데이터: 조회 보고 뒤 주인공 이름을 “하린”으로 수정',
    '번역 검수 실패: 최신 원문을 오판해 올바른 번역을 덮어씀',
    '중단: 실제 조수 시작 뒤 실행 종료 · 새 변경 없음',
    '중단 후 재시도: 새 조회 정상 완료 · 예약 누수 없음',
]
segments = [{'source': str(PARALLEL / 'team-exploration.mp4'),
             'start': 48, 'duration': 10,
             'label': '서로 다른 맵: 등대 조수와 부두 조수가 실제로 동시에 실행'}]
base = report['runs'][0]['started']
for run, label in zip(report['runs'], labels):
    segments.append({'source': str(CONTINUED / 'team-exploration.mp4'),
                     'start': round((run['started'] - base) / 1000 + run['seconds'] - 7, 3),
                     'duration': 6, 'label': label})
font = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
clips = []
for i, segment in enumerate(segments):
    caption = OUT / f'caption-{i}.txt'
    caption.write_text(segment['label'] + '\n실제 화면 녹화 · 대기 구간 생략\n')
    clip = OUT / f'clip-{i}.mp4'
    filters = (f'fps=25,pad=iw:ih+112:0:0:color=0x14171d,'
               f'drawtext=fontfile={font}:textfile={caption}:fontcolor=white:'
               'fontsize=28:line_spacing=10:x=28:y=h-94')
    subprocess.run(['ffmpeg', '-y', '-ss', str(segment['start']), '-t', str(segment['duration']),
                    '-i', segment['source'], '-vf', filters, '-an', '-c:v', 'libx264',
                    '-threads', '2', '-preset', 'veryfast', '-crf', '25', '-pix_fmt', 'yuv420p',
                    str(clip)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    clips.append(clip)
playlist = OUT / 'clips.txt'
playlist.write_text('\n'.join(f"file '{clip}'" for clip in clips) + '\n')
output = OUT / 'team-exploration-highlights.mp4'
subprocess.run(['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', str(playlist),
                '-c', 'copy', '-movflags', '+faststart', str(output)], check=True,
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
(OUT / 'video-edit.json').write_text(json.dumps({
    'provenance': 'Actual browser recordings; waiting intervals omitted. No reconstructed UI.',
    'output': str(output.relative_to(ROOT)), 'segments': segments,
}, ensure_ascii=False, indent=2) + '\n')
print(output)
