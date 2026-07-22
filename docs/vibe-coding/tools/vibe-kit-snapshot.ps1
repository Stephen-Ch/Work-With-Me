<#
.SYNOPSIS
  Generates and validates VIBE-KIT-SNAPSHOT.md for AI assistant context loading.
.DESCRIPTION
  Produces <DOCS_ROOT>/forGPT/VIBE-KIT-SNAPSHOT.md from canonical kit files.
    Owner-only policy: generation is allowed in kit-source context only.
    In consumer context, this script reports WARN if snapshot artifacts are found.
  Supports validate-only mode for drift checks.

  Validation reports WARN when:
  - snapshot is missing
  - snapshot version mismatches VIBE-CODING.VERSION.md
  - snapshot appears hand-edited (marker/signature mismatch)
  - snapshot appears stale (snapshot commit != current HEAD)
#>
[CmdletBinding()]
param(
    [switch]$ValidateOnly,
    [switch]$WhatIf,
    [string]$RepoRoot,
    [string]$DocsRoot,
    [switch]$Quiet
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    param([string]$Hint)
    if ($Hint -and (Test-Path $Hint)) {
        return (Resolve-Path $Hint).Path
    }
    try {
        return ((git rev-parse --show-toplevel 2>$null) | Out-String).Trim() -replace '/', '\\'
    } catch {
        throw "Not inside a git repository and RepoRoot was not provided."
    }
}

function Get-DocsRoot {
    param(
        [Parameter(Mandatory)][string]$ResolvedRepoRoot,
        [string]$Hint
    )

    if ($Hint) {
        return $Hint
    }

    $deDir = Join-Path $ResolvedRepoRoot "docs-engineering"
    $docsDir = Join-Path $ResolvedRepoRoot "docs"
    if ((Test-Path $deDir) -and ((Test-Path (Join-Path $deDir "vibe-coding")) -or (Test-Path (Join-Path $deDir "forGPT")))) {
        return "docs-engineering"
    }
    if (Test-Path $docsDir) {
        return "docs"
    }
    return "docs"
}

function Get-CanonicalRoot {
    param(
        [Parameter(Mandatory)][string]$ResolvedRepoRoot,
        [Parameter(Mandatory)][string]$ResolvedDocsRoot
    )

    $consumerKitRoot = Join-Path $ResolvedRepoRoot (Join-Path $ResolvedDocsRoot "vibe-coding")
    $consumerVersion = Join-Path $consumerKitRoot "VIBE-CODING.VERSION.md"
    if (Test-Path $consumerVersion) {
        return [pscustomobject]@{
            Path = $consumerKitRoot
            Display = "$ResolvedDocsRoot/vibe-coding"
            Context = "consumer"
        }
    }

    $kitVersion = Join-Path $ResolvedRepoRoot "VIBE-CODING.VERSION.md"
    if (Test-Path $kitVersion) {
        return [pscustomobject]@{
            Path = $ResolvedRepoRoot
            Display = "."
            Context = "kit-source"
        }
    }

    throw "Could not locate canonical kit root."
}

function Parse-VersionInfo {
    param([Parameter(Mandatory)][string]$VersionContent)

    $version = "(unknown)"
    $effective = "(unknown)"

    if ($VersionContent -match '\*\*Version:\*\*\s*(v[\d.]+)') {
        $version = $Matches[1]
    }
    if ($VersionContent -match '\*\*Effective Date:\*\*\s*(\d{4}-\d{2}-\d{2})') {
        $effective = $Matches[1]
    }

    return [pscustomobject]@{
        Version = $version
        Effective = $effective
    }
}

