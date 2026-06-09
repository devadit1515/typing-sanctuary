"""Honest evaluation: embed genuine/impostor windows with the trained encoder,
score against a genuine profile using the ported ensemble, compute EER (spec
§5.3). EER comes from public-benchmark impostors ONLY — never self-data.

Two scorers are provided, deliberately:
  - eer_for_subject          PRIMARY: scaled-Manhattan only. This is the
                             apples-to-apples comparator for the published CMU
                             scaled-Manhattan baseline (Killourhy & Maxion 2009,
                             EER 0.0962). Never compare the ensemble below to that
                             baseline — that would rig the comparison.
  - eer_for_subject_ensemble SECONDARY: the production verifier (mean of
                             L1-to-centroid + k-NN + Ledoit-Wolf Mahalanobis),
                             byte-for-byte the same fusion as ml-service
                             app/verify.py, so the research EER and the served
                             /verify score agree (closes the train/serve verifier
                             gap). Report as a secondary "our production verifier
                             further reduces EER to X" number, not the headline.
"""
import numpy as np
import torch
from .ensemble import (compute_profile_stats, scaled_manhattan,
                       ledoit_wolf_shrinkage, mahalanobis_distance)
from .metrics import equal_error_rate


def embed_sequences(encoder, feats_list, cids_list):
    """feats_list: list of [n,T] tensors; cids_list: list of [n] tensors.
    Returns np.ndarray [n_windows, embed_dim] of L2-normalized embeddings."""
    out = []
    encoder.eval()
    with torch.no_grad():
        for feats, cids in zip(feats_list, cids_list):
            n = feats.shape[0]
            z = encoder(feats.unsqueeze(0), cids.unsqueeze(0),
                        torch.tensor([n]))
            out.append(z.squeeze(0).numpy())
    return np.vstack(out)


def eer_for_subject(encoder, gen_feats, gen_cids, imp_feats, imp_cids,
                    enroll_frac=0.5):
    """Split genuine into enroll/test, build a profile, score genuine-test and
    impostor windows, return (EER, threshold). Lower score = more genuine.

    Returns the EER for ONE subject (this subject genuine, others impostor). The
    honest benchmark figure is the MEAN of this across all subjects (the Task 10
    CLI aggregates) — never cite a single subject's EER as the system EER.

    The enroll/test split is positional (enroll = earlier windows, test = later):
    this is a deliberate, conservative train/test temporal separation (mildly
    pessimistic under session drift, never flattering)."""
    gen = embed_sequences(encoder, gen_feats, gen_cids)
    imp = embed_sequences(encoder, imp_feats, imp_cids)
    cut = max(1, int(len(gen) * enroll_frac))
    enroll, gen_test = gen[:cut], gen[cut:]
    profile = compute_profile_stats(enroll)
    if len(gen_test) == 0:
        raise ValueError(
            f"too few genuine windows ({len(gen)}) to hold out a test set at "
            f"enroll_frac={enroll_frac}: scoring the enrollment set would fabricate "
            f"a flattering EER. Provide more genuine windows or a lower enroll_frac.")
    gen_scores = np.array([scaled_manhattan(z, profile) for z in gen_test])
    imp_scores = np.array([scaled_manhattan(z, profile) for z in imp])
    return equal_error_rate(gen_scores, imp_scores)


def _l1_to_centroid(z, centroid):
    """Mean absolute deviation to the centroid — identical to verify.py
    `_l1_to_centroid` (sum |zi-ci| / d)."""
    return float(np.mean(np.abs(np.asarray(z, float) - centroid)))


def _knn_l1(z, refs, k=3):
    """Mean L1 distance to the k nearest reference embeddings — identical to
    verify.py `_knn` (per-dim-averaged L1, k=3, clamped to len(refs))."""
    z = np.asarray(z, float)
    dists = np.sort([float(np.mean(np.abs(z - r))) for r in refs])
    k = min(k, len(dists))
    return float(np.mean(dists[:k])) if k else 0.0


def _ensemble_score(z, centroid, refs, cov_inverse):
    """The production fusion (ml-service app/verify.py): the unweighted mean of
    L1-to-centroid, k-NN(L1), and Ledoit-Wolf Mahalanobis. When the shrinkage
    covariance is not invertible, Mahalanobis falls back to the L1-to-centroid
    term — exactly as verify.py does (`maha = ... if cov_inv else manhattan`)."""
    manhattan = _l1_to_centroid(z, centroid)
    knn = _knn_l1(z, refs)
    maha = (mahalanobis_distance(z, centroid, cov_inverse)
            if cov_inverse is not None else manhattan)
    return (manhattan + knn + maha) / 3.0


def eer_for_subject_ensemble(encoder, gen_feats, gen_cids, imp_feats, imp_cids,
                             enroll_frac=0.5):
    """SECONDARY metric: same honest enroll/test split and the same ValueError
    guard as `eer_for_subject`, but scores with the full production ensemble
    (mean of L1-to-centroid + k-NN + Ledoit-Wolf Mahalanobis) so the reported EER
    matches what the deployed /verify endpoint would compute. Returns
    (EER, threshold). Do NOT cite this against the scaled-Manhattan baseline."""
    gen = embed_sequences(encoder, gen_feats, gen_cids)
    imp = embed_sequences(encoder, imp_feats, imp_cids)
    eer, thr, _, _ = _eer_from_embeddings(gen, imp, enroll_frac,
                                          scorer="ensemble")
    return eer, thr


# --- Embedding-cache path (efficiency) --------------------------------------
# The per-call functions above re-embed their inputs every time. When scoring N
# held-out subjects, the SAME impostor windows would be embedded N times (once
# per target), and twice over for the two metrics — O(N) wasted forward passes.
# Callers that already hold embeddings (e.g. the Phase-1 CLI, which embeds every
# test window once) use `_eer_from_embeddings` / `scores_from_embeddings` to
# score directly, identical math, no redundant encoder passes.

def _scaled_manhattan_scores(profile, test_emb):
    return np.array([scaled_manhattan(z, profile) for z in test_emb])


def _ensemble_scores(centroid, enroll, cov_inverse, test_emb):
    return np.array([_ensemble_score(z, centroid, enroll, cov_inverse)
                     for z in test_emb])


def _eer_from_embeddings(gen, imp, enroll_frac=0.5, scorer="primary"):
    """Compute (EER, threshold) from already-embedded genuine/impostor arrays.
    `scorer` in {"primary" (scaled-Manhattan), "ensemble"}. Raises the same
    ValueError guard as the per-call functions when the test set would be empty."""
    gen = np.asarray(gen); imp = np.asarray(imp)
    cut = max(1, int(len(gen) * enroll_frac))
    enroll, gen_test = gen[:cut], gen[cut:]
    if len(gen_test) == 0:
        raise ValueError(
            f"too few genuine windows ({len(gen)}) to hold out a test set at "
            f"enroll_frac={enroll_frac}: scoring the enrollment set would "
            f"fabricate a flattering EER.")
    if scorer == "primary":
        profile = compute_profile_stats(enroll)
        gs = _scaled_manhattan_scores(profile, gen_test)
        is_ = _scaled_manhattan_scores(profile, imp)
    else:
        centroid = enroll.mean(axis=0)
        cov_inverse = ledoit_wolf_shrinkage(enroll)["inverse"]
        gs = _ensemble_scores(centroid, enroll, cov_inverse, gen_test)
        is_ = _ensemble_scores(centroid, enroll, cov_inverse, imp)
    eer, thr = equal_error_rate(gs, is_)
    return eer, thr, gs, is_
