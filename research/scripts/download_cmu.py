"""Fetch the CMU Killourhy-Maxion 'DSL-StrongPasswordData' CSV and verify its
SHA-256, placing it under research/data/ (gitignored). Reproducible: same file,
verified digest, or a loud failure with manual instructions.

The public dataset page: https://www.cs.cmu.edu/~keystroke/  (DSL-StrongPasswordData.csv)
"""
import hashlib
import os
import sys
import urllib.request

DATA_REL_PATH = os.path.join("data", "cmu", "DSL-StrongPasswordData.csv")
# Public mirror; if it 404s, follow the manual instructions printed below.
CMU_URL = "https://www.cs.cmu.edu/~keystroke/DSL-StrongPasswordData.csv"
# Known digest of the canonical CSV. If the upstream file legitimately changes,
# update this constant in the SAME commit that records why.
EXPECTED_SHA256 = "REPLACE_WITH_MEASURED_DIGEST"

MANUAL = (
    "Manual download:\n"
    "  1. Visit https://www.cs.cmu.edu/~keystroke/\n"
    "  2. Download DSL-StrongPasswordData.csv\n"
    f"  3. Place it at research/{DATA_REL_PATH}\n"
    "  4. Re-run with --skip-download to verify the digest.\n")


def verify_sha256(path, expected):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest() == expected


def main(skip_download=False):
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # research/
    dest = os.path.join(here, DATA_REL_PATH)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if not skip_download:
        try:
            print(f"Downloading CMU dataset -> {dest}")
            urllib.request.urlretrieve(CMU_URL, dest)
        except Exception as e:                       # noqa: BLE001
            print(f"Download failed: {e}\n{MANUAL}", file=sys.stderr)
            return 1
    if not os.path.exists(dest):
        print(f"File missing.\n{MANUAL}", file=sys.stderr)
        return 1
    if EXPECTED_SHA256 == "REPLACE_WITH_MEASURED_DIGEST":
        actual = hashlib.sha256(open(dest, "rb").read()).hexdigest()
        print("No pinned digest yet. Measured digest of the downloaded file:")
        print(f"  {actual}")
        print("Set EXPECTED_SHA256 to this value (in a commit explaining why).")
        return 0
    if not verify_sha256(dest, EXPECTED_SHA256):
        print("DIGEST MISMATCH — refusing to use this file.", file=sys.stderr)
        return 1
    print("CMU dataset verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main(skip_download="--skip-download" in sys.argv))