function Get-RecentChanges {
    param([Parameter(Mandatory)][string]$VersionContent)

    $entries = @()
    $sections = [regex]::Split($VersionContent, '(?m)^## What Changed in ')
    foreach ($section in $sections) {
        if (-not $section.Trim()) { continue }
        $lines = $section -split "`r?`n"
        if ($lines.Count -eq 0) { continue }
        $header = $lines[0].Trim()
        if ($header -notmatch '^(v[\d.]+)') { continue }
        $ver = $Matches[1]

        $firstBullet = $null
        foreach ($line in $lines) {
            $trim = $line.Trim()
            if ($trim.StartsWith("- ")) {
                $firstBullet = $trim.Substring(2)
                break
            }
        }

        if (-not $firstBullet) {
            $firstBullet = "No summary bullet found in changelog entry."
        }

        $entries += [pscustomobject]@{
            Version = $ver
            Summary = $firstBullet
        }

        if ($entries.Count -ge 2) { break }
    }

    return $entries
}

function Limit-SectionLines {
    param(
        [Parameter(Mandatory)][string[]]$Lines,
        [Parameter(Mandatory)][int]$MaxLines,
        [string]$TruncationLine
    )

    if ($Lines.Count -le $MaxLines) {
        return $Lines
    }

    if (-not $TruncationLine) {
        $TruncationLine = "- See canonical docs for full detail."
    }

    $headCount = [Math]::Max($MaxLines - 1, 0)
    $trimmed = @()
    if ($headCount -gt 0) {
        $trimmed += $Lines[0..($headCount - 1)]
    }
    $trimmed += $TruncationLine
    return $trimmed
}

function Compute-Sha256 {
    param([Parameter(Mandatory)][string]$Text)

    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
        $hashBytes = $sha.ComputeHash($bytes)
        return ([System.BitConverter]::ToString($hashBytes)).Replace("-", "").ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
}

