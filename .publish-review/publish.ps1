# Run from an unrestricted PowerShell terminal. Uses the existing Git credentials.
$ErrorActionPreference = 'Stop'
$expectedHead = '2ee2a0102cbf8d1462b73865896e78ef0a406821'
$reviewRoot = $PSScriptRoot
$siteRoot = Join-Path $reviewRoot 'site'
$checkoutRoot = Join-Path $reviewRoot 'repository'
$files = @(
  '404.html', 'README.md', 'assets/css/sentinel.css', 'assets/fonts/fonts.css',
  'assets/js/download.js', 'assets/js/home.js', 'download.html', 'index.html',
  'manifest.webmanifest', 'pricing.html', 'privacy.html', 'terms.html',
  'refunds.html', 'tests/site.test.cjs'
)
if (Test-Path -LiteralPath $checkoutRoot) { throw "Checkout already exists: $checkoutRoot. Nothing was overwritten." }
git clone --branch main --single-branch https://github.com/wyattbombara/sentinel.git $checkoutRoot
if ($LASTEXITCODE -ne 0) { throw 'Git clone failed.' }
Push-Location -LiteralPath $checkoutRoot
try {
  $actualHead = (git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $actualHead -ne $expectedHead) { throw 'Remote main changed after review. Merge the newer version before publishing.' }
  foreach ($file in $files) {
    $destination = Join-Path $checkoutRoot $file
    $parent = Split-Path -Parent $destination
    if (!(Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
    Copy-Item -LiteralPath (Join-Path $siteRoot $file) -Destination $destination
  }
  node tests/site.test.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Regression checks failed; nothing was pushed.' }
  git diff --check
  if ($LASTEXITCODE -ne 0) { throw 'Diff validation failed; nothing was pushed.' }
  git add -- @files
  if ($LASTEXITCODE -ne 0) { throw 'Git staging failed.' }
  git commit -m 'Fix static site deployment paths and pin Sentinel v1.7.0 release'
  if ($LASTEXITCODE -ne 0) { throw 'Git commit failed.' }
  git push origin HEAD:main
  if ($LASTEXITCODE -ne 0) { throw 'Git push failed.' }
  Write-Host 'Pushed successfully. Check the GitHub Pages workflow at https://github.com/wyattbombara/sentinel/actions'
} finally {
  Pop-Location
}
