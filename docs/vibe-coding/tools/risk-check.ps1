<#
.SYNOPSIS
  Read-only risk classifier for deterministic Strict triggers.
.DESCRIPTION
  Evaluates planned paths or current git changes against tools/config/risk-rules.json.
  This script never modifies files, commits, or git state.
.PARAMETER PlannedPaths
  Optional explicit path list to classify (repo-relative or absolute).
.PARAMETER UseGitChanges
  Classify current git status paths (tracked + untracked) from the working tree.
  If neither PlannedPaths nor UseGitChanges is provided, UseGitChanges is assumed.
.PARAMETER RulesPath
    Optional explicit path to risk-rules.json.
.PARAMETER Json
  Emit machine-readable JSON result.
#>
[CmdletBinding()]
param(
    [string[]]$PlannedPaths,
    [switch]$UseGitChanges,
        [string]$RulesPath,
    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Normalize-PathText {
    param([Parameter(Mandatory)][string]$PathText)

    $p = $PathText.Trim()
    if ($p -match ' -> (.+)$') {
        $p = $Matches[1]
    }

    $p = $p -replace '\\', '/'
    $p = $p.TrimStart('./')
    return $p
}

function Normalize-Pattern {
    param([Parameter(Mandatory)][string]$Pattern)

    $p = ($Pattern -replace '\\', '/').Trim()
    while ($p.Contains('**')) {
        $p = $p.Replace('**', '*')
    }
    return $p
}

function Test-MatchAnyPattern {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string[]]$Patterns
    )

    foreach ($pattern in $Patterns) {
        if ($Path -like $pattern) {
            return $true
        }
    }
    return $false
}

function Write-FailClosed {
    param(
        [Parameter(Mandatory)][string]$Reason,
        [string[]]$AttemptedPaths
    )

    Write-Host 'RiskCheck=UNKNOWN'
    Write-Host 'StrictRequired=YES'
    Write-Host ("Reason=FailClosed: {0}" -f $Reason)
    if ($AttemptedPaths -and $AttemptedPaths.Count -gt 0) {
        Write-Host ("AttemptedPaths={0}" -f ($AttemptedPaths -join '; '))
    }
    exit 1
}

$repoRoot = $null
$repoRootError = $null
try {
    $repoRootRaw = ((git rev-parse --show-toplevel 2>$null) | Select-Object -First 1)
    if ($repoRootRaw) {
        $repoRoot = $repoRootRaw.Trim()
    } else {
        $repoRootError = 'Unable to resolve repo root via git rev-parse --show-toplevel.'
    }
} catch {
    $repoRootError = 'Unable to resolve repo root via git rev-parse --show-toplevel.'
}

$candidateRulesPaths = [System.Collections.Generic.List[string]]::new()

if ($RulesPath) {
    try {
        if ([System.IO.Path]::IsPathRooted($RulesPath)) {
            $candidateRulesPaths.Add([System.IO.Path]::GetFullPath($RulesPath)) | Out-Null
        } else {
            $candidateRulesPaths.Add([System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $RulesPath))) | Out-Null
        }
    } catch {
        # Ignore malformed explicit path; fail-closed will report attempted candidates.
    }
}

$candidateRulesPaths.Add([System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'config/risk-rules.json'))) | Out-Null
$candidateRulesPaths.Add([System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'risk-rules.json'))) | Out-Null

if ($repoRoot) {
    $candidateRulesPaths.Add([System.IO.Path]::GetFullPath((Join-Path $repoRoot 'tools/config/risk-rules.json'))) | Out-Null
    $candidateRulesPaths.Add([System.IO.Path]::GetFullPath((Join-Path $repoRoot 'risk-rules.json'))) | Out-Null
}

$candidateRulesPaths = [System.Collections.Generic.List[string]]@($candidateRulesPaths | Select-Object -Unique)

$rulesPath = $null
foreach ($candidate in $candidateRulesPaths) {
    if (Test-Path -LiteralPath $candidate) {
        $rulesPath = $candidate
        break
    }
}

if (-not $rulesPath) {
    Write-FailClosed -Reason 'rules file could not be found in expected locations.' -AttemptedPaths @($candidateRulesPaths)
}

try {
    $rules = Get-Content -LiteralPath $rulesPath -Raw | ConvertFrom-Json
} catch {
    Write-FailClosed -Reason 'rules file could not be parsed as JSON.' -AttemptedPaths @($candidateRulesPaths)
}

if (-not $PlannedPaths -or $PlannedPaths.Count -eq 0) {
    $UseGitChanges = $true
}

$paths = [System.Collections.Generic.List[string]]::new()
$renameCount = 0
$deleteCount = 0

