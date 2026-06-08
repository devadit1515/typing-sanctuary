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
