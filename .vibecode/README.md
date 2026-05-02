# .vibecode/

This directory is **VCK-HU runtime context** for the host LLM
(Claude Code, Cursor, Devin, …).  It is created automatically by
``/vibe-scaffold`` and ``ScaffoldEngine.apply()`` and is safe to
commit to the repo.

| File | Purpose |
|---|---|
| `learnings.jsonl` | Per-project learning store. Capture with `/vck-learn`. Auto-injected at session start (opt-out: `VIBECODE_LEARNINGS_INJECT=0`). |
| `team.json.example` | Rename to `team.json` to enforce team-mode gates in `/vck-ship` Bước 0. |
| `classifier.env.example` | Documented env vars for the security classifier and learnings injection. |

See `USAGE_GUIDE.md` §18 (Activation Cheat Sheet) for full details.
