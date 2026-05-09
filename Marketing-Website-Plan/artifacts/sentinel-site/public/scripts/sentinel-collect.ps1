# ============================================================
#  sentinel-collect.ps1  —  Sentinel Hardware Collector v1
#  Schema version: 1
#
#  Outputs structured JSON for paste-back parsing at:
#  sentinelapp.io/health-test → "Parse your output" tab
#
#  Run in PowerShell (no administrator required for most checks):
#    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#    .\sentinel-collect.ps1
#
#  The JSON is printed to the console AND copied to your clipboard.
# ============================================================

$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference    = 'SilentlyContinue'

# ── System ────────────────────────────────────────────────────────────────────
$cs   = Get-CimInstance Win32_ComputerSystem
$os   = Get-CimInstance Win32_OperatingSystem
$bios = Get-CimInstance Win32_BIOS

$system = [ordered]@{
    hostname     = $env:COMPUTERNAME
    model        = "$($cs.Manufacturer) $($cs.Model)".Trim()
    manufacturer = $cs.Manufacturer
    os           = $os.Caption
    osVersion    = $os.Version
    biosVersion  = $bios.SMBIOSBIOSVersion
}

# ── Battery ───────────────────────────────────────────────────────────────────
$battery = $null
$battWmi    = Get-CimInstance Win32_Battery
$battFull   = Get-CimInstance -Namespace root\wmi -ClassName BatteryFullChargedCapacity  -ErrorAction SilentlyContinue
$battDesign = Get-CimInstance -Namespace root\wmi -ClassName BatteryStaticData           -ErrorAction SilentlyContinue
$battCycles = Get-CimInstance -Namespace root\wmi -ClassName BatteryCycleCount           -ErrorAction SilentlyContinue
$battStatus = Get-CimInstance -Namespace root\wmi -ClassName BatteryStatus               -ErrorAction SilentlyContinue

if ($battWmi) {
    $designCap  = if ($battDesign) { [int]($battDesign.DesignedCapacity) } else { [int]($battWmi.DesignCapacity) }
    $fullCap    = if ($battFull)   { [int]($battFull.FullChargedCapacity)  } else { [int]($battWmi.FullChargeCapacity) }
    $cycles     = if ($battCycles) { [int]($battCycles.CycleCount) }         else { $null }
    $health     = if ($designCap -and $fullCap -and $designCap -gt 0) {
                      [math]::Round(($fullCap / $designCap) * 100, 1)
                  } else { $null }
    $discharge  = if ($battStatus) { [int]($battStatus.DischargeRate) } else { $null }

    $battery = [ordered]@{
        designCapacity     = $designCap
        fullChargeCapacity = $fullCap
        cycleCount         = $cycles
        health             = $health
        status             = [int]($battWmi.BatteryStatus)
        dischargeRateMw    = $discharge
    }
}

# ── Thermals ──────────────────────────────────────────────────────────────────
$thermalZones = @()
$maxTemp      = $null
$temps        = Get-CimInstance -Namespace root\wmi -ClassName MSAcpi_ThermalZoneTemp -ErrorAction SilentlyContinue
foreach ($zone in $temps) {
    $c = [math]::Round(($zone.CurrentTemperature / 10.0) - 273.15, 1)
    if ($null -eq $maxTemp -or $c -gt $maxTemp) { $maxTemp = $c }
    $thermalZones += [ordered]@{ name = $zone.InstanceName; tempC = $c }
}

$thermals = [ordered]@{
    maxTempC   = $maxTemp
    zoneCount  = $thermalZones.Count
    zones      = $thermalZones
}

# ── Storage ───────────────────────────────────────────────────────────────────
$storageList = @()
$physDisks   = Get-PhysicalDisk -ErrorAction SilentlyContinue
foreach ($disk in $physDisks) {
    $reliability = $disk | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue
    $volumes     = Get-Disk | Where-Object { $_.SerialNumber -eq $disk.SerialNumber -or $_.FriendlyName -eq $disk.FriendlyName } |
                   Get-Partition | Get-Volume -ErrorAction SilentlyContinue | Where-Object { $_.DriveLetter }
    $vol         = $volumes | Sort-Object SizeRemaining | Select-Object -First 1
    $freeSpacePct = if ($vol -and $vol.Size -gt 0) { [math]::Round(($vol.SizeRemaining / $vol.Size) * 100, 1) } else { $null }

    $storageList += [ordered]@{
        model              = $disk.FriendlyName
        type               = $disk.MediaType
        healthPct          = if ($reliability) { [int]($reliability.Wear) }                     else { $null }
        reallocatedSectors = if ($reliability) { [int]($reliability.ReadErrorsUncorrected) }    else { $null }
        wearLevelPct       = if ($reliability) { [int]($reliability.Wear) }                     else { $null }
        freeSpacePct       = $freeSpacePct
        totalGB            = [math]::Round($disk.Size / 1GB, 0)
    }
}

# ── Memory ────────────────────────────────────────────────────────────────────
$memOS = Get-CimInstance Win32_OperatingSystem
$memory = [ordered]@{
    totalGB  = [math]::Round($memOS.TotalVisibleMemorySize / 1MB, 1)
    usedPct  = [math]::Round((($memOS.TotalVisibleMemorySize - $memOS.FreePhysicalMemory) / $memOS.TotalVisibleMemorySize) * 100, 1)
}

# ── CPU ───────────────────────────────────────────────────────────────────────
$proc    = Get-CimInstance Win32_Processor | Select-Object -First 1
$loadAvg = (Get-CimInstance Win32_Processor | Select-Object -ExpandProperty LoadPercentage | Measure-Object -Average).Average

$cpu = [ordered]@{
    name        = $proc.Name.Trim()
    cores       = [int]($proc.NumberOfCores)
    threads     = [int]($proc.NumberOfLogicalProcessors)
    avgLoadPct  = [math]::Round($loadAvg, 1)
    maxClockMhz = [int]($proc.MaxClockSpeed)
}

# ── Startup ───────────────────────────────────────────────────────────────────
$startup = [ordered]@{
    lastBootTime = $os.LastBootUpTime.ToString('o')
}

# ── Assemble ──────────────────────────────────────────────────────────────────
$output = [ordered]@{
    sentinelSchema = 1
    generatedAt    = (Get-Date -Format 'o')
    system         = $system
    battery        = $battery
    thermals       = $thermals
    storage        = $storageList
    memory         = $memory
    cpu            = $cpu
    startup        = $startup
}

$json = $output | ConvertTo-Json -Depth 10 -Compress

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Sentinel Collect — output below"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host $json
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

try {
    $json | Set-Clipboard
    Write-Host "✓ Output copied to clipboard." -ForegroundColor Green
} catch {
    Write-Host "  (Could not copy to clipboard — copy the JSON above manually.)" -ForegroundColor Yellow
}

Write-Host "  Paste it at: sentinelapp.io/health-test  →  'Parse your output'" -ForegroundColor Cyan
Write-Host ""
