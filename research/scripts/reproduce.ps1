# Reproduce the Phase-1 CMU keystroke-biometric result end to end (CPU, $0).
# Exits non-zero on ANY failure so it doubles as a CI gate / CREST reproducibility
# proof. Run from the research/ directory:
#
#   pwsh -File scripts/reproduce.ps1
#
# Prereqs: the gitignored CMU CSV at data/cmu/DSL-StrongPasswordData.csv. If
# absent, run `python scripts/download_cmu.py` first (downloads + prints the SHA).

$ErrorActionPreference = "Stop"
$env:PYTHONPATH = "."

# A loose ceiling: the open-set scaled-Manhattan EER must be well below chance
# (0.5). It is NOT expected to beat the 0.0962 published baseline at this model
# scale — the point is a reproducible, honest number, not a record.
$EER_CEILING = 0.30

Write-Host "== 1/5  Verify the pinned CMU dataset ============================="
python scripts/download_cmu.py --skip-download
if ($LASTEXITCODE -ne 0) { throw "CMU dataset missing or digest mismatch" }

Write-Host "== 2/5  Train (open-set, 3 seeds) + write metrics.json ==========="
python scripts/train_cmu.py --csv data/cmu/DSL-StrongPasswordData.csv `
    --artifact artifacts/cmu-v1.pt --embed-dim 128 --epochs 60 `
    --seeds 42,43,44 --version cmu-v1 --metrics-out artifacts/metrics.json
if ($LASTEXITCODE -ne 0) { throw "training failed" }

Write-Host "== 3/5  Assert the headline EER is sane =========================="
$metrics = Get-Content artifacts/metrics.json | ConvertFrom-Json
$eer = $metrics.primary_eer_mean
Write-Host ("   open-set scaled-Manhattan EER = {0:N4} +/- {1:N4} ({2} seeds, {3} held-out subjects)" -f `
    $eer, $metrics.primary_eer_std, $metrics.n_seeds, $metrics.n_test_subjects)
Write-Host ("   ensemble EER = {0:N4} ; published baseline = {1:N4}" -f `
    $metrics.secondary_eer_full_ensemble, $metrics.baseline_eer_published_scaled_manhattan)
if ($eer -gt $EER_CEILING) {
    throw "EER $eer exceeds ceiling $EER_CEILING -- result regressed"
}
if ($metrics.n_train_subjects + $metrics.n_test_subjects -ne $metrics.n_subjects_total) {
    throw "open-set split does not partition all subjects"
}

Write-Host "== 4/5  Generate figures (DET curve + t-SNE) ====================="
python scripts/make_figures.py --metrics artifacts/metrics.json `
    --csv data/cmu/DSL-StrongPasswordData.csv --artifact artifacts/cmu-v1.pt `
    --out-dir artifacts
if ($LASTEXITCODE -ne 0) { throw "figure generation failed" }

Write-Host "== 5/5  Run the test suites ======================================"
python -m pytest -q
if ($LASTEXITCODE -ne 0) { throw "research tests failed" }
Push-Location ..
npm test --silent
$nodeExit = $LASTEXITCODE
Pop-Location
if ($nodeExit -ne 0) { throw "node tests failed" }

Write-Host ""
Write-Host "REPRODUCED OK -- artifacts/metrics.json, det_curve.png, tsne.png written." -ForegroundColor Green
