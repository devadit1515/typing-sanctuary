"""Keystroke-event -> model-input featurization. SINGLE source of the input
representation: imported by both training (research) and serving (ml-service),
so the deployed model sees exactly the features it trained on.

Per keystroke we emit 4 timing features (spec §4.1) + a character id (the net
learns keyboard geography via a learned char embedding).
Timing features per keystroke i:
  0 hold      = up_i - down_i
  1 down-down = down_i - down_{i-1}   (0 for i=0)
  2 flight    = down_i - up_{i-1}     (0 for i=0)  [up-down]
  3 up-up     = up_i - up_{i-1}       (0 for i=0)

downTime/upTime may be in any consistent time unit (s, ms, performance.now()
ticks, epoch ms, ...). Features are computed relative to a per-window origin
(t0 = the first keystroke's downTime), so the absolute magnitude / epoch offset
of the timestamps does not affect the result. All four timing features are
differences, so this shift leaves their mathematical values unchanged while
avoiding float32 catastrophic cancellation at large timestamp magnitudes.
"""
import numpy as np

TIMING_FEATURES = 4

# Vocabulary: 0 = UNK, then a-z, 0-9, and a handful of common punctuation/space.
# NOTE: id 0 is shared by BOTH unknown/out-of-vocab characters AND padding
# (the char encoder uses padding_idx=0). Collapsing UNK and PAD onto the same id
# is intentional for this content-independent model: it learns timing/geometry,
# not which specific characters were typed, so a single "ignore" id suffices.
_VOCAB = list("abcdefghijklmnopqrstuvwxyz0123456789 .,;'-")
_CHAR_TO_ID = {c: i + 1 for i, c in enumerate(_VOCAB)}  # +1 so 0 stays UNK
MAX_CHAR_ID = len(_VOCAB) + 1  # vocabulary size incl. UNK

def char_to_id(ch: str) -> int:
    if not ch:
        return 0
    return _CHAR_TO_ID.get(ch.lower()[:1], 0)

def featurize_window(keystrokes) -> tuple["np.ndarray", "np.ndarray"]:
    """keystrokes: list of objects with .char .downTime .upTime (attribute access).
    Returns (feats: float32 [n,4], char_ids: int64 [n]).

    Timings are shifted by a per-window origin t0 (the first keystroke's
    downTime) before featurizing; since every timing feature is a difference,
    this is value-preserving but removes large-magnitude float32 cancellation.
    Negative values are possible (e.g. overlapping keys) and are passed through
    as-is, not clamped."""
    n = len(keystrokes)
    feats = np.zeros((n, TIMING_FEATURES), dtype=np.float32)
    char_ids = np.zeros((n,), dtype=np.int64)
    # Per-window origin: subtract the first downTime so features are computed at
    # small magnitude regardless of the absolute timestamp scale (epoch ms etc.).
    t0 = float(keystrokes[0].downTime) if n else 0.0
    prev_down = prev_up = None
    for i, k in enumerate(keystrokes):
        down = float(k.downTime) - t0
        up = float(k.upTime) - t0
        feats[i, 0] = up - down                       # hold
        if prev_down is not None:
            feats[i, 1] = down - prev_down            # down-down
            feats[i, 2] = down - prev_up              # flight (up-down)
            feats[i, 3] = up - prev_up                # up-up
        char_ids[i] = char_to_id(getattr(k, "char", ""))
        prev_down, prev_up = down, up
    return feats, char_ids
