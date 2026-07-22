<#
.SYNOPSIS
  Universal runner for vibe-coding-kit tools. Path-independent.
.DESCRIPTION
  Discovers tool paths from its own location (tools/ folder) and invokes
  the requested tool, forwarding any additional arguments.
  Works regardless of current working directory or DOCS_ROOT nesting depth.

  Common tool flags are declared explicitly so PS 5.1 binds them correctly.
  Any unlisted flags can still be passed via -ToolArgs (escape hatch).
.PARAMETER Tool
  Which tool to run: start, session-start, session-start-kit, kit-update, end-session, sync-forgpt, doc-audit, risk-check.
.PARAMETER WhatIf
  Print what would be executed without running it.
.PARAMETER WriteReport
  (end-session) Write a markdown status report.
.PARAMETER SkipFetch
  (end-session) Skip git fetch origin.
.PARAMETER SkipUpdate
  (session-start) Deprecated compatibility flag.
.PARAMETER SkipAudit
  (session-start) Skip Consumer doc-audit step.
.PARAMETER Force
  (session-start) Deprecated compatibility flag.
.PARAMETER Mode
  (doc-audit) Explicit mode: Kit or Consumer.
.PARAMETER StartSession
  (doc-audit) Print session-start snippets before audit.
.PARAMETER ToolArgs
  Escape-hatch: extra arguments forwarded verbatim to the underlying tool.
.EXAMPLE
  .\run-vibe.ps1 -Tool start
  Runs non-mutating startup audit flow: session-start only, then final READY/BLOCKED status and explicit next actions.
 .EXAMPLE
  .\run-vibe.ps1 -Tool session-start
  .\run-vibe.ps1 -Tool session-start-kit
  .\run-vibe.ps1 -Tool kit-update
  .\run-vibe.ps1 -Tool end-session -WriteReport
  .\run-vibe.ps1 -Tool doc-audit -Mode Consumer -StartSession
  .\run-vibe.ps1 -Tool risk-check -UseGitChanges
  .\run-vibe.ps1 -Tool sync-forgpt -WhatIf
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory, Position = 0)]
  [ValidateSet("start", "session-start", "session-start-kit", "kit-update", "end-session", "sync-forgpt", "doc-audit", "risk-check")]
    [string]$Tool,

    [switch]$WhatIf,

    # end-session flags
    [switch]$WriteReport,
    [switch]$SkipFetch,

    # session-start flags
    [switch]$SkipUpdate,
    [switch]$SkipAudit,
    [switch]$Force,

    # doc-audit flags
    [string]$Mode,
    [switch]$StartSession,

    # risk-check flags
    [switch]$UseGitChanges,
    [string[]]$PlannedPaths,

    # escape hatch
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ToolArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-ToolAndCapture {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][string]$ScriptPath,
    [hashtable]$NamedArgs,
    [string[]]$PositionalArgs,
    [string]$Label
  )

  $lines = @()
  if (-not $NamedArgs) { $NamedArgs = @{} }
  if (-not $PositionalArgs) { $PositionalArgs = @() }

  if ($Label) {
    Write-Host ""
    Write-Host "=== $Label ===" -ForegroundColor Cyan
  }

  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $output = @()
  try {
    if ($PositionalArgs.Count -gt 0) {
      $output = & $ScriptPath @NamedArgs @PositionalArgs *>&1
    } else {
      $output = & $ScriptPath @NamedArgs *>&1
    }
  } catch {
    $output += $_
    if (-not $LASTEXITCODE -or $LASTEXITCODE -eq 0) {
      $global:LASTEXITCODE = 1
    }
  } finally {
    $ErrorActionPreference = $prevEap
  }
  $exitCode = $LASTEXITCODE

  foreach ($item in $output) {
    $line = "$item"
    $lines += $line
    Write-Host $line
  }

  return [pscustomobject]@{
    ExitCode = $exitCode
    Lines    = $lines
  }
}

