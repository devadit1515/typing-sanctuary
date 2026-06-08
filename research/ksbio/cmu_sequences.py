"""Adapter: CMU fixed-password rows -> ordered keystroke-event sequences the
encoder can featurize. The CMU benchmark password is '.tie5Roanl' + Return.

Column convention (Killourhy-Maxion):
  H.<key>            hold time of <key>
  DD.<k1>.<k2>       down-to-down latency from k1 to k2
  UD.<k1>.<k2>       up-to-down latency from k1 to k2 (flight)
We reconstruct absolute times deterministically by walking keys in order:
  down_0       = 0.0
  up_i         = down_i + H.<key_i>
  down_{i+1}   = down_i + DD.<key_i>.<key_{i+1}>

CMU_PASSWORD_KEYS is the PRINTABLE-CHARACTER form of the password, so that
"".join(CMU_PASSWORD_KEYS[:10]) == ".tie5Roanl" and the char embedding sees the
real typed characters. These same symbols are used to build the H./DD. column
names this adapter reads, which keeps it self-consistent with the synthetic
test fixtures (the tests build rows as H.<char>, DD.<char>.<char>).

REAL-DATA CAVEAT (important): the ACTUAL CMU CSV header does NOT use printable
chars. It labels columns with key *names*, e.g. `H.period`, `DD.period.t`,
`H.five`, `H.Shift.r`, `H.Return` -- not `H..`, `H.5`, `H.r`, `H.<newline>`.
So this printable-char adapter matches the TEST fixtures but would need a
label-mapping layer (printable char <-> CMU column label) to read a real CMU
CSV. That mapping is intentionally NOT solved here: Task 10 (the CMU CLI / the
loader in ksbio/data/cmu.py) is responsible for translating real column labels
into these symbols (or for passing pre-mapped row dicts to this adapter). Do
not assume row_to_sequence can be pointed at a raw Killourhy-Maxion CSV row
as-is."""
from dataclasses import dataclass

# Printable characters of the CMU benchmark password ".tie5Roanl" followed by
# the Return key (newline). First 10 joined == ".tie5Roanl".
# NOTE the capital 'R' (the real password is ".tie5Roanl", typed with Shift+r).
# featurize.char_to_id lowercases before lookup, so 'R' is embedded as 'r'.
CMU_PASSWORD_KEYS = [".", "t", "i", "e", "5", "R", "o", "a", "n", "l", "\n"]


@dataclass
class _KS:
    char: str
    keyCode: str
    downTime: float
    upTime: float
    position: int
    isCorrect: bool = True


def _col(row, name, default=0.0):
    """Read a numeric CMU column, tolerating missing/blank values."""
    v = row.get(name, default)
    return float(v) if v not in (None, "") else default


def row_to_sequence(row):
    """row: dict of CMU columns -> list[_KS] in typed order.

    Walks CMU_PASSWORD_KEYS in order, reading H.<key> for hold times and
    DD.<key>.<nextkey> for down-to-down latencies, and reconstructs absolute
    down/up times. Each emitted _KS exposes featurize-compatible attributes
    (char, keyCode, downTime, upTime, position, isCorrect)."""
    keys = CMU_PASSWORD_KEYS
    seq = []
    down = 0.0
    for i, key in enumerate(keys):
        hold = _col(row, f"H.{key}")
        up = down + hold
        seq.append(_KS(char=key, keyCode=key, downTime=down, upTime=up,
                       position=i, isCorrect=True))
        if i < len(keys) - 1:
            dd = _col(row, f"DD.{key}.{keys[i+1]}")
            down = down + dd
    return seq
