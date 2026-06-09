# Free-text corpus — acquisition & format

The Phase-2 (continuous-guard) model is content-independent and trains on
windowed free typing. Two sources, in priority order:

## Plan A — public academic corpus
- **Buffalo Keystroke Dataset** and **Clarkson II** are the standard free-text
  benchmarks. Both typically require a short academic data-use request.
- Start the request EARLY (it has lead time). Track status here.

## Plan B — the game's own collected windows (fallback, never blocks us)
The Typing Sanctuary game already captures per-keystroke timings. With consent
(spec §6.5), export them to the same CSV shape and train on those. This makes
Phase 2 runnable without waiting on an external reply.

## Expected CSV shape (both sources normalize to this)

    subject,char,downTime,upTime,isCorrect
    u1,h,0.00,0.08,1
    ...

`downTime`/`upTime` in seconds (or any consistent unit — the encoder learns
relative rhythm). Place the normalized file at
`research/data/freetext/<name>.csv` (gitignored) and point
`scripts/train_freetext.py --csv` at it.