function Parse-SessionStartSummary {
  [CmdletBinding()]
  param([string[]]$Lines)

  $state = [ordered]@{
    Tree           = "UNKNOWN"
    KitLag         = "UNKNOWN"
    ConsumerDrift  = "UNKNOWN"
    PacketStatus   = "UNKNOWN"
    StalenessExpiry = "UNKNOWN"
    DecisionQueue  = "UNKNOWN"
    ToolAuth       = "UNKNOWN"
    BlockedReasons = @()
  }

  foreach ($raw in $Lines) {
    $line = $raw.Trim()

    if ($line -match 'RepoRoot=.*\|\s*Branch=.*\|\s*Tree=([A-Z]+)') {
      $state.Tree = $Matches[1]
      continue
    }
    if ($line -match 'KitVersion=.*\|\s*Effective=.*\|\s*KitLag=([^|]+)\|') {
      $state.KitLag = $Matches[1].Trim()
      continue
    }
    if ($line -match '^ConsumerDrift=([A-Z]+)') {
      $state.ConsumerDrift = $Matches[1]
      if ($Matches[1] -eq 'BLOCKED') { $state.BlockedReasons += 'ConsumerDrift' }
      continue
    }
    if ($line -match '^PacketStatus=([A-Z]+)') {
      $state.PacketStatus = $Matches[1]
      continue
    }
    if ($line -match '^StalenessExpiry=([A-Z]+)') {
      $state.StalenessExpiry = $Matches[1]
      if ($Matches[1] -eq 'BLOCKED') { $state.BlockedReasons += 'StalenessExpiry' }
      continue
    }
    if ($line -match '^DecisionQueue=([A-Z]+)') {
      $state.DecisionQueue = $Matches[1]
      if ($Matches[1] -eq 'BLOCKED') { $state.BlockedReasons += 'DecisionQueue' }
      continue
    }
    if ($line -match '^ToolAuth=([A-Z]+)') {
      $state.ToolAuth = $Matches[1]
      if ($Matches[1] -eq 'BLOCKED') { $state.BlockedReasons += 'ToolAuth' }
      continue
    }
  }

  $state.BlockedReasons = @($state.BlockedReasons | Select-Object -Unique)
  return [pscustomobject]$state
}

function Get-RepoRootPath {
  [CmdletBinding()]
  param()

  try {
    $root = (git rev-parse --show-toplevel 2>$null | Select-Object -First 1)
    if ($null -ne $root) {
      $trimmed = $root.Trim()
      if ($trimmed) {
        return ($trimmed -replace '/', '\\')
      }
    }
  } catch {
    # fall through
  }

  return $null
}

function Invoke-NativeCommandNoThrow {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][scriptblock]$Command
  )

  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $output = @()
  $exitCode = 0

  try {
    $output = & $Command 2>&1
    $exitCode = $LASTEXITCODE
  } catch {
    $output += $_
    if (-not $LASTEXITCODE -or $LASTEXITCODE -eq 0) {
      $exitCode = 1
    } else {
      $exitCode = $LASTEXITCODE
    }
  } finally {
    $ErrorActionPreference = $prevEap
  }

  return [pscustomobject]@{
    Output   = @($output)
    ExitCode = $exitCode
  }
}

# -- Resolve paths from script location -------------------------
$kitHead = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$docsRootDisplay = "(kit source repo)"

