<#
.SYNOPSIS
  Explicit consumer kit update/repair path with strict preflight gates.
.DESCRIPTION
  Run this from a consumer repo that embeds vibe-coding-kit via git subtree.
  This command verifies the upstream ref, hard-stops on unsafe repo state,
  performs a controlled subtree pull only after verification, and then
  re-checks local parity. Packet sync is intentionally out of scope.
.PARAMETER RemoteName
  Optional remote name override. When omitted, the script auto-discovers a
  likely vibe-coding-kit remote from local git config.
.PARAMETER Ref
    Remote ref to verify and pull. Defaults to release/consumer-payload.
.PARAMETER RepoRoot
    Optional target consumer repository root to operate against. When provided,
    all git/tree checks, preview, and (non-WhatIf) update actions run against
    that repo instead of the current working directory.
.PARAMETER WhatIf
  Print the verified mutation plan without running the subtree pull.
#>
[CmdletBinding()]
param(
    [string]$RemoteName,
    [string]$Ref = "release/consumer-payload",
    [string]$RepoRoot,
    [switch]$Commit,
    [switch]$WhatIf
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
# In PowerShell 7+, native-command stderr can be promoted to terminating errors.
# Keep warning text non-fatal so git exit codes remain the hard-stop authority.
if ($PSVersionTable.PSVersion.Major -ge 7) {
    $PSNativeCommandUseErrorActionPreference = $false
}
$sourceKitRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sourceSha = ((git -C $sourceKitRoot rev-parse HEAD 2>$null) | Select-Object -First 1).Trim()
$script:EmitPreviewSafetyOnFailure = $WhatIf.IsPresent

function Invoke-GitSafe {
    [CmdletBinding()]
    param([Parameter(ValueFromRemainingArguments)][string[]]$GitArgs)

    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & git @GitArgs 2>&1
        if ($LASTEXITCODE -ne 0) {
            $ErrorActionPreference = $prevEAP
            $errText = ($output | Where-Object {
                $_ -is [System.Management.Automation.ErrorRecord] -and
                (("$_").Trim() -notmatch '^warning:')
            } | Out-String).Trim()
            if (-not $errText) {
                $errText = ($output | Where-Object {
                    (("$_").Trim() -notmatch '^warning:')
                } | Out-String).Trim()
            }
            throw "git $($GitArgs -join ' ') failed (exit $LASTEXITCODE): $errText"
        }

        # Drop warning-only stderr records so callers don't treat warnings as path data.
        $cleanOutput = @(
            $output | Where-Object {
                (("$_").Trim() -notmatch '^warning:')
            }
        )
        return $cleanOutput
    } finally {
        $ErrorActionPreference = $prevEAP
    }
}

function Normalize-RepoPath {
    param([string]$Path)

    if (-not $Path) { return "" }
    return (($Path -replace '\\', '/') -replace '^\./', '').TrimStart('/')
}

function Get-StatusPath {
    param([string]$StatusLine)

    $path = $StatusLine.Substring(3).Trim()
    if ($path -match ' -> (.+)$') {
        $path = $Matches[1]
    }
    return Normalize-RepoPath $path
}

function Read-KitVersionData {
    param([string]$VersionFile)

    $result = [ordered]@{
        Version   = "(unknown)"
        Effective = "(unknown)"
        Raw       = ""
    }

    if (Test-Path $VersionFile) {
        $content = Get-Content $VersionFile -Raw
        $result.Raw = $content
        if ($content -match '\*\*Version:\*\*\s*(v[\d.]+)') {
            $result.Version = $Matches[1]
        }
        if ($content -match '\*\*Effective Date:\*\*\s*(\d{4}-\d{2}-\d{2})') {
            $result.Effective = $Matches[1]
        }
    }

    return [pscustomobject]$result
}

function Write-RequiredActions {
    param([string[]]$Actions)

    if (-not $Actions -or $Actions.Count -eq 0) { return }

    Write-Host ""
    Write-Host "Required Actions:" -ForegroundColor Yellow
    $Actions | Select-Object -Unique | ForEach-Object {
        Write-Host "  - $_" -ForegroundColor Yellow
    }
}

function Fail-KitUpdate {
    param(
        [string]$Summary,
        [string[]]$Actions,
        [string[]]$Details
    )

    Write-Host "HARD STOP: $Summary" -ForegroundColor Red
    if ($Details) {
        foreach ($detail in $Details) {
            Write-Host "  $detail" -ForegroundColor Yellow
        }
    }

    if ($script:EmitPreviewSafetyOnFailure) {
        Write-Host "" 
        Write-Host "Preview safety:" -ForegroundColor Yellow
        Write-Host "BLOCKED - $Summary" -ForegroundColor Red
    }

    Write-RequiredActions $Actions
    throw "__KIT_UPDATE_STOP__"
}

function Convert-PreviewPath {
    param(
        [Parameter(Mandatory)][string]$SubtreePrefix,
        [Parameter(Mandatory)][string]$RelativePath
    )

    $relative = Normalize-RepoPath $RelativePath
    $hasTraversal = ($relative -match '(^|/)\.\.(/|$)')
    $repoPath = Normalize-RepoPath "$SubtreePrefix/$relative"
    $inBoundary = (-not $hasTraversal) -and $repoPath.StartsWith("$SubtreePrefix/", [System.StringComparison]::OrdinalIgnoreCase)

    return [pscustomobject]@{
        RelativePath = $relative
        RepoPath     = $repoPath
        InBoundary   = $inBoundary
        HasTraversal = $hasTraversal
    }
}

