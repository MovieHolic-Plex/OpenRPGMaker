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

- 55 focused unit tests passed (preview/execution parity, no session/RNG mutation,
  menu rendering, target eligibility, and closing lifetime).
- Chromium passed the 13-beat action scenario, focus/scroll preservation,
  640×480 / 1024×768 / 1280×960 geometry, and close/reopen checks.
- Firefox passed the final strengthened browser test, additionally verifying
  all four targets fit, consuming the last potion returns to the list, and
  reduced motion is actually invoked (an empty animation array cannot pass).
- Later Chromium reruns were interrupted by host `net::ERR_NETWORK_CHANGED`.
  This is the documented Linux network-interface issue in `openwiki/testing.md`;
  final screenshots are from Firefox. Browser names above describe the actual engines.

The QA fixture is a generated copy of the historical item fixture with medicine
items explicitly typed as `medicine`. Its old `normalGoods` recovery records are
intentionally unusable under the current item-type rules. No authored project was modified.
