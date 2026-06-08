"""Honest evaluation: embed genuine/impostor windows with the trained encoder,
score against a genuine profile using the ported ensemble, compute EER (spec
§5.3). EER comes from public-benchmark impostors ONLY — never self-data."""
import numpy as np
import torch
from .ensemble import compute_profile_stats, scaled_manhattan
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