function Get-KitUpdatePreviewPlan {
    param([Parameter(Mandatory)][string]$SubtreePrefix)

    $localTree = (Invoke-GitSafe rev-parse "HEAD:$SubtreePrefix" | Out-String).Trim()
    $remoteTree = (Invoke-GitSafe rev-parse "FETCH_HEAD^{tree}" | Out-String).Trim()
    $diffLines = @(Invoke-GitSafe diff --name-status -M $localTree $remoteTree)

    $updates = [System.Collections.Generic.List[string]]::new()
    $adds = [System.Collections.Generic.List[string]]::new()
    $deletes = [System.Collections.Generic.List[string]]::new()
    $renames = [System.Collections.Generic.List[string]]::new()
    $renamePairs = [System.Collections.Generic.List[object]]::new()
    $outsideBoundary = [System.Collections.Generic.List[string]]::new()

    foreach ($line in $diffLines) {
        $text = ("$line").Trim()
        if (-not $text) { continue }

        $parts = $text -split "`t"
        if ($parts.Count -lt 2) { continue }

        $status = $parts[0]
        $kind = $status.Substring(0, 1)

        if ($kind -eq 'R' -and $parts.Count -ge 3) {
            $oldPath = Convert-PreviewPath -SubtreePrefix $SubtreePrefix -RelativePath $parts[1]
            $newPath = Convert-PreviewPath -SubtreePrefix $SubtreePrefix -RelativePath $parts[2]
            $renames.Add("R $($oldPath.RepoPath) -> $($newPath.RepoPath)")
            $renamePairs.Add([pscustomobject]@{
                Status        = $status
                OldRelative   = $oldPath.RelativePath
                NewRelative   = $newPath.RelativePath
                OldRepoPath   = $oldPath.RepoPath
                NewRepoPath   = $newPath.RepoPath
            })

            if (-not $oldPath.InBoundary) { $outsideBoundary.Add($oldPath.RepoPath) }
            if (-not $newPath.InBoundary) { $outsideBoundary.Add($newPath.RepoPath) }
            continue
        }

        $mapped = Convert-PreviewPath -SubtreePrefix $SubtreePrefix -RelativePath $parts[1]
        if (-not $mapped.InBoundary) {
            $outsideBoundary.Add($mapped.RepoPath)
        }

        switch ($kind) {
            'A' { $adds.Add("A $($mapped.RepoPath)") }
            'D' { $deletes.Add("D $($mapped.RepoPath)") }
            default { $updates.Add("$kind $($mapped.RepoPath)") }
        }
    }

    $updatesSorted = @($updates | Sort-Object -Unique)
    $addsSorted = @($adds | Sort-Object -Unique)
    $deletesSorted = @($deletes | Sort-Object -Unique)
    $renamesSorted = @($renames | Sort-Object -Unique)
    $outsideBoundarySorted = @($outsideBoundary | Sort-Object -Unique)

    return [pscustomobject]@{
        Updates         = $updatesSorted
        Adds            = $addsSorted
        Deletes         = $deletesSorted
        Renames         = $renamesSorted
        RenamePairs     = @($renamePairs)
        OutsideBoundary = $outsideBoundarySorted
    }
}

function Get-PlanEntryPath {
    param([Parameter(Mandatory)][string]$Entry)

    if ($Entry.Length -lt 3) {
        return ""
    }

    return $Entry.Substring(2).Trim()
}

function Get-PlanPayloadPath {
    param(
        [Parameter(Mandatory)][string]$SubtreePrefix,
        [Parameter(Mandatory)][string]$RepoPath
    )

    $normalized = Normalize-RepoPath $RepoPath
    $prefix = Normalize-RepoPath $SubtreePrefix
    if ($normalized.StartsWith($prefix + '/', [System.StringComparison]::OrdinalIgnoreCase)) {
        return $normalized.Substring($prefix.Length + 1)
    }

    return $normalized
}

function Invoke-GitPlanSafe {
    param([Parameter(Mandatory)][string[]]$Arguments)

    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & git @Arguments 2>&1
        if ($LASTEXITCODE -ne 0) {
            $ErrorActionPreference = $prevEAP
            $errText = ($output | Where-Object {
                $_ -is [System.Management.Automation.ErrorRecord] -and
                (("$_").Trim() -notmatch '^warning:')
            } | Out-String).Trim()
            if (-not $errText) {
                $errText = ($output | Where-Object { (("$_").Trim() -notmatch '^warning:') } | Out-String).Trim()
            }
            throw "git $($Arguments -join ' ') failed (exit $LASTEXITCODE): $errText"
        }

        return @(
            $output | Where-Object { (("$_").Trim() -notmatch '^warning:') }
        )
    } finally {
        $ErrorActionPreference = $prevEAP
    }
}

