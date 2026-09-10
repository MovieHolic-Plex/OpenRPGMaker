# Coordinate destination movement — shipping-player QA (OPRN-OUT-013)

Result: PASS

Keyboard input only; `__oprnDebug.readState` used for observation. Test-only fixture,
no authored content and no remote persistence.

Checks: STAGE 1 VARIABLE; STAGE 1 ARRIVED; stage1 arrived by walking (59 samples); STAGE 2 OUT OF BOUNDS; STAGE 2 CONTINUED; stage2 outOfBounds without (0,0) landing; waiting command terminated; STAGE 3 WALLED; STAGE 3 CONTINUED; stage3 blocked/unreachable = 5; waiting command terminated; STAGE 4 MISSING VARIABLE; stage4 invalidInput stopped the event; trailing command never ran; keyboard movement restored after the stopped event; expected runtime diagnostics observed (7)

즉시 확인: 01-variable-arrival.png, 02-out-of-bounds.png, 03-walled.png, 04-stop-on-failure.png