if ($UseGitChanges) {
    if (-not $repoRoot) {
        $repoReason = 'repo root could not be determined for git change scan.'
        if ($repoRootError) {
            $repoReason = $repoRootError
        }
        Write-FailClosed -Reason $repoReason -AttemptedPaths @($candidateRulesPaths)
    }

    Push-Location $repoRoot
    try {
        $statusLines = @(git status --porcelain -u 2>$null | Where-Object { $_ })
    } finally {
        Pop-Location
    }

    foreach ($line in $statusLines) {
        if ($line.Length -lt 4) { continue }
        $statusCode = $line.Substring(0, 2)
        $pathText = $line.Substring(3)
        $normalized = Normalize-PathText -PathText $pathText
        if (-not [string]::IsNullOrWhiteSpace($normalized)) {
            $paths.Add($normalized)
        }

        if ($statusCode -match 'R') { $renameCount++ }
        if ($statusCode -match 'D') { $deleteCount++ }
    }
}

if ($PlannedPaths -and $PlannedPaths.Count -gt 0) {
    foreach ($p in $PlannedPaths) {
        if (-not [string]::IsNullOrWhiteSpace($p)) {
            $paths.Add((Normalize-PathText -PathText $p))
        }
    }
}

$paths = @($paths | Where-Object { $_ } | Select-Object -Unique)

$keywordTriggers = @($rules.keywordTriggers | ForEach-Object { ("$_").ToLowerInvariant() })
$pathPatterns = @($rules.pathPatternTriggers | ForEach-Object { Normalize-Pattern -Pattern ("$_") })
$sensitiveFiles = @($rules.sensitiveFileTriggers | ForEach-Object { Normalize-Pattern -Pattern ("$_") })
$maxChangedFilesLite = [int]$rules.maxChangedFilesLite

$reasons = [System.Collections.Generic.List[string]]::new()
$matchedPaths = [System.Collections.Generic.List[string]]::new()
$matchedKeywords = [System.Collections.Generic.List[string]]::new()

if ($paths.Count -gt $maxChangedFilesLite) {
    $reasons.Add("ChangedFileCount>$maxChangedFilesLite") | Out-Null
}

if ([bool]$rules.strictOnDelete -and $deleteCount -gt 0) {
    $reasons.Add("DeleteDetected=$deleteCount") | Out-Null
}

if ([bool]$rules.strictOnRename -and $renameCount -gt 0) {
    $reasons.Add("RenameDetected=$renameCount") | Out-Null
}

foreach ($path in $paths) {
    $pathLower = $path.ToLowerInvariant()

    if (Test-MatchAnyPattern -Path $path -Patterns $pathPatterns) {
        $matchedPaths.Add($path) | Out-Null
        $reasons.Add("PathTrigger:$path") | Out-Null
    }

    if (Test-MatchAnyPattern -Path $path -Patterns $sensitiveFiles) {
        $matchedPaths.Add($path) | Out-Null
        $reasons.Add("SensitiveFile:$path") | Out-Null
    }

    foreach ($kw in $keywordTriggers) {
        if ($pathLower.Contains($kw)) {
            $matchedKeywords.Add($kw) | Out-Null
            $reasons.Add("Keyword:$kw") | Out-Null
        }
    }
}

$uniqueReasons = @($reasons | Select-Object -Unique)
$strictRequired = ($uniqueReasons.Count -gt 0)
$riskCheck = if ($strictRequired) { 'STRICT' } else { 'LITE' }

$result = [ordered]@{
    policyName = [string]$rules.policyName
    policyVersion = [string]$rules.version
    mode = if ($UseGitChanges -and $PlannedPaths) { 'git+planned' } elseif ($UseGitChanges) { 'git' } else { 'planned' }
    pathCount = $paths.Count
    strictRequired = $strictRequired
    riskCheck = $riskCheck
    matchedPaths = @($matchedPaths | Select-Object -Unique)
    matchedKeywords = @($matchedKeywords | Select-Object -Unique)
    reasons = $uniqueReasons
}

if ($Json) {
    $result | ConvertTo-Json -Depth 6
} else {
    Write-Host ("RiskCheck={0}" -f $result.riskCheck)
    Write-Host ("StrictRequired={0}" -f ($(if ($result.strictRequired) { 'YES' } else { 'NO' })))
    Write-Host ("PathCount={0}" -f $result.pathCount)

    if ($result.reasons.Count -eq 0) {
        Write-Host 'Reasons=None'
    } else {
        Write-Host 'Reasons:'
        foreach ($reason in $result.reasons) {
            Write-Host ("  - {0}" -f $reason)
        }
    }
}

exit 0