function Invoke-KitUpdateApplyCleanup {
    param(
        [Parameter(Mandatory)][string]$TargetRepoRoot,
        [Parameter(Mandatory)][string]$SubtreePrefix,
        [Parameter(Mandatory)][string]$PreApplyHead,
        [Parameter(Mandatory)][string]$PayloadRoot,
        [Parameter(Mandatory)][string]$PayloadZip,
        [Parameter(Mandatory)][string]$PayloadArchiveError
    )

    Push-Location $TargetRepoRoot
    try {
        try {
            $null = Invoke-GitSafe -GitArgs @('reset', '--hard', $PreApplyHead)
        } catch {
            Write-Host "WARN: Failed to reset target repo during apply cleanup: $_" -ForegroundColor Yellow
        }

        try {
            $null = Invoke-GitSafe -GitArgs @('clean', '-fd', '--', $SubtreePrefix)
        } catch {
            Write-Host "WARN: Failed to clean target subtree during apply cleanup: $_" -ForegroundColor Yellow
        }
    } finally {
        Pop-Location
    }

    foreach ($path in @($PayloadZip, $PayloadArchiveError)) {
        if ($path -and (Test-Path -LiteralPath $path)) {
            Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
        }
    }

    if ($PayloadRoot -and (Test-Path -LiteralPath $PayloadRoot)) {
        Remove-Item -LiteralPath $PayloadRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Get-PreviewPlanPaths {
    param([Parameter(Mandatory)]$Plan)

    $paths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

    foreach ($entry in @($Plan.Updates)) {
        $path = Get-PlanEntryPath $entry
        if ($path) { $null = $paths.Add($path) }
    }

    foreach ($entry in @($Plan.Adds)) {
        $path = Get-PlanEntryPath $entry
        if ($path) { $null = $paths.Add($path) }
    }

    foreach ($entry in @($Plan.Deletes)) {
        $path = Get-PlanEntryPath $entry
        if ($path) { $null = $paths.Add($path) }
    }

    foreach ($rename in @($Plan.RenamePairs)) {
        if ($rename.OldRepoPath) { $null = $paths.Add([string]$rename.OldRepoPath) }
        if ($rename.NewRepoPath) { $null = $paths.Add([string]$rename.NewRepoPath) }
    }

    return @($paths | Sort-Object)
}

function Invoke-KitUpdatePlanApply {
    param(
        [Parameter(Mandatory)]$Plan,
        [Parameter(Mandatory)][string]$TargetRepoRoot,
        [Parameter(Mandatory)][string]$SubtreePrefix,
        [Parameter(Mandatory)][string]$PayloadRef,
        [Parameter(Mandatory)][string]$SourceSHA,
        [Parameter(Mandatory)][string]$PayloadSHA,
        [Parameter(Mandatory)][string]$TargetVersion,
        [switch]$Commit
    )

    $expectedChangedPaths = Get-PreviewPlanPaths -Plan $Plan
    $payloadPaths = [System.Collections.Generic.List[string]]::new()
    $payloadRoot = Join-Path $env:TEMP ('vibe-kit-apply-payload-' + [guid]::NewGuid().ToString('N'))
    $payloadZip = Join-Path $env:TEMP ('vibe-kit-apply-payload-' + [guid]::NewGuid().ToString('N') + '.zip')
    New-Item -ItemType Directory -Path $payloadRoot -Force | Out-Null
    $payloadArchiveError = Join-Path $env:TEMP ('vibe-kit-apply-payload-' + [guid]::NewGuid().ToString('N') + '.err')
    $preApplyHead = ((Invoke-GitPlanSafe -Arguments @('rev-parse', 'HEAD')) | Out-String).Trim()
    $mutationStarted = $false

    try {
        $mutationStarted = $true

        $archiveProcess = Start-Process -FilePath git -ArgumentList @('archive', '--format=zip', $PayloadRef) -NoNewWindow -Wait -PassThru -RedirectStandardOutput $payloadZip -RedirectStandardError $payloadArchiveError
        if ($archiveProcess.ExitCode -ne 0) {
            $archiveErrorText = ""
            if (Test-Path -LiteralPath $payloadArchiveError) {
                $archiveErrorText = (Get-Content -LiteralPath $payloadArchiveError -Raw).Trim()
            }
            throw "Archive generation failed: $archiveErrorText"
        }

        try {
            Expand-Archive -LiteralPath $payloadZip -DestinationPath $payloadRoot -Force
        } catch {
            throw "Archive extraction failed: $_"
        }

        foreach ($rename in @($Plan.RenamePairs)) {
            if (-not $rename.OldRepoPath -or -not $rename.NewRepoPath) {
                Fail-KitUpdate "Rename plan was malformed." @(
                    "You need to inspect the preview plan and retry kit update."
                ) @("Malformed rename pair: $rename")
            }

            $null = $payloadPaths.Add([string]$rename.NewRepoPath)
            $null = Invoke-GitPlanSafe -Arguments @('rm', '--ignore-unmatch', '-f', '--', [string]$rename.OldRepoPath)
            $renameSourcePath = Get-PlanPayloadPath -SubtreePrefix $SubtreePrefix -RepoPath ([string]$rename.NewRepoPath)
            $renameSourceFull = Join-Path $payloadRoot $renameSourcePath
            $renameTargetFull = Join-Path $TargetRepoRoot ([string]$rename.NewRepoPath)
            if (-not (Test-Path -LiteralPath $renameSourceFull)) {
                Fail-KitUpdate "Materialized payload is missing renamed source file: $renameSourcePath" @(
                    "You need to inspect the fetched payload archive before retrying kit update."
                ) @()
            }
            $renameTargetDir = Split-Path -Parent $renameTargetFull
            if ($renameTargetDir) {
                New-Item -ItemType Directory -Path $renameTargetDir -Force | Out-Null
            }
            Copy-Item -LiteralPath $renameSourceFull -Destination $renameTargetFull -Force
        }

        foreach ($entry in @($Plan.Updates)) {
            $path = Get-PlanEntryPath $entry
            if ($path) {
                $null = $payloadPaths.Add($path)
                $sourcePath = Get-PlanPayloadPath -SubtreePrefix $SubtreePrefix -RepoPath $path
                $sourceFull = Join-Path $payloadRoot $sourcePath
                $targetFull = Join-Path $TargetRepoRoot $path
                if (-not (Test-Path -LiteralPath $sourceFull)) {
                    Fail-KitUpdate "Materialized payload is missing updated source file: $sourcePath" @(
                        "You need to inspect the fetched payload archive before retrying kit update."
                    ) @()
                }
                $targetDir = Split-Path -Parent $targetFull
                if ($targetDir) {
                    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
                }
                Copy-Item -LiteralPath $sourceFull -Destination $targetFull -Force
            }
        }

        foreach ($entry in @($Plan.Adds)) {
            $path = Get-PlanEntryPath $entry
            if ($path) {
                $null = $payloadPaths.Add($path)
                $sourcePath = Get-PlanPayloadPath -SubtreePrefix $SubtreePrefix -RepoPath $path
                $sourceFull = Join-Path $payloadRoot $sourcePath
                $targetFull = Join-Path $TargetRepoRoot $path
                if (-not (Test-Path -LiteralPath $sourceFull)) {
                    Fail-KitUpdate "Materialized payload is missing added source file: $sourcePath" @(
                        "You need to inspect the fetched payload archive before retrying kit update."
                    ) @()
                }
                $targetDir = Split-Path -Parent $targetFull
                if ($targetDir) {
                    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
                }
                Copy-Item -LiteralPath $sourceFull -Destination $targetFull -Force
            }
        }

        $null = Invoke-GitPlanSafe -Arguments @('add', '-A', '--', $SubtreePrefix)

        $stagedChanged = @((Invoke-GitPlanSafe -Arguments @('diff', '--cached', '--no-renames', '--name-only')) | ForEach-Object { Normalize-RepoPath $_ } | Where-Object { $_ })
        $stagedChangedSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
        foreach ($path in $stagedChanged) {
            $null = $stagedChangedSet.Add($path)
        }

        $expectedSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
        foreach ($path in $expectedChangedPaths) {
            $null = $expectedSet.Add($path)
        }

        if ($expectedSet.Count -ne $stagedChangedSet.Count) {
            Fail-KitUpdate "Deterministic apply changed file set did not match the preview plan." @(
                "You need to inspect the preview plan before retrying kit update."
            ) @(
                "Expected: $($expectedChangedPaths -join ', ')",
                "Actual: $($stagedChanged -join ', ')"
            )
        }

        foreach ($path in $expectedChangedPaths) {
            if (-not $stagedChangedSet.Contains($path)) {
                Fail-KitUpdate "Deterministic apply is missing a planned path: $path" @(
                    "You need to inspect the preview plan before retrying kit update."
                ) @()
            }
        }

        foreach ($path in $payloadPaths) {
            $fullPath = Join-Path $TargetRepoRoot $path
            if (-not (Test-Path -LiteralPath $fullPath)) {
                Fail-KitUpdate "Applied payload file is missing after materialization: $path" @(
                    "You need to inspect the deterministic apply result before retrying kit update."
                ) @()
            }

            $payloadPath = Get-PlanPayloadPath -SubtreePrefix $SubtreePrefix -RepoPath $path
            $expectedBlob = ((Invoke-GitSafe rev-parse "${PayloadRef}:$payloadPath" | Out-String).Trim())
            if (-not $expectedBlob) {
                Fail-KitUpdate "Could not resolve payload blob for applied path: $payloadPath" @(
                    "You need to inspect the payload resolution before retrying kit update."
                ) @()
            }

            $actualBlob = ((git hash-object -- $fullPath) | Out-String).Trim()
            if ($actualBlob -ne $expectedBlob) {
                Fail-KitUpdate "Applied file content does not match the fetched payload blob: $path" @(
                    "You need to inspect the deterministic apply result before retrying kit update."
                ) @("Expected $expectedBlob but found $actualBlob.")
            }
        }

        $postApplyChanged = @((Invoke-GitPlanSafe -Arguments @('diff', '--cached', '--no-renames', '--name-only')) | ForEach-Object { Normalize-RepoPath $_ } | Where-Object { $_ })
        $postApplyChangedSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
        foreach ($path in $postApplyChanged) {
            $null = $postApplyChangedSet.Add($path)
        }

        foreach ($path in $expectedChangedPaths) {
            if (-not $postApplyChangedSet.Contains($path)) {
                Fail-KitUpdate "Post-apply verification is missing a planned path: $path" @(
                    "You need to inspect the committed deterministic apply result before retrying kit update."
                ) @()
            }
        }

        if ($postApplyChangedSet.Count -ne $expectedSet.Count) {
            Fail-KitUpdate "Post-apply verification changed file set does not match the preview plan." @(
                "You need to inspect the committed deterministic apply result before retrying kit update."
            ) @(
                "Expected: $($expectedChangedPaths -join ', ')",
                "Actual: $($postApplyChanged -join ', ')"
            )
        }

        $postVersionData = Read-KitVersionData (Join-Path $TargetRepoRoot (Join-Path $SubtreePrefix 'VIBE-CODING.VERSION.md'))
        if ($postVersionData.Version -ne $TargetVersion) {
            Fail-KitUpdate "Post-apply kit version does not match the verified target version." @(
                "You need to inspect the deterministic apply result before retrying kit update."
            ) @("Expected $TargetVersion but found $($postVersionData.Version).")
        }

        $payloadCommitMessage = "build(kit): apply verified consumer payload from SourceKitSHA=$SourceSHA PayloadSHA=$PayloadSHA"
        $resultMode = "APPLIED_PENDING_COMMIT"
        $commitSha = $null

        if ($Commit) {
            $commitSha = ((Invoke-GitPlanSafe -Arguments @('commit', '-m', $payloadCommitMessage) | Out-String).Trim())
            if (-not $commitSha) {
                Fail-KitUpdate "Could not create explicit commit for plan-driven apply." @(
                    "You need to inspect the staged deterministic apply result before retrying kit update."
                ) @()
            }
            $resultMode = "COMMITTED"
        } else {
            Write-Host "RecommendedCommitMessage = $payloadCommitMessage" -ForegroundColor Yellow
            Write-Host "NextCommand = git commit -m `"$payloadCommitMessage`"" -ForegroundColor Yellow
        }

        return [pscustomobject]@{
            CommitSha         = $commitSha
            ChangedPaths      = $postApplyChanged
            PayloadVersion    = $postVersionData.Version
            ExpectedChanged   = $expectedChangedPaths
            SourceKitSHA      = $SourceSHA
            PayloadSHA        = $PayloadSHA
            ResultMode        = $resultMode
            CommitMessage     = $payloadCommitMessage
            NextCommand       = if ($Commit) { "" } else { "git commit -m `"$payloadCommitMessage`"" }
        }
    } catch {
        if ($mutationStarted) {
            Invoke-KitUpdateApplyCleanup -TargetRepoRoot $TargetRepoRoot -SubtreePrefix $SubtreePrefix -PreApplyHead $preApplyHead -PayloadRoot $payloadRoot -PayloadZip $payloadZip -PayloadArchiveError $payloadArchiveError
        }
        throw
    } finally {
        if (Test-Path -LiteralPath $payloadZip) {
            Remove-Item -LiteralPath $payloadZip -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path -LiteralPath $payloadArchiveError) {
            Remove-Item -LiteralPath $payloadArchiveError -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path -LiteralPath $payloadRoot) {
            Remove-Item -LiteralPath $payloadRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Write-KitUpdatePreviewPlan {
    param(
        [Parameter(Mandatory)]$Plan,
        [Parameter(Mandatory)][string]$SubtreePrefix
    )

    $total = $Plan.Updates.Count + $Plan.Adds.Count + $Plan.Deletes.Count + $Plan.Renames.Count
    $isBlocked = $Plan.OutsideBoundary.Count -gt 0

    Write-Host ""
    if ($total -eq 0) {
        Write-Host "Kit update preview: no files changed by this preview" -ForegroundColor Green
    } else {
        Write-Host "Kit update preview: deterministic file-level update plan" -ForegroundColor Cyan
    }

    Write-Host ""
    Write-Host "Would update:" -ForegroundColor White
    if ($Plan.Updates.Count -eq 0) {
        Write-Host "none" -ForegroundColor Gray
    } else {
        foreach ($entry in $Plan.Updates) {
            Write-Host $entry -ForegroundColor White
        }
    }

    Write-Host ""
    Write-Host "Would add:" -ForegroundColor White
    if ($Plan.Adds.Count -eq 0) {
        Write-Host "none" -ForegroundColor Gray
    } else {
        foreach ($entry in $Plan.Adds) {
            Write-Host $entry -ForegroundColor White
        }
    }

    Write-Host ""
    Write-Host "Would delete:" -ForegroundColor White
    if ($Plan.Deletes.Count -eq 0) {
        Write-Host "none" -ForegroundColor Gray
    } else {
        foreach ($entry in $Plan.Deletes) {
            Write-Host $entry -ForegroundColor White
        }
    }

    Write-Host ""
    Write-Host "Would rename:" -ForegroundColor White
    if ($Plan.Renames.Count -eq 0) {
        Write-Host "none" -ForegroundColor Gray
    } else {
        foreach ($entry in $Plan.Renames) {
            Write-Host $entry -ForegroundColor White
        }
    }

    Write-Host ""
    Write-Host "Boundary check:" -ForegroundColor White
    if ($isBlocked) {
        Write-Host "BLOCKED - planned change outside $SubtreePrefix/" -ForegroundColor Red
        foreach ($entry in $Plan.OutsideBoundary) {
            Write-Host $entry -ForegroundColor Red
        }
    } else {
        Write-Host "PASS - all planned changes are under $SubtreePrefix/" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "Runtime/app files:" -ForegroundColor White
    if ($isBlocked) {
        foreach ($entry in $Plan.OutsideBoundary) {
            Write-Host $entry -ForegroundColor Red
        }
    } else {
        Write-Host "none" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "Preview safety:" -ForegroundColor White
    if ($isBlocked) {
        Write-Host "BLOCKED" -ForegroundColor Red
    } else {
        Write-Host "PASS" -ForegroundColor Green
    }
}

function Get-DirtyPacketClassification {
    param(
        [string[]]$RelativePaths,
        [System.Collections.Generic.HashSet[string]]$GeneratedPaths,
        [string]$ManifestRelative,
        [string]$RepoRoot
    )

    $classification = [ordered]@{
        MirrorDrift    = @()
        PreserveWorthy = @()
    }

    foreach ($path in $RelativePaths) {
        if ($path -eq $ManifestRelative -or -not $GeneratedPaths.Contains($path)) {
            $classification.PreserveWorthy += $path
            continue
        }

        $fullPath = Join-Path $RepoRoot $path
        if (Test-Path $fullPath) {
            try {
                $marker = Select-String -Path $fullPath -Pattern '<<<<<<<|=======|>>>>>>>' -SimpleMatch:$false -ErrorAction Stop
                if ($marker) {
                    $classification.PreserveWorthy += $path
                    continue
                }
            } catch {
                $classification.PreserveWorthy += $path
                continue
            }
        }

        $classification.MirrorDrift += $path
    }

    return [pscustomobject]$classification
}

function Invoke-SnapshotIsolationEnforcement {
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][string]$DocsRoot,
        [Parameter(Mandatory)][string]$SubtreePrefix,
        [switch]$WhatIf
    )

    $candidates = @(
        (Join-Path $RepoRoot (Join-Path $DocsRoot "forGPT/VIBE-KIT-SNAPSHOT.md")),
        (Join-Path $RepoRoot (Join-Path $DocsRoot "VIBE-KIT-SNAPSHOT.md")),
        (Join-Path $RepoRoot "VIBE-KIT-SNAPSHOT.md"),
        (Join-Path $RepoRoot (Join-Path $SubtreePrefix "docs/forGPT/VIBE-KIT-SNAPSHOT.md"))
    )

    $existing = @()
    foreach ($path in $candidates) {
        if (Test-Path $path) {
            $existing += $path
        }
    }

    $existing = @($existing | Select-Object -Unique)
    if ($existing.Count -eq 0) {
        return "ABSENT"
    }

    if ($WhatIf) {
        foreach ($path in $existing) {
            Write-Host "[WhatIf] Would remove owner-only snapshot artifact: $path" -ForegroundColor Cyan
        }
        return "WHATIF(found=$($existing.Count))"
    }

    $removed = 0
    foreach ($path in $existing) {
        try {
            Remove-Item -Path $path -Force
            $removed++
            Write-Host "WARN: Removed owner-only snapshot artifact: $path" -ForegroundColor Yellow
        } catch {
            Write-Host "WARN: Failed to remove owner-only snapshot artifact: $path" -ForegroundColor Yellow
        }
    }

    if ($removed -gt 0) {
        return "REMOVED($removed)"
    }
    return "WARN(remove failed)"
}

$targetRepoRoot = $null
if ($RepoRoot) {
    $resolvedTargetPath = $null
    try {
        $resolvedTargetPath = (Resolve-Path -LiteralPath $RepoRoot -ErrorAction Stop).Path
    } catch {
        Fail-KitUpdate "Provided RepoRoot could not be resolved: $RepoRoot" @(
            "You need to provide a valid consumer repo path to run source-side preview/update."
        ) @()
    }

    if (-not (Test-Path -LiteralPath $resolvedTargetPath -PathType Container)) {
        Fail-KitUpdate "Provided RepoRoot is not a directory: $resolvedTargetPath" @(
            "You need to provide a valid consumer repo directory path."
        ) @()
    }

    Push-Location $resolvedTargetPath
    try {
        $targetRepoRoot = ((git rev-parse --show-toplevel 2>$null) | Select-Object -First 1).Trim()
    } finally {
        Pop-Location
    }

    if (-not $targetRepoRoot) {
        Fail-KitUpdate "Provided RepoRoot is not inside a git repository: $resolvedTargetPath" @(
            "You need to target a consumer repo root that is already a git repository."
        ) @()
    }
} else {
    try {
        $targetRepoRoot = (git rev-parse --show-toplevel 2>&1) -replace '/', '\\'
    } catch {
        Fail-KitUpdate "Not inside a git repository." @(
            "You need to run kit update from a consumer repo, or pass -RepoRoot <consumer-repo>."
        ) @()
    }
}

if (-not (Test-Path -LiteralPath $targetRepoRoot -PathType Container)) {
    Fail-KitUpdate "Resolved target repo root is invalid: $targetRepoRoot" @(
        "You need to provide a valid consumer repo path to run source-side preview/update."
    ) @()
}

$gitHelpersScript = Join-Path $PSScriptRoot 'git-helpers.ps1'
if (-not (Test-Path $gitHelpersScript)) {
    Write-Error "HARD STOP: Missing git-helpers script at $gitHelpersScript"
    exit 1
}
. $gitHelpersScript

Push-Location $targetRepoRoot

try {
    $branch = (git branch --show-current 2>$null) -join ""
    $gitDirRaw = (git rev-parse --git-dir 2>$null) -join ""
    $gitDir = if ([System.IO.Path]::IsPathRooted($gitDirRaw)) { $gitDirRaw } else { Join-Path $targetRepoRoot $gitDirRaw }

    $docsRootResult = Get-DocsRoot -RepoRoot $targetRepoRoot -ScriptRoot $PSScriptRoot
    if (-not $docsRootResult) {
        Fail-KitUpdate "Neither docs-engineering/ nor docs/ found at repo root: $targetRepoRoot" @(
            "You need to run kit update from a consumer repo that embeds vibe-coding-kit via docs-engineering/ or docs/."
        ) @()
    }
    $docsRoot      = $docsRootResult.DocsRoot
    $docsReason    = $docsRootResult.DocsReason
    $subtreePrefix = $docsRootResult.SubtreePrefix

    if (-not (Test-Path (Join-Path $targetRepoRoot $subtreePrefix))) {
        Fail-KitUpdate "Subtree prefix $subtreePrefix does not exist." @(
            "You need to run kit update from a consumer repo that already contains the vibe-coding subtree."
        ) @("Has the kit been added as a subtree?")
    }

    $inProgressSignals = @()
    foreach ($name in @("MERGE_HEAD", "REBASE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD")) {
        if (Test-Path (Join-Path $gitDir $name)) {
            $inProgressSignals += $name
        }
    }
    foreach ($name in @("rebase-apply", "rebase-merge")) {
        if (Test-Path (Join-Path $gitDir $name)) {
            $inProgressSignals += $name
        }
    }
    if ($inProgressSignals.Count -gt 0) {
        Fail-KitUpdate "In-progress git operation detected." @(
            "You need to finish or abort the current git operation before running kit update."
        ) $inProgressSignals
    }

    $unmergedPaths = @((Invoke-GitSafe diff --name-only --diff-filter=U) | ForEach-Object { Normalize-RepoPath $_ } | Where-Object { $_ })
    if ($unmergedPaths.Count -gt 0) {
        Fail-KitUpdate "Unmerged files detected." @(
            "You need to resolve all unmerged files and finish or abort the current git operation before kit update."
        ) $unmergedPaths
    }

    $ts = Get-FullTreeStatus
    if ($ts.UntrackedLines.Count -gt 0) {
        Fail-KitUpdate "Untracked files detected. Full clean tree required before kit update." @(
            "Commit, stash, .gitignore, or move each untracked file before running kit update."
            "Run: git status --porcelain -u  to see all untracked files."
        ) $ts.UntrackedLines
    }
    $trackedStatus = $ts.TrackedLines
    $forGptPrefix = if ($docsRoot -eq ".") { "forGPT/" } else { "$docsRoot/forGPT/" }
    $manifestRelative = if ($docsRoot -eq ".") { "forGPT/forgpt.manifest.json" } else { "$docsRoot/forGPT/forgpt.manifest.json" }
    $versionManifestRelative = if ($docsRoot -eq ".") { "forGPT/VERSION-MANIFEST.md" } else { "$docsRoot/forGPT/VERSION-MANIFEST.md" }

    $generatedPacketPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $null = $generatedPacketPaths.Add($versionManifestRelative)
    $manifestPath = Join-Path $targetRepoRoot $manifestRelative
    if (Test-Path $manifestPath) {
        try {
            $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
            foreach ($entry in $manifest.files) {
                $dest = Normalize-RepoPath $entry.dest
                if ($dest) {
                    $fullRelative = if ($docsRoot -eq ".") { "forGPT/$dest" } else { "$docsRoot/forGPT/$dest" }
                    $null = $generatedPacketPaths.Add($fullRelative)
                }
            }
        } catch {
            # Classification falls back to preserve-worthy if the manifest cannot be trusted.
        }
    }

    $subtreeDirty = @()
    $stagedSubtreeDirty = @()
    $outOfScopeDirty = @()
    $forGptDirty = @()
    foreach ($line in $trackedStatus) {
        $path = Get-StatusPath $line
        $statusCode = $line.Substring(0, 2)
        if ($path.StartsWith("$subtreePrefix/", [System.StringComparison]::OrdinalIgnoreCase)) {
            $subtreeDirty += $line
            if ($statusCode[0] -ne ' ') {
                $stagedSubtreeDirty += $line
            }
        } elseif ($path.StartsWith($forGptPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            $forGptDirty += $path
        } else {
            $outOfScopeDirty += $line
        }
    }

    if ($outOfScopeDirty.Count -gt 0) {
        Fail-KitUpdate "Out-of-scope tracked changes detected." @(
            "You need to clean non-kit tracked changes before running kit update."
        ) $outOfScopeDirty
    }

    if ($stagedSubtreeDirty.Count -gt 0) {
        Fail-KitUpdate "Unfinished prior subtree update state detected." @(
            "You need to clean up the unfinished prior subtree update state before retrying kit update."
        ) $stagedSubtreeDirty
    }

    if ($subtreeDirty.Count -gt 0) {
        Fail-KitUpdate "Tracked changes inside the kit subtree detected." @(
            "You need to remove or explicitly preserve local edits inside the kit subtree before kit update."
        ) $subtreeDirty
    }

    if ($forGptDirty.Count -gt 0) {
        $packetClassification = Get-DirtyPacketClassification -RelativePaths $forGptDirty -GeneratedPaths $generatedPacketPaths -ManifestRelative $manifestRelative -RepoRoot $targetRepoRoot
        if ($packetClassification.PreserveWorthy.Count -gt 0) {
            Fail-KitUpdate "Preserve-worthy forGPT edits or conflict residue detected." @(
                "You need to preserve forGPT edits or resolve conflict residue before kit update."
            ) $packetClassification.PreserveWorthy
        }
        if ($packetClassification.MirrorDrift.Count -gt 0) {
            Fail-KitUpdate "forGPT mirror-drift candidate detected." @(
                "You need to review these forGPT changes before running kit update. Step 2 does not clean packet drift automatically."
            ) $packetClassification.MirrorDrift
        }
    }

    $localVersionFile = Join-Path $targetRepoRoot (Join-Path $subtreePrefix "VIBE-CODING.VERSION.md")
    $localVersionData = Read-KitVersionData $localVersionFile
    if ($localVersionData.Version -eq "(unknown)") {
        Fail-KitUpdate "Could not read local kit version from $subtreePrefix/VIBE-CODING.VERSION.md." @(
            "You need to restore the embedded kit version file before running kit update."
        ) @()
    }

    $remoteFetchLines = @(git remote -v 2>$null | Where-Object { $_ -match '\(fetch\)$' })
    $remoteFetchMap = @{}
    foreach ($line in $remoteFetchLines) {
        if ($line -match '^(\S+)\s+(\S+)\s+\(fetch\)$') {
            $remoteFetchMap[$Matches[1]] = $Matches[2]
        }
    }
    $selectedRemoteLine = $null
    $selectedRemoteName = $RemoteName
    if ($selectedRemoteName) {
        $selectedRemoteLine = $remoteFetchLines | Where-Object { $_ -match "^$([regex]::Escape($selectedRemoteName))\s+" } | Select-Object -First 1
        if (-not $selectedRemoteLine) {
            Fail-KitUpdate "Configured remote '$selectedRemoteName' was not found." @(
                "You need to provide a valid kit upstream ref that can be verified before update can proceed."
            ) @()
        }
    } else {
        $matchingRemotes = @($remoteFetchLines | Where-Object { $_ -match 'vibe-coding-kit' })
        if ($matchingRemotes.Count -eq 0) {
            Fail-KitUpdate "No candidate vibe-coding-kit remote was found in local git config." @(
                "You need to provide a valid kit upstream ref that can be verified before update can proceed."
            ) @("Rerun with -RemoteName <configured-remote> if the remote name does not include vibe-coding-kit.")
        }
        if ($matchingRemotes.Count -gt 1) {
            Fail-KitUpdate "Multiple candidate kit remotes were found." @(
                "You need to provide a valid kit upstream ref that can be verified before update can proceed."
            ) $matchingRemotes
        }
        $selectedRemoteLine = $matchingRemotes[0]
        if ($selectedRemoteLine -match '^(\S+)\s+') {
            $selectedRemoteName = $Matches[1]
        }
    }

    if (-not $selectedRemoteName) {
        Fail-KitUpdate "Unable to determine the target remote name." @(
            "You need to provide a valid kit upstream ref that can be verified before update can proceed."
        ) @()
    }

    $nonKitRemoteNames = @(
        $remoteFetchMap.Keys |
        Where-Object {
            $_ -ne $selectedRemoteName -and
            ($remoteFetchMap[$_] -notmatch 'vibe-coding-kit')
        }
    )

    $upstreamRemoteName = $null
    try {
        $upstreamRef = ((git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null) | Out-String).Trim()
        if ($upstreamRef -match '^([^/]+)/') {
            $upstreamRemoteName = $Matches[1]
        }
    } catch {
        $upstreamRemoteName = $null
    }

    $defaultBranchRemoteCandidates = [System.Collections.Generic.List[string]]::new()
    if ($upstreamRemoteName -and ($nonKitRemoteNames -contains $upstreamRemoteName)) {
        $defaultBranchRemoteCandidates.Add($upstreamRemoteName)
    }
    if (($nonKitRemoteNames -contains 'origin') -and (-not $defaultBranchRemoteCandidates.Contains('origin'))) {
        $defaultBranchRemoteCandidates.Add('origin')
    }
    foreach ($remoteName in $nonKitRemoteNames) {
        if (-not $defaultBranchRemoteCandidates.Contains($remoteName)) {
            $defaultBranchRemoteCandidates.Add($remoteName)
        }
    }
    if ($defaultBranchRemoteCandidates.Count -eq 0) {
        Write-Host "WARN: Could not identify a non-kit repo remote for default-branch detection; falling back to selected kit remote '$selectedRemoteName'." -ForegroundColor Yellow
        $defaultBranchRemoteCandidates.Add($selectedRemoteName)
    }

    $defaultBranch = $null
    $defaultBranchRemote = $null
    $defaultBranchDetectionNotes = [System.Collections.Generic.List[string]]::new()
    foreach ($candidateRemote in $defaultBranchRemoteCandidates) {
        try {
            $symrefLine = (git ls-remote --symref $candidateRemote HEAD 2>$null |
                Where-Object { $_ -match '^ref:\s+(refs/heads/.+|refs/remotes/.+)\s+HEAD$' } |
                Select-Object -First 1)

            if ($symrefLine -match '^ref:\s+refs/heads/(.+)\s+HEAD$') {
                $defaultBranch = $Matches[1]
                $defaultBranchRemote = $candidateRemote
            } elseif ($symrefLine -match '^ref:\s+refs/remotes/[^/]+/(.+)\s+HEAD$') {
                $defaultBranch = $Matches[1]
                $defaultBranchRemote = $candidateRemote
            } else {
                $remoteHeadRef = ((git symbolic-ref "refs/remotes/$candidateRemote/HEAD" 2>$null) | Out-String).Trim()
                if ($remoteHeadRef -match '^refs/remotes/[^/]+/(.+)$') {
                    $defaultBranch = $Matches[1]
                    $defaultBranchRemote = $candidateRemote
                }
            }

            if ($defaultBranch) {
                break
            }

            $defaultBranchDetectionNotes.Add("Default branch symref unresolved for remote '$candidateRemote'.")
        } catch {
            $defaultBranchDetectionNotes.Add("Could not query default branch for remote '$candidateRemote': $_")
        }
    }

    if (-not $defaultBranch) {
        Fail-KitUpdate "Could not determine the repository default branch for the safety gate." @(
            "Set or verify a consumer repo remote (upstream/origin) with a valid HEAD symref, then rerun kit-update."
            "If only the kit source remote is configured, add a consumer repo remote before updating."
        ) $defaultBranchDetectionNotes
    }

    if ($branch -eq $defaultBranch) {
        Fail-KitUpdate "kit-update must not run on the repo default branch ($branch)." @(
            "Create a dedicated branch (e.g., chore/kit-update) and run kit-update from there."
            "Example: git checkout -b chore/kit-update"
        ) @()
    }

    Write-Host ""
    Write-Host "========== KIT UPDATE PLAN ==========" -ForegroundColor Cyan
    Write-Host "RepoRoot      = $targetRepoRoot"
    Write-Host "DOCS_ROOT     = $docsRoot | Reason=$docsReason"
    Write-Host "Branch        = $branch"
    Write-Host "SubtreePrefix = $subtreePrefix"
    Write-Host "Target        = $selectedRemoteName/$Ref"
    Write-Host "LocalVersion  = $($localVersionData.Version) (Effective $($localVersionData.Effective))"
    if ($WhatIf) {
        Write-Host "Mode          = WhatIf (verification only; no subtree pull)"
    }
    Write-Host "=====================================" -ForegroundColor Cyan

    try {
        Invoke-GitSafe ls-remote --exit-code --heads $selectedRemoteName $Ref | Out-Null
    } catch {
        Fail-KitUpdate "Target upstream ref '$selectedRemoteName/$Ref' could not be verified." @(
            "You need to provide a valid kit upstream ref that can be verified before update can proceed."
        ) @("Verification failed: $_")
    }

    try {
        Invoke-GitSafe fetch $selectedRemoteName $Ref | Out-Null
    } catch {
        Fail-KitUpdate "Verification fetch failed for '$selectedRemoteName/$Ref'." @(
            "You need to restore remote verification capability before kit update can proceed."
        ) @("Fetch failed: $_")
    }

    $remoteVersionText = ""
    try {
        $remoteVersionText = (Invoke-GitSafe show "FETCH_HEAD:VIBE-CODING.VERSION.md" | Out-String).Trim()
    } catch {
        Fail-KitUpdate "Fetched upstream ref did not expose VIBE-CODING.VERSION.md." @(
            "You need to provide a valid kit upstream ref that can be verified before update can proceed."
        ) @()
    }

    $remoteVersionData = [pscustomobject]@{ Version = "(unknown)"; Effective = "(unknown)" }
    if ($remoteVersionText -match '\*\*Version:\*\*\s*(v[\d.]+)') {
        $remoteVersionData.Version = $Matches[1]
    }
    if ($remoteVersionText -match '\*\*Effective Date:\*\*\s*(\d{4}-\d{2}-\d{2})') {
        $remoteVersionData.Effective = $Matches[1]
    }
    if ($remoteVersionData.Version -eq "(unknown)") {
        Fail-KitUpdate "Fetched upstream ref did not expose a parseable kit version." @(
            "You need to provide a valid kit upstream ref that can be verified before update can proceed."
        ) @()
    }

    $payloadSha = ((Invoke-GitSafe rev-parse 'FETCH_HEAD' | Out-String).Trim())

    $sentinelFiles = @("VIBE-CODING.VERSION.md", "protocol/protocol-v7.md", "protocol-lite.md")
    foreach ($sentinel in $sentinelFiles) {
        try {
            Invoke-GitSafe rev-parse "FETCH_HEAD:$sentinel" | Out-Null
        } catch {
            Fail-KitUpdate "Fetched upstream ref is missing required sentinel '$sentinel'." @(
                "You need to provide a valid kit upstream ref that can be verified before update can proceed."
            ) @()
        }
    }

    $previewPlan = $null
    try {
        $previewPlan = Get-KitUpdatePreviewPlan -SubtreePrefix $subtreePrefix
    } catch {
        Fail-KitUpdate "Could not compute deterministic file-level update preview plan." @(
            "You need to restore subtree comparison capability before kit update can proceed."
        ) @("Preview diff failed: $_")
    }

    Write-KitUpdatePreviewPlan -Plan $previewPlan -SubtreePrefix $subtreePrefix
    if ($previewPlan.OutsideBoundary.Count -gt 0) {
        Fail-KitUpdate "Preview plan includes paths outside the expected kit subtree boundary." @(
            "Review and resolve out-of-boundary paths before retrying kit update."
        ) $previewPlan.OutsideBoundary
    }

    if ($localVersionData.Version -eq $remoteVersionData.Version) {
        $divergentFiles = @()
        foreach ($sentinel in $sentinelFiles) {
            try {
                $localBlob = (Invoke-GitSafe rev-parse "HEAD:${subtreePrefix}/$sentinel" | Out-String).Trim()
                $remoteBlob = (Invoke-GitSafe rev-parse "FETCH_HEAD:$sentinel" | Out-String).Trim()
                if ($localBlob -and $remoteBlob -and $localBlob -ne $remoteBlob) {
                    $divergentFiles += $sentinel
                }
            } catch {
                $divergentFiles += $sentinel
            }
        }
        if ($divergentFiles.Count -gt 0) {
            Fail-KitUpdate "Divergent subtree contamination detected for the current kit version." @(
                "You need to remove local kit subtree contamination before update can proceed."
            ) $divergentFiles
        }

        Write-Host "KitUpdate=NOOP(Current)" -ForegroundColor Green
        Write-Host "Target kit version matches local subtree and sentinel parity checks passed." -ForegroundColor Green
        $snapshotStatus = Invoke-SnapshotIsolationEnforcement -RepoRoot $targetRepoRoot -DocsRoot $docsRoot -SubtreePrefix $subtreePrefix -WhatIf:$WhatIf
        Write-Host "SnapshotIsolation = $snapshotStatus" -ForegroundColor White
        Write-Host "Packet sync remains optional for full forGPT mirror refresh." -ForegroundColor Yellow
        exit 0
    }

    Write-Host "You need to update the kit now. Preconditions passed and the target ref was verified." -ForegroundColor Yellow
    Write-Host "TargetVersion = $($remoteVersionData.Version) (Effective $($remoteVersionData.Effective))" -ForegroundColor Yellow

    if ($WhatIf) {
        Write-Host "[WhatIf] Would run: git subtree pull --prefix $subtreePrefix $selectedRemoteName $Ref --squash" -ForegroundColor Cyan
        Write-Host "You need to run packet sync separately if you require a current handoff packet." -ForegroundColor Yellow
        exit 0
    }

    try {
        $applyResult = Invoke-KitUpdatePlanApply -Plan $previewPlan -TargetRepoRoot $targetRepoRoot -SubtreePrefix $subtreePrefix -PayloadRef 'FETCH_HEAD' -SourceSHA $sourceSha -PayloadSHA $payloadSha -TargetVersion $remoteVersionData.Version -Commit:$Commit
    } catch {
        Fail-KitUpdate "Deterministic apply failed." @(
            "You need to inspect the plan-driven apply failure before retrying kit update."
        ) @("Apply failed: $_")
    }

    Write-Host ""
    Write-Host "========== KIT UPDATE RESULT ==========" -ForegroundColor Green
    Write-Host "KitUpdate    = $($applyResult.ResultMode)"
    Write-Host "Target       = $selectedRemoteName/$Ref"
    Write-Host "LocalVersion = $($applyResult.PayloadVersion)"
    Write-Host "SourceKitSHA = $($applyResult.SourceKitSHA)"
    Write-Host "PayloadSHA   = $($applyResult.PayloadSHA)"
    if ($applyResult.CommitSha) {
        Write-Host "AppliedCommit = $($applyResult.CommitSha)"
    } else {
        Write-Host "AppliedCommit = review pending" -ForegroundColor Yellow
        Write-Host "NextCommand   = $($applyResult.NextCommand)" -ForegroundColor Yellow
    }
    $snapshotStatus = Invoke-SnapshotIsolationEnforcement -RepoRoot $targetRepoRoot -DocsRoot $docsRoot -SubtreePrefix $subtreePrefix -WhatIf:$WhatIf
    Write-Host "SnapshotIsolation = $snapshotStatus"
    Write-Host "=======================================" -ForegroundColor Green
    Write-Host "Packet sync remains optional for full forGPT mirror refresh." -ForegroundColor Yellow
} catch {
    if ($_.Exception.Message -eq "__KIT_UPDATE_STOP__") {
        exit 1
    }

    Write-Host "HARD STOP: Kit update failed unexpectedly." -ForegroundColor Red
    Write-Host "  $_" -ForegroundColor Yellow
    if ($script:EmitPreviewSafetyOnFailure) {
        Write-Host ""
        Write-Host "Preview safety:" -ForegroundColor Yellow
        Write-Host "BLOCKED - unexpected preview failure" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Required Actions:" -ForegroundColor Yellow
    Write-Host "  - You need to inspect the kit update failure before retrying." -ForegroundColor Yellow
    exit 1
} finally {
    Pop-Location
}