"""Run from the worktree root. Mutate shipped seams one at a time; always restore bytes."""
from difflib import unified_diff
from pathlib import Path
import json
import subprocess

OUT = Path('.omo/evidence/ai-seven-selection')
TEMPERATURE = 'src/styles/database/tabs-b-assistant-panel/12-assistant-temperature.css'
DECK = 'src/styles/database/tabs-b-assistant-panel/18-assistant-deck.css'
COMPOSER_CSS = 'src/styles/database/assistant-composer.css'
COMPOSER = 'src/editor/panels/aiComposer.ts'
CHIPS = 'src/styles/database/tabs-b-assistant-panel/07-viewer-modal-settings.css'
SCOPED = '.ai-chat-panel.is-assistant-idle .ai-context-chips.has-selection-scope'
IDLE_TEST = 'idle: the map pin is visible'
HELP_TEST = 'keeps help on the input title'
TITLE = '  options.input.setAttribute("title", "Enter 보내기 · Shift+Enter 줄바꿈");'

cases = [
    ('idle-map-host-hidden', TEMPERATURE,
     '.ai-chat-panel.is-assistant-idle .ai-status-group {',
     '.ai-chat-panel.is-assistant-idle .ai-context-chips,\n.ai-chat-panel.is-assistant-idle .ai-status-group {', IDLE_TEST),
    ('scoped-host-hidden', TEMPERATURE,
     SCOPED + ' {\n  display: flex;', SCOPED + ' {\n  display: none;', IDLE_TEST),
    ('scoped-priority-lost', TEMPERATURE, '  order: -1;', '  order: 0;', IDLE_TEST),
    ('map-sibling-visible-while-scoped', TEMPERATURE,
     SCOPED + ' .ai-context-chip:not(.ai-selection-chip) {\n  display: none;',
     SCOPED + ' .ai-context-chip:not(.ai-selection-chip) {\n  display: inline-flex;', IDLE_TEST),
    ('selection-hidden-with-siblings', TEMPERATURE,
     SCOPED + ' .ai-context-chip:not(.ai-selection-chip)',
     SCOPED + ' .ai-context-chip', IDLE_TEST),
    ('clear-button-hidden', CHIPS,
     '.ai-selection-chip-clear {\n  align-items: center;',
     '.ai-selection-chip-clear {\n  display: none !important;\n  align-items: center;', IDLE_TEST),
    ('input-help-removed', COMPOSER, TITLE, '  options.input.removeAttribute("title");', HELP_TEST),
    ('retired-hint-restored', COMPOSER, TITLE,
     TITLE + '\n  actions.append(el("span", { class: "ai-composer-hint", text: options.input.title }));', HELP_TEST),
    ('help-takes-row-space-with-new-class', COMPOSER, TITLE,
     TITLE + '\n  actions.append(el("span", { text: options.input.title }));', HELP_TEST),
    ('action-row-block-layout', COMPOSER_CSS,
     '.ai-composer-actions {\n  align-items: center;\n  display: flex;',
     '.ai-composer-actions {\n  align-items: center;\n  display: block;', HELP_TEST),
    ('deck-action-row-height', DECK,
     ':is(.ai-deck, .ai-studio-composer) .ai-composer-actions {\n  gap: 8px;\n  min-height: 36px;',
     ':is(.ai-deck, .ai-studio-composer) .ai-composer-actions {\n  gap: 8px;\n  min-height: 56px;', HELP_TEST),
    ('action-lead-wraps', COMPOSER_CSS,
     '  scrollbar-width: none;\n  white-space: nowrap;',
     '  scrollbar-width: none;\n  white-space: normal;', HELP_TEST),
    ('focus-class-missing', COMPOSER,
     'const onInputFocus = (): void => actions.classList.add("is-input-focused");',
     'const onInputFocus = (): void => actions.classList.remove("is-input-focused");', HELP_TEST),
    ('blur-class-sticks', COMPOSER,
     'const onInputBlur = (): void => actions.classList.remove("is-input-focused");',
     'const onInputBlur = (): void => actions.classList.add("is-input-focused");', HELP_TEST),
    ('send-control-detached', COMPOSER,
     'children: [options.statusGroup, modelChip, options.sendButton, options.abortButton],',
     'children: [options.statusGroup, modelChip, options.abortButton],', HELP_TEST),
]

command = ['npm', 'test', '--', 'test/aiSelectionChipScope.test.ts']
results = []
for name, filename, old, new, expected_test in cases:
    path = Path(filename)
    original = path.read_bytes()
    source = original.decode()
    if source.count(old) != 1:
        raise RuntimeError(f'{name}: seam must match exactly once')
    mutated = source.replace(old, new)
    patch = ''.join(unified_diff(source.splitlines(True), mutated.splitlines(True),
                                 fromfile=filename, tofile=filename))
    try:
        path.write_text(mutated)
        run = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=150)
    finally:
        path.write_bytes(original)
    output = run.stdout.decode()
    (OUT / f'mutation-{name}.log').write_text(patch + '\n' + output)
    killed = run.returncode == 1 and any(
        'FAIL ' in line and expected_test in line for line in output.splitlines())
    results.append({'mutation': name, 'source': filename, 'exit': run.returncode,
                    'targeted_assertion_failed': killed, 'source_restored': path.read_bytes() == original})
    (OUT / 'mutation-results.json').write_text(json.dumps(results, indent=2) + '\n')
    print(f'{name}: exit={run.returncode}, killed={killed}, restored=True', flush=True)
    if not killed:
        raise RuntimeError(f'{name}: expected targeted assertion failure; inspect log')

with (OUT / 'post-mutation-green.log').open('w') as log:
    green = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, timeout=150)
print(f'restored full file: exit={green.returncode}', flush=True)
if green.returncode:
    raise SystemExit(green.returncode)