function Build-Payload {
    param(
        [Parameter(Mandatory)][pscustomobject]$VersionInfo,
        [Parameter(Mandatory)][object[]]$RecentChanges
    )

    $lines = @()
    $lines += "## Current Kit State"
    $lines += ""
    $lines += "- Kit Version: $($VersionInfo.Version)"
    $lines += "- Effective Date: $($VersionInfo.Effective)"
    $lines += ""
    $lines += "## Canonical Docs"
    $lines += ""
    $lines += "- VIBE-CODING.VERSION.md"
    $lines += "- protocol/protocol-v7.md"
    $lines += "- session-start-checklist.md"
    $lines += "- protocol/working-agreement-v1.md"
    $lines += "- protocol/x-branch-contract.md"
    $lines += "- standards/research-standard.md"
    $lines += "- See details in canonical files only (snapshot stays summary-only)."
    $lines += ""
    $lines += "## Core Non-Negotiables"
    $lines += ""
    $lines += "- Prompt Review Gate, Proof-of-Read, and Comprehension Self-Check are mandatory before work."
    $lines += '- NEXT alignment is required before saying "Best next step? YES".'
    $lines += "- No Guessing rule applies: collect evidence before implementation claims."
    $lines += "- Tiered confidence applies to all completion claims (>=95% or >=99% where required)."
    $lines += "- Stack-aware Green Gate checks must pass before commit."
    $lines += "- X-branch experiments are never merged and must end with findings + deletion."
    $lines += "- End-session clean-close is valid only when Active Lane, Remote Reality, and Workspace Reality all PASS."
    $lines += ""
    $lines += "## Vibe Skills"
    $lines += ""
    $skillLines = @(
        "- vibe-plan: Session-start planning shorthand for NEXT-aligned execution setup and prompt framing. See: protocol/protocol-v7.md section Vibe Skills.",
        "- vibe-hunt: Evidence-first investigation shorthand for unknown failures before proposing implementation. See: protocol/protocol-v7.md section Vibe Skills.",
        "- vibe-check: Validation/reporting shorthand for diff-aware checks and confidence-backed completion claims. See: protocol/protocol-v7.md section Vibe Skills."
    )
    $lines += (Limit-SectionLines -Lines $skillLines -MaxLines 6 -TruncationLine "- See: protocol/protocol-v7.md section Vibe Skills.")
    $lines += ""
    $lines += "## Research Readiness Sweep"
    $lines += ""
    $rrsLines = @(
        "- Trigger only when one condition applies: new EPIC start, multi-repo planning, or heavy AI/research usage.",
        "- Do not run for normal small-scope or in-progress execution work.",
        "- Output limit: max 3-5 gaps and max 1-3 recommended research docs.",
        "- Every gap must map directly to near-term NEXT work.",
        "- If a gap has no concrete NEXT tie, exclude it.",
        "- See: protocol/protocol-v7.md section Triggered Micro-Routine: Research Readiness Sweep."
    )
    $lines += (Limit-SectionLines -Lines $rrsLines -MaxLines 8 -TruncationLine "- See: protocol/protocol-v7.md section Triggered Micro-Routine: Research Readiness Sweep.")
    $lines += ""
    $lines += "## X-Branch Rule Summary"
    $lines += ""
    $xBranchLines = @(
        "- Use x/ branches only for uncertain, discardable experiments.",
        "- X-branches are never merged into long-lived branches.",
        "- Every x-branch must produce findings, then be deleted.",
        "- See: protocol/x-branch-contract.md."
    )
    $lines += (Limit-SectionLines -Lines $xBranchLines -MaxLines 5 -TruncationLine "- See: protocol/x-branch-contract.md.")
    $lines += ""
    $lines += "## End-Session Rule Summary"
    $lines += ""
    $endLines = @(
        "- CLEAN FIELD READY is YES only if Active Lane, Remote Reality, and Workspace Reality are all PASS.",
        "- Any NO/BLOCKED result means closeout failed and must be resolved.",
        "- End-session checks are mandatory before handoff or pause claims.",
        "- See: protocol/protocol-v7.md section End-of-Session Full Contract."
    )
    $lines += (Limit-SectionLines -Lines $endLines -MaxLines 5 -TruncationLine "- See: protocol/protocol-v7.md section End-of-Session Full Contract.")
    $lines += ""
    $lines += "## Recent Changes"
    $lines += ""

    $changeLines = @()
    if ($RecentChanges.Count -gt 0) {
        foreach ($entry in $RecentChanges) {
            $changeLines += "- $($entry.Version): $($entry.Summary)"
        }
    } else {
        $changeLines += "- No changelog entries parsed. See: VIBE-CODING.VERSION.md"
    }
    $lines += (Limit-SectionLines -Lines $changeLines -MaxLines 2 -TruncationLine "- See: VIBE-CODING.VERSION.md")
    $lines += ""
    $lines += "## Usage Instruction"
    $lines += ""
    $lines += "This file is a summary. Read canonical docs before executing work."

    return ($lines -join "`n")
}

function Build-Document {
    param(
        [Parameter(Mandatory)][pscustomobject]$VersionInfo,
        [Parameter(Mandatory)][string]$GeneratedUtc,
        [Parameter(Mandatory)][string]$HeadCommit,
        [Parameter(Mandatory)][string]$Payload,
        [Parameter(Mandatory)][string]$Signature,
        [Parameter(Mandatory)][string]$CanonicalRootDisplay
    )

    $docLines = @()
    $docLines += "# VIBE-KIT-SNAPSHOT"
    $docLines += ""
    $docLines += "> WARNING: This file is for vibe-kit owner/local AI use only. It must not be distributed to or embedded in consumer repositories."
    $docLines += "> Auto-generated from canonical docs. Do not hand-edit."
    $docLines += "> Generator: tools/vibe-kit-snapshot.ps1"
    $docLines += "> Canonical Root: $CanonicalRootDisplay"
    $docLines += "> Snapshot Kit Version: $($VersionInfo.Version)"
    $docLines += "> Snapshot Effective Date: $($VersionInfo.Effective)"
    $docLines += "> Generated UTC: $GeneratedUtc"
    $docLines += "> Generated Git Commit: $HeadCommit"
    $docLines += "> Signature: $Signature"
    $docLines += ""
    $docLines += "<!-- VIBE-KIT-SNAPSHOT-PAYLOAD-START -->"
    $docLines += $Payload
    $docLines += "<!-- VIBE-KIT-SNAPSHOT-PAYLOAD-END -->"
    return ($docLines -join "`n")
}

