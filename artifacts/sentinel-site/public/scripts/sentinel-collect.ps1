# ============================================================
#  sentinel-collect.ps1  --  Sentinel Hardware Collector v1
#  Schema version: 1
#
#  Outputs structured JSON for paste-back parsing at:
#  sentinelapp.io/health-test -> "Parse your output" tab
#
#  Run in PowerShell (no administrator required for most checks):
#    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#    .\sentinel-collect.ps1
#
#  Direct Upload:
#    .\sentinel-collect.ps1 -DirectUpload
#
#  The JSON is printed to the console AND copied to your clipboard.
# ============================================================

param([switch]$DirectUpload)

$SENTINEL_API_URL      = "https://sentinel-api-zaue.onrender.com"
$SENTINEL_FRONTEND_URL = "https://sentinel-site-rosy.vercel.app"

$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference    = 'SilentlyContinue'

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class NvmeSmart {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr CreateFile(string lpFileName, uint dwDesiredAccess, uint dwShareMode, IntPtr lpSecurityAttributes, uint dwCreationDisposition, uint dwFlagsAndAttributes, IntPtr hTemplateFile);
    
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool DeviceIoControl(IntPtr hDevice, uint dwIoControlCode, IntPtr lpInBuffer, uint nInBufferSize, IntPtr lpOutBuffer, uint nOutBufferSize, out uint lpBytesReturned, IntPtr lpOverlapped);
    
    [DllImport("kernel32.dll")]
    public static extern bool CloseHandle(IntPtr hObject);

    public class SmartData {
        public int PercentageUsed;
        public int AvailableSpare;
        public int AvailableSpareThreshold;
        public int CriticalWarning;
    }

    public static SmartData GetSmartInfo(int physicalDriveNumber) {
        IntPtr hDevice = CreateFile("\\\\.\\" + "PhysicalDrive" + physicalDriveNumber, 0, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
        if (hDevice == new IntPtr(-1)) return null;
        
        try {
            int bufferSize = 1024;
            IntPtr buffer = Marshal.AllocHGlobal(bufferSize);
            for(int i=0; i<bufferSize; i++) Marshal.WriteByte(buffer, i, 0);
            
            Marshal.WriteInt32(buffer, 0, 49);
            Marshal.WriteInt32(buffer, 4, 0); 
            Marshal.WriteInt32(buffer, 12, 3);
            Marshal.WriteInt32(buffer, 16, 2);
            Marshal.WriteInt32(buffer, 20, 2);
            Marshal.WriteInt32(buffer, 24, 0);
            Marshal.WriteInt32(buffer, 28, 40);
            Marshal.WriteInt32(buffer, 32, 512);
            
            uint bytesReturned;
            bool success = DeviceIoControl(hDevice, 0x2D1400, buffer, 52, buffer, (uint)bufferSize, out bytesReturned, IntPtr.Zero);
            
            if (success) {
                IntPtr logPagePtr = new IntPtr(buffer.ToInt64() + 40);
                SmartData data = new SmartData();
                data.CriticalWarning = Marshal.ReadByte(logPagePtr, 0);
                data.AvailableSpare = Marshal.ReadByte(logPagePtr, 3);
                data.AvailableSpareThreshold = Marshal.ReadByte(logPagePtr, 4);
                data.PercentageUsed = Marshal.ReadByte(logPagePtr, 5);
                Marshal.FreeHGlobal(buffer);
                return data;
            }
            Marshal.FreeHGlobal(buffer);
            return null;
        } finally {
            CloseHandle(hDevice);
        }
    }
}
"@


# -- System -----------------------------------------------------------------------
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

# -- Battery -----------------------------------------------------------------------
$battery = $null
$battWmi    = Get-CimInstance Win32_Battery
$battFull   = Get-CimInstance -Namespace root\wmi -ClassName BatteryFullChargedCapacity  -ErrorAction SilentlyContinue
$battDesign = Get-CimInstance -Namespace root\wmi -ClassName BatteryStaticData           -ErrorAction SilentlyContinue
$battCycles = Get-CimInstance -Namespace root\wmi -ClassName BatteryCycleCount           -ErrorAction SilentlyContinue
$battStatus = Get-CimInstance -Namespace root\wmi -ClassName BatteryStatus               -ErrorAction SilentlyContinue

if ($battWmi) {
    # Try multiple sources for design capacity (some OEMs report 0 in BatteryStaticData)
    $designCapRaw = if ($battDesign -and $battDesign.DesignedCapacity -gt 0) {
                        [int]($battDesign.DesignedCapacity)
                    } elseif ($battWmi.DesignCapacity -gt 0) {
                        [int]($battWmi.DesignCapacity)
                    } else { 0 }

    $fullCap    = if ($battFull -and $battFull.FullChargedCapacity -gt 0) {
                      [int]($battFull.FullChargedCapacity)
                  } elseif ($battWmi.FullChargeCapacity -gt 0) {
                      [int]($battWmi.FullChargeCapacity)
                  } else { 0 }

    $designCap  = $designCapRaw
    $cycles     = if ($battCycles) { [int]($battCycles.CycleCount) } else { $null }

    # Calculate health: prefer capacity-based; fall back to cycle-based estimate
    $health = $null
    if ($designCap -gt 0 -and $fullCap -gt 0) {
        $health = [math]::Round([math]::Min(($fullCap / $designCap) * 100, 100), 1)
    } elseif ($fullCap -gt 0 -and $designCap -eq 0) {
        # Design cap unavailable — store full cap only; report engine will handle it
        $designCap = $fullCap  # best-effort: assume design = full (shows 100% health)
        $health = 100.0
    }

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


# -- Thermals -----------------------------------------------------------------------
function Get-ThermalData {
    # 1. Performance Counter
    $samples = Get-Counter "\Thermal Zone Information(*)\Temperature" -SampleInterval 1 -MaxSamples 2 -ErrorAction SilentlyContinue
    if ($samples -and $samples.Count -ge 2) {
        $static = $true
        $zones = @{}
        foreach ($sample in $samples) {
            foreach ($reading in $sample.CounterSamples) {
                $c = [math]::Round(($reading.CookedValue - 273.15), 1)
                $k = $reading.CookedValue
                if ($k -lt 295 -or $k -gt 303) { $static = $false }
                
                $zoneName = $reading.InstanceName
                if ($zones.ContainsKey($zoneName)) {
                    if ($zones[$zoneName].tempC -ne $c) { $static = $false }
                } else {
                    $zones[$zoneName] = [ordered]@{ name = $zoneName; tempC = $c }
                }
            }
        }
        $zList = @($zones.Values)
        if ($zList.Count -gt 0) {
            if ($static) {
                return @{ source = "acpi_static_suspect"; zones = $zList }
            } else {
                return @{ source = "performance_counter"; zones = $zList }
            }
        }
    }

    # 2. MSAcpi_ThermalZoneTemp
    $temps1 = Get-CimInstance -Namespace root\wmi -ClassName MSAcpi_ThermalZoneTemp -ErrorAction SilentlyContinue
    if ($temps1) {
        Start-Sleep -Seconds 1
        $temps2 = Get-CimInstance -Namespace root\wmi -ClassName MSAcpi_ThermalZoneTemp -ErrorAction SilentlyContinue
        
        $static = $true
        $zList = @()
        for ($i = 0; $i -lt $temps1.Count; $i++) {
            $t1 = $temps1[$i].CurrentTemperature
            $t2 = if ($temps2) { $temps2[$i].CurrentTemperature } else { $t1 }
            if ($t1 -ne $t2) { $static = $false }
            if ($t1 -lt 2950 -or $t1 -gt 3030) { $static = $false }
            $c = [math]::Round(($t1 / 10.0) - 273.15, 1)
            $zList += [ordered]@{ name = $temps1[$i].InstanceName; tempC = $c }
        }
        if ($zList.Count -gt 0) {
            if ($static) {
                return @{ source = "acpi_static_suspect"; zones = $zList }
            } else {
                return @{ source = "acpi_wmi"; zones = $zList }
            }
        }
    }

    # 3. OpenHardwareMonitor
    try {
        $ohm = Get-CimInstance -Namespace root\OpenHardwareMonitor -ClassName Sensor -Filter "SensorType='Temperature'" -ErrorAction Stop
        if ($ohm) {
            $zList = @()
            foreach ($s in $ohm) {
                if ($s.Name -match "CPU Package|CPU Core") {
                    $zList += [ordered]@{ name = $s.Name; tempC = [math]::Round($s.Value, 1) }
                }
            }
            if ($zList.Count -eq 0) {
                foreach ($s in $ohm) { $zList += [ordered]@{ name = $s.Name; tempC = [math]::Round($s.Value, 1) } }
            }
            return @{ source = "ohm"; zones = $zList }
        }
    } catch {}

    # 4. LibreHardwareMonitor
    try {
        $lhm = Get-CimInstance -Namespace root\LibreHardwareMonitor -ClassName Sensor -Filter "SensorType='Temperature'" -ErrorAction Stop
        if ($lhm) {
            $zList = @()
            foreach ($s in $lhm) {
                if ($s.Name -match "CPU Package|CPU Core") {
                    $zList += [ordered]@{ name = $s.Name; tempC = [math]::Round($s.Value, 1) }
                }
            }
            if ($zList.Count -eq 0) {
                foreach ($s in $lhm) { $zList += [ordered]@{ name = $s.Name; tempC = [math]::Round($s.Value, 1) } }
            }
            return @{ source = "lhm"; zones = $zList }
        }
    } catch {}

    return @{ source = "unavailable"; zones = @() }
}

$thermalData = Get-ThermalData
$thermalZones = $thermalData.zones
$maxTemp = $null
if ($thermalZones.Count -gt 0 -and $thermalData.source -ne "unavailable" -and $thermalData.source -ne "acpi_static_suspect") {
    foreach ($z in $thermalZones) {
        if ($null -eq $maxTemp -or $z.tempC -gt $maxTemp) { $maxTemp = $z.tempC }
    }
}

$thermals = [ordered]@{
    maxTempC       = $maxTemp
    zoneCount      = $thermalZones.Count
    zones          = $thermalZones
    thermalSource  = $thermalData.source
    thermalSamples = $thermalZones.Count
}

# -- Storage -----------------------------------------------------------------------
$storageList = @()
$physDisks   = Get-PhysicalDisk -ErrorAction SilentlyContinue
foreach ($disk in $physDisks) {
    $reliability = $disk | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue
    $volumes     = Get-Disk | Where-Object { $_.SerialNumber -eq $disk.SerialNumber -or $_.FriendlyName -eq $disk.FriendlyName } |
                   Get-Partition | Get-Volume -ErrorAction SilentlyContinue | Where-Object { $_.DriveLetter }
    $vol         = $volumes | Sort-Object SizeRemaining | Select-Object -First 1
    $freeSpacePct = if ($vol -and $vol.Size -gt 0) { [math]::Round(($vol.SizeRemaining / $vol.Size) * 100, 1) } else { $null }

    $dataSource = "unavailable"
    $wearLevelPct = $null
    $healthPct = $null
    $poh = $null

    if ($reliability) {
        $poh = [int]($reliability.PowerOnHours)
        $wear = [int]($reliability.Wear)
        if ($disk.BusType -eq 17 -and ($wear -eq 0 -or $null -eq $reliability.Wear)) {
            # NVMe fallback method
            $smart = [NvmeSmart]::GetSmartInfo($disk.DeviceId)
            if ($smart) {
                $wearLevelPct = if ($smart.PercentageUsed -gt 100) { 0 } else { 100 - $smart.PercentageUsed }
                $dataSource = "nvme_smart_ioctl"
            } else {
                $dataSource = "reliability_counter"
                $wearLevelPct = $wear
            }
        } else {
            $dataSource = "reliability_counter"
            $wearLevelPct = $wear
        }
    }

    $storageList += [ordered]@{
        model              = $disk.FriendlyName
        type               = $disk.MediaType
        healthPct          = $healthPct
        reallocatedSectors = if ($reliability) { [int]($reliability.ReadErrorsUncorrected) } else { $null }
        wearLevelPct       = $wearLevelPct
        freeSpacePct       = $freeSpacePct
        totalGB            = [math]::Round($disk.Size / 1GB, 0)
        powerOnHours       = $poh
        dataSource         = $dataSource
    }
}

# -- Memory -----------------------------------------------------------------------
$memOS = Get-CimInstance Win32_OperatingSystem
$memory = [ordered]@{
    totalGB  = [math]::Round($memOS.TotalVisibleMemorySize / 1MB, 1)
    usedPct  = [math]::Round((($memOS.TotalVisibleMemorySize - $memOS.FreePhysicalMemory) / $memOS.TotalVisibleMemorySize) * 100, 1)
}

# -- CPU -----------------------------------------------------------------------
$proc    = Get-CimInstance Win32_Processor | Select-Object -First 1
$loadAvg = (Get-CimInstance Win32_Processor | Select-Object -ExpandProperty LoadPercentage | Measure-Object -Average).Average

$cpu = [ordered]@{
    name        = $proc.Name.Trim()
    cores       = [int]($proc.NumberOfCores)
    threads     = [int]($proc.NumberOfLogicalProcessors)
    avgLoadPct  = [math]::Round($loadAvg, 1)
    maxClockMhz = [int]($proc.MaxClockSpeed)
}

# -- Startup -----------------------------------------------------------------------
$startup = [ordered]@{
    lastBootTime = $os.LastBootUpTime.ToString('o')
}

# -- Assemble -----------------------------------------------------------------------
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
Write-Host "================================================================"
Write-Host "  Sentinel Collect -- output below"
Write-Host "================================================================"
Write-Host $json
Write-Host "================================================================"
Write-Host ""

try {
    $json | Set-Clipboard
    Write-Host "  [OK] Output copied to clipboard." -ForegroundColor Green
} catch {
    Write-Host "  (Could not copy to clipboard -- copy the JSON above manually.)" -ForegroundColor Yellow
}

Write-Host "  Paste it at: sentinel-site-rosy.vercel.app/health-test  -> 'Parse your output'" -ForegroundColor Cyan
Write-Host ""

# -- Direct Upload -----------------------------------------------------------------------
if ($DirectUpload) {
    Write-Host "  Sending data securely to Sentinel cloud..." -ForegroundColor Cyan
    
    $rawJsonString = $output | ConvertTo-Json -Depth 10 -Compress
    $body = '{"rawJson":' + $rawJsonString + '}'
    
    $maxRetries = 4
    $retryCount = 0
    $success = $false
    
    while (-not $success -and $retryCount -lt $maxRetries) {
        try {
            $response = Invoke-RestMethod -Method POST `
                -Uri "$SENTINEL_API_URL/api/reports" `
                -ContentType "application/json" `
                -Body $body `
                -ErrorAction Stop
            
            $reportId = $response.id
            $claimToken = $response.claimToken
            
            Write-Host "" 
            Write-Host "================================================================" -ForegroundColor Green
            Write-Host "  [OK] Data sent successfully." -ForegroundColor Green
            Write-Host "  Opening your report in the browser..." -ForegroundColor Green
            Write-Host "================================================================" -ForegroundColor Green
            Write-Host ""
            
            $url = "$SENTINEL_FRONTEND_URL/r/$reportId`?claim=$claimToken"
            Start-Process $url
            $success = $true
        } catch {
            $errMsg = $_
            $statusCode = 0
            try {
                $errBody = $_.Exception.Response
                if ($errBody) {
                    $statusCode = [int]$errBody.StatusCode
                    $reader = New-Object System.IO.StreamReader($errBody.GetResponseStream())
                    $serverMsg = $reader.ReadToEnd()
                    $reader.Close()
                    $errMsg = "$_ -- Server said: $serverMsg"
                }
            } catch {}
            
            $retryCount++
            
            # Retry on 422 (sometimes happens on cold starts with incomplete JSON parsing), 502, 503, 504
            if ($statusCode -in @(422, 502, 503, 504) -or $statusCode -eq 0) {
                if ($retryCount -ge $maxRetries) {
                    Write-Host ""
                    Write-Host "================================================================" -ForegroundColor Red
                    Write-Host "  [!] Upload failed after $maxRetries attempts: $errMsg" -ForegroundColor Red
                    Write-Host "================================================================" -ForegroundColor Red
                    Write-Host ""
                } else {
                    $backoff = [math]::Pow(2, $retryCount)
                    Write-Host "  [!] Temporary failure (Code $statusCode). Server may be waking up." -ForegroundColor Yellow
                    Write-Host "  Retrying in $backoff seconds (Attempt $retryCount of $maxRetries)..." -ForegroundColor Yellow
                    Start-Sleep -Seconds $backoff
                }
            } else {
                # Don't retry for 400, 401, 403, 413, etc.
                Write-Host ""
                Write-Host "================================================================" -ForegroundColor Red
                Write-Host "  [!] Upload failed: $errMsg" -ForegroundColor Red
                Write-Host "================================================================" -ForegroundColor Red
                Write-Host ""
                break
            }
        }
    }
}
