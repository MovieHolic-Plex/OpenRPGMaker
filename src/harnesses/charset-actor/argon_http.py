#!/usr/bin/env python3
"""Agy 대신 8318 CLIProxy(OpenAI 호환, 스트리밍만)로 Argon 을 부르는 최소 어댑터(2026-10-16).

argon_part.make_candidate 는 에이전트(agy)가 작업 폴더의 파일을 읽고 edit.json 을 쓴 뒤 partedit.py 를 직접 돌리는 흐름이다. 8318 은 채팅 API 라 도구가 없으므로:
  - 작업 폴더의 격자·마스크·팔레트·직전 edit.json 은 글로 프롬프트에 넣고, PNG(base_6x·masks_4x·rtp_style_4x)는 이미지로 첨부한다.
  - 모델은 edit.json 하나를 ```json 으로만 답한다. 어댑터가 그것을 작업 폴더에 쓰면, 검증은 make_candidate 가 원래대로 partedit.run_apply 로 한다(거절 사유는 다음 시도에 되먹임).
키는 환경변수 OPRN_LIVE_KEY 로만 읽는다(출력·로그·파일에 남기지 않는다). 모델은 gemini-4-argon* 만, stream:true 만(non-stream 은 빈 응답).
켜는 법: CHR_ARGON_BACKEND=http (argon_part.run_agy 가 이 모듈로 바뀐다 — scarloxy_draw.py 가 건다).
"""
import base64
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = os.environ.get('CHR_ARGON_BASE_URL', 'http://127.0.0.1:8318/v1')
TIMEOUT = int(os.environ.get('CHR_ARGON_HTTP_TIMEOUT', '900'))
IMAGES = ('base_6x.png', 'masks_4x.png') if os.environ.get('CHR_ARGON_STYLE_IMAGE', '0') != '1' else ('base_6x.png', 'masks_4x.png', 'rtp_style_4x.png')   # rtp_style_4x 는 다른 칩셋 그림이라 Scarloxy 주문에서는 기본으로 빼 혼동을 줄인다(2026-10-16 2차)
BACKOFF = (60, 120, 240)   # 429·5xx·연결 오류 때 기다리는 초(다른 에이전트도 8318 을 쓴다)
TEXTS = ('palette.json', 'base_down_1.txt', 'base_up_1.txt', 'base_right_1.txt', 'base_left_1.txt',
         'mask_down_1.txt', 'mask_up_1.txt', 'mask_right_1.txt', 'mask_left_1.txt', 'edit.json')


def _key():
    k = os.environ.get('OPRN_LIVE_KEY', '')
    if not k:
        raise RuntimeError('OPRN_LIVE_KEY 환경변수가 없다')
    return k


def _message(cwd, text):
    cwd = Path(cwd)
    notes = ['[이 환경에는 파일·명령 도구가 없다. 아래에 작업 폴더의 파일이 글로 들어 있고 그림은 첨부됐다. `python3 …partedit.py apply .` 를 네가 실행하지 않는다 — '
             '하네스가 네 답을 edit.json 으로 저장해 같은 검증을 돌리고 거절 사유를 다음 시도에 알려 준다. 답은 **edit.json 내용 하나만 ```json 코드블록**으로 쓴다. 설명·done 은 쓰지 마라.]']
    for name in TEXTS:
        f = cwd / name
        if f.exists():
            notes.append(f'--- {name} ---\n{f.read_text(encoding="utf-8").rstrip()}')
    content = [{'type': 'text', 'text': text + '\n\n' + '\n\n'.join(notes)}]
    for name in IMAGES:
        f = cwd / name
        if f.exists():
            content.append({'type': 'text', 'text': f'[첨부 그림 {name}]'})
            content.append({'type': 'image_url', 'image_url': {'url': 'data:image/png;base64,' + base64.b64encode(f.read_bytes()).decode()}})
    return content


def stream_chat(model, content):
    body = json.dumps({'model': model, 'stream': True, 'messages': [{'role': 'user', 'content': content}]}).encode()
    req = urllib.request.Request(BASE_URL + '/chat/completions', data=body,
                                 headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _key()})
    out = []
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        for raw in r:
            line = raw.decode('utf-8', 'replace').strip()
            if not line.startswith('data:'):
                continue
            data = line[5:].strip()
            if data == '[DONE]':
                break
            try:
                delta = json.loads(data)['choices'][0].get('delta', {})
            except (ValueError, KeyError, IndexError):
                continue
            if delta.get('content'):
                out.append(delta['content'])
    return ''.join(out)


def extract_json(text):
    m = re.search(r'```(?:json)?\s*(\{.*\})\s*```', text, re.S)
    raw = m.group(1) if m else text[text.find('{'):text.rfind('}') + 1]
    return json.loads(raw)


def run_argon_http(cwd, text, label, model):
    """argon_part.run_agy 와 같은 시그니처·반환(code, out). 429·5xx·연결 오류·빈 응답은 60→120→240초 백오프로 다시 부른다."""
    assert model.startswith('gemini-4-argon'), model
    t0 = time.time()
    code, out, tries = 1, '', 0
    for wait in (0,) + BACKOFF:
        if wait:
            time.sleep(wait)
        tries += 1
        try:
            answer = stream_chat(model, _message(cwd, text))
            edit = extract_json(answer)
            (Path(cwd) / 'edit.json').write_text(json.dumps(edit, ensure_ascii=False, indent=1), encoding='utf-8')
            code, out = 0, answer
            break
        except urllib.error.HTTPError as e:   # 키가 오류 문자열에 섞이지 않게 상태 코드만 남긴다
            code, out = 1, f'HTTP {e.code}'
            if e.code not in (429, 500, 502, 503, 504):
                break
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            code, out = 1, f'{type(e).__name__}'
        except ValueError as e:   # JSON 을 못 읽은 답: 한 번 더 부른다(같은 요청)
            code, out = 2, f'ValueError(JSON): {str(e)[:200]}'
        except Exception as e:  # noqa: BLE001
            code, out = 1, f'{type(e).__name__}: {str(e)[:200]}'
            break
    (Path(cwd) / f'argon-http-{label}.log').write_text('exit=%s sec=%.0f tries=%d\n%s' % (code, time.time() - t0, tries, out[-4000:]))
    return code, out


if __name__ == '__main__':   # 연결 확인: OPRN_LIVE_KEY=... python3 argon_http.py
    print(repr(stream_chat('gemini-4-argon-high', [{'type': 'text', 'text': '한 단어로만 답해: 안녕'}])[:80]))
