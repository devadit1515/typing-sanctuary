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
"""
import numpy as np

TIMING_FEATURES = 4

# Vocabulary: 0 = UNK, then a-z, 0-9, and a handful of common punctuation/space.
_VOCAB = list("abcdefghijklmnopqrstuvwxyz0123456789 .,;'-")
_CHAR_TO_ID = {c: i + 1 for i, c in enumerate(_VOCAB)}  # +1 so 0 stays UNK
MAX_CHAR_ID = len(_VOCAB) + 1  # vocabulary size incl. UNK

def char_to_id(ch):
    if not ch:
        return 0
    return _CHAR_TO_ID.get(ch.lower()[:1], 0)

def featurize_window(keystrokes):
    """keystrokes: list of objects with .char .downTime .upTime (attribute access).
    Returns (feats: float32 [n,4], char_ids: int64 [n])."""
    n = len(keystrokes)
    feats = np.zeros((n, TIMING_FEATURES), dtype=np.float32)
    char_ids = np.zeros((n,), dtype=np.int64)
    prev_down = prev_up = None
    for i, k in enumerate(keystrokes):
        down = float(k.downTime)
        up = float(k.upTime)
        feats[i, 0] = up - down                       # hold
        if prev_down is not None:
            feats[i, 1] = down - prev_down            # down-down
            feats[i, 2] = down - prev_up              # flight (up-down)
            feats[i, 3] = up - prev_up                # up-up
        char_ids[i] = char_to_id(getattr(k, "char", ""))
        prev_down, prev_up = down, up
    return feats, char_ids
