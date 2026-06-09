"""Free-text loader for the content-independent (continuous-guard) model.
Accepts a generic per-event CSV (subject,char,downTime,upTime,isCorrect) — the
shape the game already collects — so Phase 2 runs on a public corpus OR on the
game's own data (spec §9 plan-B). Produces sliding windows of keystroke events."""
import csv
from dataclasses import dataclass


@dataclass
class _Event:
    char: str
    keyCode: str
    downTime: float
    upTime: float
    position: int
    isCorrect: bool = True


def load_freetext(path):
    """Returns {subject: [ _Event, ... ]} preserving typed order."""
    by_subject = {}
    with open(path, newline="") as f:
        for i, row in enumerate(csv.DictReader(f)):
            subj = row["subject"]
            ev = _Event(char=row["char"], keyCode="Key" + row["char"][:1].upper(),
                        downTime=float(row["downTime"]), upTime=float(row["upTime"]),
                        position=i, isCorrect=str(row.get("isCorrect", "1")) in ("1", "True", "true"))
            by_subject.setdefault(subj, []).append(ev)
    return by_subject


def sliding_windows(events, size=40, stride=20):
    """Yield fixed-size windows over an event stream. Drops a trailing partial
    window (content-independent training wants uniform-length windows)."""
    out = []
    i = 0
    while i + size <= len(events):
        out.append(events[i:i + size])
        i += stride
    return out
