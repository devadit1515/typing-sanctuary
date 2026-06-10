"""Honest hyperparameter sweep for Phase-1 CMU, using NESTED validation so the
test set stays pristine.

Protocol (the integrity-critical part):
  1. Split the 51 subjects into 35 train / 16 TEST with the headline seed. The 16
     test subjects are NEVER used here — they are reserved for the single final
     run in train_cmu.py. Tuning on them would contaminate the open-set claim.
  2. Within the 35 train subjects, carve a further split: ~24 inner-train / ~11
     VALIDATION subjects.
  3. For each hyperparameter config, train on the inner-train subjects only and
     measure EER on the validation subjects. This is what selects the config.
  4. Print a one-factor-at-a-time ablation table and the best config by
     validation primary (scaled-Manhattan) EER.

The selected config is then run ONCE on the 16 held-out test subjects (via
train_cmu.py --seeds ...) to produce the reported number. Because the test set is
touched exactly once, with a config chosen without ever seeing it, the final EER
is an honest open-set estimate.

Run:  PYTHONPATH=. python scripts/sweep_cmu.py --csv data/cmu/DSL-StrongPasswordData.csv
"""
import argparse
import json
import time
import numpy as np
from dataclasses import replace
from train_cmu import (_samples_from_csv, split_subjects, train_on_subjects,
                       _eval_test_subjects, Phase1Args)


def _inner_split(train_subjects, seed, val_frac=0.31):
    """Carve the 35 train subjects into inner-train vs validation, seeded and
    disjoint. Mirrors split_subjects but on the train pool only."""
    rng = np.random.RandomState(seed + 1000)  # offset so it differs from the outer split
    order = list(train_subjects)
    rng.shuffle(order)
    n_val = max(2, int(round(len(order) * val_frac)))
    val = sorted(order[:n_val])
    inner_train = sorted(order[n_val:])
    return inner_train, val


def eval_config(by_subject, inner_train, val_subjects, base_args, **overrides):
    """Train on inner_train with the given hyperparameter overrides, eval on val.
    Returns (primary_eer, ensemble_eer, seconds)."""
    args = replace(base_args, **overrides)
    t0 = time.time()
    enc, history = train_on_subjects(by_subject, inner_train, args)
    assert not (set(val_subjects) & set(inner_train)), "validation leak!"
    ev = _eval_test_subjects(enc, by_subject, val_subjects)
    return ev["mean_primary"], ev["mean_secondary"], time.time() - t0, history["loss"][-1]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--csv", dest="csv_path", required=True)
    p.add_argument("--seed", type=int, default=42, help="outer split seed (matches headline)")
    p.add_argument("--out", default="artifacts/sweep_results.json")
    a = p.parse_args()

    samples, by_subject = _samples_from_csv(a.csv_path, a.seed)
    subjects = list(by_subject.keys())
    train_subjects, test_subjects = split_subjects(subjects, a.seed)
    inner_train, val_subjects = _inner_split(train_subjects, a.seed)
    print(f"subjects: {len(subjects)} total | {len(train_subjects)} train "
          f"({len(inner_train)} inner-train + {len(val_subjects)} validation) | "
          f"{len(test_subjects)} TEST (reserved, untouched here)")
    assert not (set(test_subjects) & set(train_subjects)), "test/train leak"
    assert not (set(val_subjects) & set(inner_train)), "val/inner-train leak"

    base = Phase1Args(a.csv_path, "artifacts/_sweep.pt", embed_dim=128, epochs=60,
                      seed=a.seed, margin=0.2, center_weight=0.01,
                      samples_per_subject=2)

    # One-factor-at-a-time ablation from the original cmu-v1 baseline config.
    configs = [
        ("baseline (original cmu-v1)", {}),
        ("samples_per_subject=4",      {"samples_per_subject": 4}),
        ("samples_per_subject=8",      {"samples_per_subject": 8}),
        ("epochs=120",                 {"epochs": 120}),
        ("margin=0.3",                 {"margin": 0.3}),
        ("center_weight=0.05",         {"center_weight": 0.05}),
    ]

    results = []
    print(f"\n{'config':32s}  {'val primary':>11s}  {'val ensemble':>12s}  {'sec':>5s}  {'loss':>6s}")
    print("-" * 76)
    for name, ov in configs:
        prim, ens, secs, loss = eval_config(by_subject, inner_train, val_subjects, base, **ov)
        results.append({"config": name, "overrides": ov, "val_primary_eer": prim,
                        "val_ensemble_eer": ens, "seconds": secs, "final_loss": loss})
        print(f"{name:32s}  {prim:11.4f}  {ens:12.4f}  {secs:5.0f}  {loss:6.3f}", flush=True)

    # Build a combined "tuned" config from every override that beat baseline on
    # validation primary EER, then validate the combination too.
    baseline_prim = results[0]["val_primary_eer"]
    tuned = {}
    for r in results[1:]:
        if r["val_primary_eer"] < baseline_prim:
            tuned.update(r["overrides"])
    if tuned:
        prim, ens, secs, loss = eval_config(by_subject, inner_train, val_subjects, base, **tuned)
        results.append({"config": f"tuned-combined {tuned}", "overrides": tuned,
                        "val_primary_eer": prim, "val_ensemble_eer": ens,
                        "seconds": secs, "final_loss": loss})
        print(f"{'tuned-combined':32s}  {prim:11.4f}  {ens:12.4f}  {secs:5.0f}  {loss:6.3f}", flush=True)

    best = min(results, key=lambda r: r["val_primary_eer"])
    print("\nBEST config by validation primary EER:")
    print(f"  {best['config']}  ->  val primary {best['val_primary_eer']:.4f} | "
          f"val ensemble {best['val_ensemble_eer']:.4f}")
    print(f"  overrides to apply for the final TEST run: {best['overrides']}")

    out = {"outer_seed": a.seed, "n_inner_train": len(inner_train),
           "n_validation": len(val_subjects), "n_test_reserved": len(test_subjects),
           "results": results, "best": best}
    import os
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nwrote {a.out}")


if __name__ == "__main__":
    main()
