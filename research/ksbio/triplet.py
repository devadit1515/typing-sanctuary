"""Triplet loss with batch-hard mining + a center regularizer (spec §4.3).
Distances are squared-Euclidean on L2-normalized embeddings (monotonic in angle).
Batch-hard: for each anchor, hardest positive (farthest same-class) and hardest
negative (closest other-class) within the batch."""
import torch
import torch.nn.functional as F


def _pairwise_sq_dists(emb):
    # emb: [b,d] -> [b,b] squared euclidean
    prod = emb @ emb.t()
    sq = torch.diagonal(prod)
    d = sq.unsqueeze(0) - 2 * prod + sq.unsqueeze(1)
    return d.clamp(min=0.0)


def batch_hard_triplet_loss(emb, labels, margin=0.2):
    d = _pairwise_sq_dists(emb)                       # [b,b]
    same = labels.unsqueeze(0) == labels.unsqueeze(1) # [b,b] bool
    eye = torch.eye(len(labels), dtype=torch.bool, device=emb.device)
    pos_mask = same & ~eye
    neg_mask = ~same
    # hardest positive: max distance among same-class (0 if none)
    pos_d = (d * pos_mask).max(dim=1).values
    # hardest negative: min distance among other-class (inf if none)
    neg_d = d.masked_fill(~neg_mask, float("inf")).min(dim=1).values
    valid = pos_mask.any(dim=1) & neg_mask.any(dim=1)
    losses = F.relu(pos_d - neg_d + margin)
    losses = losses[valid]
    return losses.mean() if losses.numel() else emb.sum() * 0.0


def center_loss(emb, labels):
    """Mean squared distance of each embedding to its class centroid."""
    total = emb.sum() * 0.0
    count = 0
    for lab in labels.unique():
        m = labels == lab
        group = emb[m]
        centroid = group.mean(dim=0, keepdim=True)
        total = total + ((group - centroid) ** 2).sum()
        count += group.shape[0]
    return total / max(count, 1)
