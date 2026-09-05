# Esc menu workbench

The shipping `player.html` path was exercised using the runtime QA server.
The editor shell and remote project storage are not involved in these UI changes.

- `before.png`: original target selection with duplicated party cards and target rows.
- `after-menu.png`: one inset frame, visible task preview, smaller navigation, persistent key hints.
- `after-targets.png`: four targets fit together with current and predicted HP/MP.
- `after-equipment.png`: selected equipment, current item, and all four stat comparisons.
- `interaction.json`: retained selection/scroll, a 120ms exit ending at opacity 0,
  and an actual 40ms reduced-motion invocation containing only opacity frames.

Validation:

- 64 focused unit tests passed after integrating main (preview/execution parity,
  no session/RNG mutation, menu rendering, empty-party shell behavior, target
  eligibility, and closing lifetime).
- Application typecheck and CSS budget/graph/live-class gates passed.
- Chromium passed the 13-beat action scenario, focus/scroll preservation,
  640×480 / 1024×768 / 1280×960 geometry, and close/reopen checks.
- Firefox passed the final strengthened browser test again after integrating main,
  additionally verifying
  all four targets fit, consuming the last potion returns to the list, and
  reduced motion is actually invoked (an empty animation array cannot pass).
- Later Chromium reruns were interrupted by host `net::ERR_NETWORK_CHANGED`.
  This is the documented Linux network-interface issue in `openwiki/testing.md`;
  final screenshots are from Firefox. Browser names above describe the actual engines.

The full gate is not globally green: its initial run reported 216 failed tests.
After fixing the menu shell expectation and selected-command CSS geometry, the
35 newly flagged files and the commit-probe surface test were rerun on clean
main `2489cfef` and this branch: 30 vs 29 failed assertions, **zero failures unique
to this change**. The remaining editor surface failures are inherited; no gate
baseline was changed. See [gates.txt](gates.txt),
[baseline-comparison.json](baseline-comparison.json), and
[full-gate-summary.json](full-gate-summary.json).

The QA fixture is a generated copy of the historical item fixture with medicine
items explicitly typed as `medicine`. Its old `normalGoods` recovery records are
intentionally unusable under the current item-type rules. No authored project was modified.
