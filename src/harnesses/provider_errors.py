"""Provider diagnostics shared by native runners; no database imports."""
import re

def tail(path):
    try:
        with open(path, 'rb') as file:
            file.seek(0, 2); file.seek(max(0, file.tell()-12000))
            return file.read().decode('utf-8', 'replace')
    except OSError:
        return ''


def classify(text):
    # Match actual diagnostics, not a prompt mentioning rate limits or quality FAIL.
    lines = '\n'.join(l for l in text.splitlines() if re.search(r'ERROR|Error|error|Autocompact|HTTP|Retry-After', l))
    if re.search(r'(?:status|HTTP|error|code)[^\n]{0,50}\b429\b|429 Too Many Requests', lines, re.I):
        return 'rate-limit'
    if 'Autocompact is thrashing' in lines:
        return 'context-overflow'
    if re.search(r'(?:status|HTTP|error|code)[^\n]{0,30}\b(?:502|503|504)\b', lines, re.I):
        return 'provider-unavailable'
    return None


BOUNDED_CONTEXT = "\n문맥 예산: 대형 파일 전체 출력 금지. rg로 위치를 찾고 필요한 절을 120줄 이하씩 읽는다. PNG는 그림 도구로 확인한다. PNG/base64/전체 격자를 텍스트로 출력하지 않는다. 완료한 조사 경로를 메모하고 반복해서 읽지 않는다.\n"
