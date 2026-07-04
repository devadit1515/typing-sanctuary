# Rebuild the CREST Student Profile Form .docx from its markdown source.
# Run after editing CREST_Student_Profile_Form.md to keep the .docx in sync.
# Requires pandoc (https://pandoc.org).
#
# NOTE: CREST_Gold_Report.docx is edited directly in Word and has NO markdown
# source any more (the stale CREST_Gold_Report.md was deleted). Never
# regenerate the report .docx from this script or from any markdown file.
#
#   ./build-crest-docx.ps1
#
$ErrorActionPreference = "Stop"

if (-not (Get-Command pandoc -ErrorAction SilentlyContinue)) {
    Write-Error "pandoc not found on PATH. Install from https://pandoc.org and re-run."
    exit 1
}

$root = $PSScriptRoot

pandoc (Join-Path $root "CREST_Student_Profile_Form.md") `
    -o (Join-Path $root "CREST_Student_Profile_Form.docx") `
    --from gfm
Write-Host "Rebuilt CREST_Student_Profile_Form.docx"
