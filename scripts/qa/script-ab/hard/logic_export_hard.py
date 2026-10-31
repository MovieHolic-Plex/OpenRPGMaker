#!/usr/bin/env python3
"""Hard-logic battery — logic JSON for the judge: ../logic_export.py but KEEPING movement/move routes (patrols, schedules)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import logic_export  # noqa: E402
logic_export.DROP -= {"movement", "moveRoute"}
if __name__ == "__main__":
    logic_export.main()
