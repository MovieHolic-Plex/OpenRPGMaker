#!/usr/bin/env python3
"""Argon 적대 판정: python3 argon_judge.py <prompt_file> <img1> [img2 ...] → 답 텍스트. 키(~/.omp/agent/models.yml providers.argonproxy.apiKey)는 출력하지 않는다. 503 이면 잠시 뒤 다시 돌린다."""
import base64, json, os, sys, urllib.request
import yaml

cfg = yaml.safe_load(open(os.path.expanduser('~/.omp/agent/models.yml')))
key = cfg['providers']['argonproxy']['apiKey']
prompt = open(sys.argv[1]).read()
content = [{'type': 'text', 'text': prompt}]
for p in sys.argv[2:]:
    b = base64.b64encode(open(p, 'rb').read()).decode()
    content.append({'type': 'image_url', 'image_url': {'url': 'data:image/png;base64,' + b}})
body = json.dumps({'model': 'gemini-4-argon-high', 'messages': [{'role': 'user', 'content': content}]}).encode()
req = urllib.request.Request('http://127.0.0.1:8319/v1/chat/completions', data=body,
                             headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key})
r = json.load(urllib.request.urlopen(req, timeout=600))
print(r['choices'][0]['message']['content'])
