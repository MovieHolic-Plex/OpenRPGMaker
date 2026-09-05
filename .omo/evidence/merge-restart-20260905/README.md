# Remaining PR integration and release — 2026-09-05

User authorized merging PR584/586/587 (including drafts), building, restarting the running service and pushing main.

Merged with original ancestry. Generated OpenWiki INDEX was regenerated. The combined horror/growth merge also conflicted at the save-slot validation imports; both validators and both session fields are retained. The growth save test now writes/reads a real slot containing both growth investments and pursuit/hiding state. Both new CSS files together exceeded the file-count budget, so the 24-line horror control rules were consolidated into the existing event editor stylesheet; the budget was not raised.

Supervisor verification: all 179 focused tests pass, CSS gate passes, and complete `npm run build` succeeds (application typecheck, editor, export-player with SDK manifest, standalone bundle). The shipping-player growth harness passes keyboard investment, prerequisite lock, promotion and refund checks without runtime errors; both marked screenshots were inspected. This is focused validation; historical full-suite failures remain documented in the preceding recovery report.

Release target: user systemd `rpg-zzu.service`, working directory `/home/main/z-project/rpg-zzu`, preview on `http://mdc-server:9888`. Clean integrated build artifacts are deployed separately from ongoing uncommitted source work. Preservation and restart/HTTP/browser evidence are recorded under `/home/main/z-project/rpg-zzu-branch-backups/20260905/merge-restart/`.
