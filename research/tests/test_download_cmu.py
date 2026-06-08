import hashlib
import os
from download_cmu import verify_sha256, DATA_REL_PATH

def test_verify_sha256_accepts_correct_digest(tmp_path):
    p = os.path.join(tmp_path, "f.csv")
    content = b"subject,sessionIndex\ns001,1\n"
    with open(p, "wb") as f:
        f.write(content)
    digest = hashlib.sha256(content).hexdigest()
    assert verify_sha256(p, digest) is True

def test_verify_sha256_rejects_wrong_digest(tmp_path):
    p = os.path.join(tmp_path, "f.csv")
    with open(p, "wb") as f:
        f.write(b"hello")
    assert verify_sha256(p, "0" * 64) is False

def test_data_path_is_under_gitignored_data_dir():
    # must land under research/data/ (anchored /data/ is gitignored)
    assert DATA_REL_PATH.replace("\\", "/").startswith("data/")