if ((Split-Path $kitHead -Leaf) -eq "vibe-coding") {
    $docsRootFull = (Resolve-Path (Join-Path $kitHead "..")).Path
    try {
    $repoRoot = Get-RepoRootPath
    $repoRootNorm = $repoRoot -replace '/', '\\'
        $docsRootNorm = $docsRootFull -replace '/', '\'
        if ($docsRootNorm.Length -gt $repoRootNorm.Length -and $docsRootNorm.StartsWith($repoRootNorm)) {
            $docsRootDisplay = ($docsRootNorm.Substring($repoRootNorm.Length).TrimStart('\')) -replace '\\', '/'
        } elseif ($docsRootNorm -eq $repoRootNorm) {
            $docsRootDisplay = "."
        }
    } catch { }
}

# -- Map tool name to script ------------------------------------
$toolScript = Join-Path $PSScriptRoot "$Tool.ps1"
if ($Tool -ne 'start' -and -not (Test-Path $toolScript)) {
    Write-Error "HARD STOP: Tool script not found: $toolScript"
    exit 1
}

# -- Build forwarding args (hashtable for named, array for positional) --
if (-not $ToolArgs) { $ToolArgs = @() }
$named = @{}

# Switches relevant to each tool
if ($WhatIf)       { $named["WhatIf"]       = $true }
if ($WriteReport)  { $named["WriteReport"]  = $true }
if ($SkipFetch)    { $named["SkipFetch"]    = $true }
if ($SkipUpdate)   { $named["SkipUpdate"]   = $true }
if ($SkipAudit)    { $named["SkipAudit"]    = $true }
if ($Force)        { $named["Force"]        = $true }
if ($StartSession) { $named["StartSession"] = $true }
if ($Mode)         { $named["Mode"]         = $Mode }
if ($UseGitChanges){ $named["UseGitChanges"] = $true }
if ($PlannedPaths) { $named["PlannedPaths"] = $PlannedPaths }

# Positional escape-hatch args
$positional = @($ToolArgs)

# -- Build display string for WhatIf ----------------------------
$displayParts = @()
foreach ($key in $named.Keys) {
    $val = $named[$key]
    if ($val -is [bool]) {
        $displayParts += "-$key"
    } else {
        $displayParts += "-$key $val"
    }
}
if ($positional.Count -gt 0) { $displayParts += $positional }
$displayStr = $displayParts -join ' '

# -- Unified start flow -----------------------------------------
if ($Tool -eq 'start') {
  $steps = [System.Collections.Generic.List[string]]::new()
  $sessionStartScript = Join-Path $PSScriptRoot "session-start.ps1"
  $sessionStartNamed = @{}

  if ($SkipAudit) {
    $sessionStartNamed["SkipAudit"] = $true
  }
  if ($SkipUpdate) {
    $sessionStartNamed["SkipUpdate"] = $true
  }
  if ($Force) {
    $sessionStartNamed["Force"] = $true
  }

  foreach ($scriptPath in @($sessionStartScript)) {
    if (-not (Test-Path $scriptPath)) {
      Write-Error "HARD STOP: Required tool script not found: $scriptPath"
      exit 1
    }
  }

  if ($WhatIf) {
    Write-Host ""
    Write-Host "========== RUN-VIBE START (WhatIf) ==========" -ForegroundColor Cyan
    Write-Host "DOCS_ROOT  = $docsRootDisplay"
    Write-Host "KitHead    = $kitHead"
    Write-Host "Plan:" -ForegroundColor Yellow
    Write-Host "  1. Run session-start"
    Write-Host "  2. Print READY/BLOCKED and explicit next actions"
    Write-Host "  3. No kit update, packet sync, subtree pull, or auto-commit is performed by default start"
    Write-Host "=============================================" -ForegroundColor Cyan
    exit 0
  }

  $initial = Invoke-ToolAndCapture -ScriptPath $sessionStartScript -NamedArgs $sessionStartNamed -Label "Step 1 - session-start"
  $steps.Add("session-start")
  if ($initial.ExitCode -ne 0) {
    Write-Host ""
    Write-Host "FinalState=BLOCKED" -ForegroundColor Red
    Write-Host "Reason=session-start failed (exit $($initial.ExitCode))" -ForegroundColor Red
    Write-Host "SafeToProceed=NO" -ForegroundColor Red
    exit $initial.ExitCode
  }

  $state1 = Parse-SessionStartSummary -Lines $initial.Lines
  $isBlocked = $state1.BlockedReasons.Count -gt 0

  Write-Host ""
  Write-Host "========== RUN-VIBE START RESULT ==========" -ForegroundColor Cyan
  Write-Host "StepsExecuted:" -ForegroundColor Yellow
  for ($i = 0; $i -lt $steps.Count; $i++) {
    Write-Host ("  {0}. {1}" -f ($i + 1), $steps[$i])
  }
  Write-Host ""
  Write-Host "FinalGateSummary:" -ForegroundColor Yellow
  Write-Host "  ConsumerDrift=$($state1.ConsumerDrift)"
  Write-Host "  PacketStatus=$($state1.PacketStatus)"
  Write-Host "  StalenessExpiry=$($state1.StalenessExpiry)"
  Write-Host "  DecisionQueue=$($state1.DecisionQueue)"
  Write-Host "  ToolAuth=$($state1.ToolAuth)"

  Write-Host ""
  Write-Host "ExplicitRepairActions:" -ForegroundColor Yellow
  if ($state1.KitLag -eq 'WARN(lag)') {
    Write-Host "  - Run explicit update only when ready: .\\tools\\run-vibe.ps1 -Tool kit-update" -ForegroundColor Yellow
  }
  if ($state1.PacketStatus -eq 'STALE' -or $state1.PacketStatus -eq 'MISSING') {
    Write-Host "  - Run explicit packet sync only when needed: .\\tools\\run-vibe.ps1 -Tool sync-forgpt" -ForegroundColor Yellow
  }
  Write-Host "  - Default start is audit-only and never auto-commits." -ForegroundColor Yellow

  if ($isBlocked) {
    Write-Host ("FinalState=BLOCKED ({0})" -f ($state1.BlockedReasons -join ', ')) -ForegroundColor Red
    Write-Host "SafeToProceed=NO" -ForegroundColor Red
    Write-Host "===========================================" -ForegroundColor Cyan
    exit 1
  }

  Write-Host "FinalState=READY" -ForegroundColor Green
  Write-Host "SafeToProceed=YES" -ForegroundColor Green
  Write-Host "===========================================" -ForegroundColor Cyan
  exit 0
}

# -- WhatIf: print and exit ------------------------------------
if ($WhatIf -and $Tool -eq 'kit-update') {
  Write-Host ""
  Write-Host "========== RUN-VIBE (WhatIf passthrough) ==========" -ForegroundColor Cyan
  Write-Host "DOCS_ROOT  = $docsRootDisplay"
  Write-Host "KitHead    = $kitHead"
  Write-Host "Tool       = $Tool"
  Write-Host "ToolScript = $toolScript"
  Write-Host "ForwardMode = Execute child WhatIf preview"
  Write-Host "====================================================" -ForegroundColor Cyan

  if ($positional.Count -gt 0) {
    & $toolScript @named @positional
  } else {
    & $toolScript @named
  }
  exit $LASTEXITCODE
}

if ($WhatIf) {
    Write-Host ""
    Write-Host "========== RUN-VIBE (WhatIf) ==========" -ForegroundColor Cyan
    Write-Host "DOCS_ROOT  = $docsRootDisplay"
    Write-Host "KitHead    = $kitHead"
    Write-Host "Tool       = $Tool"
    Write-Host "ToolScript = $toolScript"
    if ($displayStr) {
        Write-Host "ForwardArgs = $displayStr"
    }
    Write-Host ""
    Write-Host "[WhatIf] Would run: & `"$toolScript`" $displayStr" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    exit 0
}

# -- Execute the tool (hashtable splat + positional splat) ------
Write-Host "run-vibe: invoking $Tool..." -ForegroundColor Yellow
if ($positional.Count -gt 0) {
    & $toolScript @named @positional
} else {
    & $toolScript @named
}
exit $LASTEXITCODE
