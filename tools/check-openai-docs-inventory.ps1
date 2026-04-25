param(
    [string]$Inventory = "docs/openai-url-inventory.yaml",
    [string]$DocsMap = "docs/openai-docs-map.yaml",
    [string]$CoreSummaries = "docs/openai-core-summaries.md",
    [string]$RelatedLinks = "docs/openai-related-links.md"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path ".").Path
$inventoryPath = Join-Path $repoRoot $Inventory
$docsMapPath = Join-Path $repoRoot $DocsMap
$corePath = Join-Path $repoRoot $CoreSummaries
$relatedPath = Join-Path $repoRoot $RelatedLinks

foreach ($path in @($inventoryPath, $docsMapPath, $corePath, $relatedPath)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing required file: $path"
    }
}

$inventoryText = Get-Content -LiteralPath $inventoryPath -Raw
$docsMapText = Get-Content -LiteralPath $docsMapPath -Raw
$coreText = Get-Content -LiteralPath $corePath -Raw
$relatedText = Get-Content -LiteralPath $relatedPath -Raw

$urls = [regex]::Matches($inventoryText, '^  - url:\s+"([^"]+)"', [System.Text.RegularExpressions.RegexOptions]::Multiline) |
    ForEach-Object { $_.Groups[1].Value }

if ($urls.Count -eq 0) {
    throw "No inventory entries found."
}

$duplicateUrls = $urls | Group-Object -CaseSensitive | Where-Object { $_.Count -gt 1 }
if ($duplicateUrls) {
    $names = ($duplicateUrls | Select-Object -First 10 -ExpandProperty Name) -join ", "
    throw "Duplicate inventory URLs found: $names"
}

foreach ($required in @(
    'https://developers.openai.com/',
    'https://developers.openai.com/api/docs/',
    'https://developers.openai.com/codex/',
    'https://developers.openai.com/apps-sdk/',
    'https://developers.openai.com/commerce/',
    'https://platform.openai.com/tokenizer'
)) {
    if ($urls -notcontains $required) {
        throw "Missing required URL: $required"
    }
}

foreach ($pattern in @('/api-keys/*', '/usage/*', '/settings/*', '/evaluations/*')) {
    if ($inventoryText -notmatch [regex]::Escape($pattern)) {
        throw "Missing robots exclusion pattern: $pattern"
    }
}

foreach ($section in @('api_reference:', 'api_get_started:', 'agents_sdk:', 'codex:', 'apps_sdk:', 'commerce:', 'examples_and_learning:')) {
    if ($docsMapText -notmatch [regex]::Escape($section)) {
        throw "Missing docs map section: $section"
    }
}

foreach ($source in @(
    'https://developers.openai.com/api/docs/guides/migrate-to-responses',
    'https://developers.openai.com/api/docs/guides/agents',
    'https://developers.openai.com/api/docs/guides/tools-computer-use',
    'https://developers.openai.com/apps-sdk',
    'https://developers.openai.com/commerce'
)) {
    if ($coreText -notmatch [regex]::Escape($source)) {
        throw "Core summaries missing source URL: $source"
    }
}

if ($relatedText -notmatch 'github.com' -or $relatedText -notmatch 'youtube.com') {
    throw "Related links inventory does not include expected external related links."
}

$failedCount = ([regex]::Matches($inventoryText, 'status:\s+"failed"')).Count
$externalCount = ([regex]::Matches($inventoryText, 'read_state:\s+"excluded_external_link"')).Count

Write-Output "Inventory check passed."
Write-Output "Inventory entries: $($urls.Count)"
Write-Output "Failed official entries: $failedCount"
Write-Output "External related entries: $externalCount"