function Validate-Snapshot {
    param(
        [Parameter(Mandatory)][string]$SnapshotPath,
        [Parameter(Mandatory)][pscustomobject]$VersionInfo,
        [Parameter(Mandatory)][string]$HeadCommit,
        [Parameter(Mandatory)][string]$ProtocolContent
    )

    $warnings = @()
    if (-not (Test-Path $SnapshotPath)) {
        $warnings += "snapshot missing"
        return [pscustomobject]@{ Status = "WARN"; Warnings = $warnings }
    }

    $snapshotContent = Get-Content $SnapshotPath -Raw

    $snapshotVersion = ""
    if ($snapshotContent -match '> Snapshot Kit Version:\s*(v[\d.]+)') {
        $snapshotVersion = $Matches[1]
    }

    $snapshotCommit = ""
    if ($snapshotContent -match '> Generated Git Commit:\s*([0-9a-fA-F]+)') {
        $snapshotCommit = $Matches[1]
    }

    $signature = ""
    if ($snapshotContent -match '> Signature:\s*([a-f0-9]{64})') {
        $signature = $Matches[1]
    }

    $payloadMatch = [regex]::Match($snapshotContent, '(?ms)<!-- VIBE-KIT-SNAPSHOT-PAYLOAD-START -->\s*(.*?)\s*<!-- VIBE-KIT-SNAPSHOT-PAYLOAD-END -->')
    if (-not $payloadMatch.Success -or -not $signature) {
        $warnings += "snapshot appears hand-edited or stale (missing marker/signature)"
    } else {
        $payload = $payloadMatch.Groups[1].Value.Trim()
        $actual = Compute-Sha256 -Text $payload
        if ($actual -ne $signature) {
            $warnings += "snapshot appears hand-edited or stale (signature mismatch)"
        }
    }

    if (-not $snapshotVersion -or $snapshotVersion -ne $VersionInfo.Version) {
        $warnings += "snapshot version does not match VIBE-CODING.VERSION.md"
    }

    if (-not $snapshotCommit -or ($HeadCommit -and $snapshotCommit -ne $HeadCommit)) {
        $warnings += "snapshot appears hand-edited or stale (commit mismatch)"
    }

    $lineCount = (($snapshotContent -split "`r?`n").Count)
    if ($lineCount -gt 300) {
        $warnings += "snapshot exceeds lean size threshold (>300 lines)"
    }

    $payloadText = ""
    if ($payloadMatch.Success) {
        $payloadText = $payloadMatch.Groups[1].Value.Trim()
    }

    if ($payloadText) {
        $payloadLines = $payloadText -split "`r?`n"
        $h2Headings = @()
        foreach ($line in $payloadLines) {
            if ($line -match '^##\s+(.+)$') {
                $h2Headings += $Matches[1].Trim()
            }
        }

        if ($h2Headings.Count -gt 10) {
            $warnings += "large sections detected (too many payload headings)"
        }

        $duplicateHeadings = @($h2Headings | Group-Object | Where-Object { $_.Count -gt 1 })
        if ($duplicateHeadings.Count -gt 0) {
            $warnings += "large sections detected (repeated headings)"
        }

        $protocolLineSet = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
        foreach ($src in ($ProtocolContent -split "`r?`n")) {
            $norm = $src.Trim()
            if ($norm.Length -gt 0) {
                [void]$protocolLineSet.Add($norm)
            }
        }

        $consecutiveFromSource = 0
        $maxConsecutiveFromSource = 0
        foreach ($pl in $payloadLines) {
            $normPayload = $pl.Trim()
            if ($normPayload.Length -ge 24 -and $protocolLineSet.Contains($normPayload)) {
                $consecutiveFromSource++
                if ($consecutiveFromSource -gt $maxConsecutiveFromSource) {
                    $maxConsecutiveFromSource = $consecutiveFromSource
                }
            } else {
                $consecutiveFromSource = 0
            }
        }

        if ($maxConsecutiveFromSource -gt 10) {
            $warnings += "large sections detected (more than 10 consecutive lines copied from protocol source)"
        }
    }

    $warningsList = @($warnings)
    $status = if ($warningsList.Count -gt 0) { "WARN" } else { "PASS" }
    return [pscustomobject]@{ Status = $status; Warnings = $warningsList }
}

