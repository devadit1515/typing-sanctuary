import torch
from ksbio.seeds import set_global_seed
from ksbio.triplet import batch_hard_triplet_loss, center_loss

def test_loss_is_zero_when_classes_are_well_separated():
    # two classes, each at a distinct unit vector, margin satisfied
    set_global_seed(0)
    emb = torch.tensor([[1.0, 0.0], [0.99, 0.01],   # class 0 (close together)
                        [0.0, 1.0], [0.01, 0.99]])  # class 1 (close together)
    emb = torch.nn.functional.normalize(emb, dim=1)
    labels = torch.tensor([0, 0, 1, 1])
    loss = batch_hard_triplet_loss(emb, labels, margin=0.2)
    assert loss.item() < 1e-3

def test_loss_is_positive_when_impostor_is_closer_than_self():
    # anchor's same-class partner is FAR, an other-class point is NEAR -> penalty
    emb = torch.tensor([[1.0, 0.0],     # a0 (class 0)
                        [-1.0, 0.0],    # a1 (class 0) but opposite side
                        [0.9, 0.1]])    # b0 (class 1) close to a0
    emb = torch.nn.functional.normalize(emb, dim=1)
    labels = torch.tensor([0, 0, 1])
    loss = batch_hard_triplet_loss(emb, labels, margin=0.2)
    assert loss.item() > 0.0

def test_center_loss_shrinks_intra_class_spread():
    emb = torch.tensor([[1.0, 0.0], [0.0, 1.0]])  # same label, far apart
    labels = torch.tensor([0, 0])
    spread = center_loss(emb, labels)
    assert spread.item() > 0.0
    tight = center_loss(torch.tensor([[1.0, 0.0], [1.0, 0.0]]),
                        torch.tensor([0, 0]))
    assert tight.item() < 1e-6

def test_degenerate_batch_returns_backpropable_zero():
    # No two samples share a label -> no valid triplets. Loss must be exactly 0
    # AND remain connected to the autograd graph so training never crashes on a
    # degenerate batch. (Guards the emb.sum()*0.0 idiom against being replaced
    # by a detached torch.tensor(0.0).)
    emb = torch.randn(4, 8, requires_grad=True)
    loss = batch_hard_triplet_loss(emb, torch.tensor([0, 1, 2, 3]), margin=0.2)
    assert loss.item() == 0.0
    loss.backward()  # must not raise
    assert emb.grad is not None

def test_gradient_flows_in_normal_case():
    # A batch with real positives and negatives must produce nonzero gradients,
    # i.e. the loss can actually train the encoder.
    set_global_seed(0)
    emb = torch.nn.functional.normalize(
        torch.randn(6, 8), dim=1).detach().requires_grad_(True)
    labels = torch.tensor([0, 0, 1, 1, 2, 2])
    loss = batch_hard_triplet_loss(emb, labels, margin=0.2)
    loss.backward()
    assert emb.grad is not None
    assert float(emb.grad.abs().sum()) > 0.0

def test_margin_is_monotonic():
    # Larger margin -> larger (or equal) loss for the same embeddings.
    set_global_seed(1)
    emb = torch.nn.functional.normalize(torch.randn(6, 8), dim=1)
    labels = torch.tensor([0, 0, 1, 1, 2, 2])
    l_small = batch_hard_triplet_loss(emb, labels, margin=0.1)
    l_big = batch_hard_triplet_loss(emb, labels, margin=0.5)
    assert float(l_big) >= float(l_small)
