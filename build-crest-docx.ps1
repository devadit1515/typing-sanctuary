# Rebuild the CREST Word documents from their markdown sources.
# Run after editing CREST_Gold_Report.md or CREST_Student_Profile_Form.md
# to keep the .docx files in sync. Requires pandoc (https://pandoc.org).
#
#   ./build-crest-docx.ps1
#
$ErrorActionPreference = "Stop"

if (-not (Get-Command pandoc -ErrorAction SilentlyContinue)) {
    Write-Error "pandoc not found on PATH. Install from https://pandoc.org and re-run."
    exit 1
}

$root = $PSScriptRoot

pandoc (Join-Path $root "CREST_Gold_Report.md") `
    -o (Join-Path $root "CREST_Gold_Report.docx") `
    --from gfm `
    --metadata title="Keystroke-Dynamics Verification - CREST Gold Report" `
    --metadata author="Devadit Jain"
Write-Host "Rebuilt CREST_Gold_Report.docx"

pandoc (Join-Path $root "CREST_Student_Profile_Form.md") `
    -o (Join-Path $root "CREST_Student_Profile_Form.docx") `
    --from gfm
Write-Host "Rebuilt CREST_Student_Profile_Form.docx"

Write-Host "Done. Both Word documents are now in sync with their markdown sources."