function Get-ConsumerSnapshotArtifactPaths {
    param(
        [Parameter(Mandatory)][string]$ResolvedRepoRoot,
        [Parameter(Mandatory)][string]$ResolvedDocsRoot,
        [Parameter(Mandatory)][string]$CanonicalRootPath
    )

    $candidates = @(
        (Join-Path $ResolvedRepoRoot (Join-Path $ResolvedDocsRoot "forGPT/VIBE-KIT-SNAPSHOT.md")),
        (Join-Path $ResolvedRepoRoot (Join-Path $ResolvedDocsRoot "VIBE-KIT-SNAPSHOT.md")),
        (Join-Path $ResolvedRepoRoot "VIBE-KIT-SNAPSHOT.md"),
        (Join-Path $CanonicalRootPath "docs/forGPT/VIBE-KIT-SNAPSHOT.md")
    )

    $found = @()
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            $found += $candidate
        }
    }
    return @($found | Select-Object -Unique)
}

$resolvedRepoRoot = Get-RepoRoot -Hint $RepoRoot
$resolvedDocsRoot = Get-DocsRoot -ResolvedRepoRoot $resolvedRepoRoot -Hint $DocsRoot
$canonicalRoot = Get-CanonicalRoot -ResolvedRepoRoot $resolvedRepoRoot -ResolvedDocsRoot $resolvedDocsRoot

if ($canonicalRoot.Context -eq "consumer") {
    $foundConsumerArtifacts = Get-ConsumerSnapshotArtifactPaths -ResolvedRepoRoot $resolvedRepoRoot -ResolvedDocsRoot $resolvedDocsRoot -CanonicalRootPath $canonicalRoot.Path
    $consumerWarnings = @()
    if ($foundConsumerArtifacts.Count -gt 0) {
        $consumerWarnings += "owner-only snapshot artifact detected in consumer repo"
    }

    if ($ValidateOnly) {
        $status = if ($consumerWarnings.Count -gt 0) { "WARN" } else { "PASS" }
        if (-not $Quiet) {
            Write-Host "Snapshot owner-only policy validation: $status" -ForegroundColor $(if ($status -eq 'PASS') { 'Green' } else { 'Yellow' })
            foreach ($warn in $consumerWarnings) {
                Write-Host "  WARN: $warn" -ForegroundColor Yellow
            }
            foreach ($path in $foundConsumerArtifacts) {
                Write-Host "  Found: $path" -ForegroundColor Yellow
            }
        }
        Write-Output ("SNAPSHOT_RESULT|Mode=validate|Status={0}|Path={1}|Warnings={2}" -f $status, "owner-only", $consumerWarnings.Count)
        exit 0
    }

    if (-not $Quiet) {
        Write-Host "WARN: VIBE-KIT-SNAPSHOT.md is owner-only and must not be generated in consumer repos." -ForegroundColor Yellow
        foreach ($path in $foundConsumerArtifacts) {
            Write-Host "  Found: $path" -ForegroundColor Yellow
        }
    }
    Write-Output ("SNAPSHOT_RESULT|Mode=generate|Status=WARN|Path=owner-only|Warnings=1")
    exit 0
}

$forGptDir = Join-Path $resolvedRepoRoot (Join-Path $resolvedDocsRoot "forGPT")
$snapshotPath = Join-Path $forGptDir "VIBE-KIT-SNAPSHOT.md"

$versionPath = Join-Path $canonicalRoot.Path "VIBE-CODING.VERSION.md"
$protocolPath = Join-Path $canonicalRoot.Path "protocol/protocol-v7.md"
$checklistPath = Join-Path $canonicalRoot.Path "session-start-checklist.md"
$waPath = Join-Path $canonicalRoot.Path "protocol/working-agreement-v1.md"
$xBranchPath = Join-Path $canonicalRoot.Path "protocol/x-branch-contract.md"
$researchStdPath = Join-Path $canonicalRoot.Path "standards/research-standard.md"

foreach ($required in @($versionPath, $protocolPath, $checklistPath, $waPath, $xBranchPath, $researchStdPath)) {
    if (-not (Test-Path $required)) {
        throw "Required canonical source missing: $required"
    }
}

$versionContent = Get-Content $versionPath -Raw
$versionInfo = Parse-VersionInfo -VersionContent $versionContent
$recentChanges = Get-RecentChanges -VersionContent $versionContent
$protocolContent = Get-Content $protocolPath -Raw

$headCommit = ((git -C $resolvedRepoRoot rev-parse --short HEAD 2>$null) | Out-String).Trim()
if (-not $headCommit) { $headCommit = "unknown" }

if ($ValidateOnly) {
    $validation = Validate-Snapshot -SnapshotPath $snapshotPath -VersionInfo $versionInfo -HeadCommit $headCommit -ProtocolContent $protocolContent
    if (-not $Quiet) {
        Write-Host "Snapshot validation: $($validation.Status)" -ForegroundColor $(if ($validation.Status -eq 'PASS') { 'Green' } else { 'Yellow' })
        foreach ($warn in $validation.Warnings) {
            Write-Host "  WARN: $warn" -ForegroundColor Yellow
        }
    }
    Write-Output ("SNAPSHOT_RESULT|Mode=validate|Status={0}|Path={1}|Warnings={2}" -f $validation.Status, $snapshotPath, @($validation.Warnings).Count)
    exit 0
}

$payload = Build-Payload -VersionInfo $versionInfo -RecentChanges $recentChanges
$signature = Compute-Sha256 -Text $payload
$generatedUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
$document = Build-Document -VersionInfo $versionInfo -GeneratedUtc $generatedUtc -HeadCommit $headCommit -Payload $payload -Signature $signature -CanonicalRootDisplay $canonicalRoot.Display

if ($WhatIf) {
    Write-Host "[WhatIf] Would write snapshot: $snapshotPath" -ForegroundColor Cyan
    Write-Output ("SNAPSHOT_RESULT|Mode=generate|Status=WHATIF|Path={0}|Warnings=0" -f $snapshotPath)
    exit 0
}

if (-not (Test-Path $forGptDir)) {
    New-Item -ItemType Directory -Path $forGptDir -Force | Out-Null
}

Set-Content -Path $snapshotPath -Value $document -Encoding UTF8
$validationAfterWrite = Validate-Snapshot -SnapshotPath $snapshotPath -VersionInfo $versionInfo -HeadCommit $headCommit -ProtocolContent $protocolContent

if (-not $Quiet) {
    Write-Host "Generated snapshot: $snapshotPath" -ForegroundColor Green
    if ($validationAfterWrite.Status -eq "WARN") {
        foreach ($warn in $validationAfterWrite.Warnings) {
            Write-Host "  WARN: $warn" -ForegroundColor Yellow
        }
    }
}

Write-Output ("SNAPSHOT_RESULT|Mode=generate|Status={0}|Path={1}|Warnings={2}" -f $validationAfterWrite.Status, $snapshotPath, @($validationAfterWrite.Warnings).Count)
exit 0
