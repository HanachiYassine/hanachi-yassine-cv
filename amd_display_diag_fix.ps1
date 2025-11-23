# amd_display_diag_fix4.ps1 — exécuter en admin
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$log="$env:USERPROFILE\Desktop\amd_display_diag_$(Get-Date -Format yyyyMMdd_HHmmss).txt"
Start-Transcript -Path $log -Force
Write-Host "Log: $log"
function Decode([uint16[]]$a){if(-not $a){return ''};[Text.Encoding]::ASCII.GetString(($a|Where-Object {$_ -ne 0}))}
$displayGuid='{4d36e968-e325-11ce-bfc1-08002be10318}'

Write-Host "== GPU =="
Get-CimInstance Win32_VideoController | Where-Object {$_.Name -match 'AMD'} |
 Select-Object Name,DriverVersion,DriverDate,AdapterRAM,PNPDeviceID | Format-List

Write-Host "== Driver (PnP Signed) =="
Get-CimInstance Win32_PnPSignedDriver |
 Where-Object { $_.ClassGuid -eq $displayGuid -and $_.Manufacturer -match 'AMD|Advanced Micro Devices' } |
 Select-Object DeviceName,DriverVersion,DriverDate,InfName | Format-List

Write-Host "== Moniteurs PnP =="
Get-CimInstance Win32_PnPEntity | Where-Object {$_.PNPClass -eq 'Monitor'} |
 Select-Object Name,Status,PNPDeviceID | Format-Table -Auto

Write-Host "== Moniteurs (WMI) =="
$mon = Get-CimInstance -Namespace root\wmi -Class WmiMonitorID -ErrorAction SilentlyContinue
$mon | ForEach-Object {
  [pscustomobject]@{Active=$_.Active;Instance=$_.InstanceName;Name=(Decode $_.UserFriendlyName);Serial=(Decode $_.SerialNumberID)}
} | Format-Table -Auto

Write-Host "== Connexions =="
Get-CimInstance -Namespace root\wmi -Class WmiMonitorConnectionParams -ErrorAction SilentlyContinue |
 Select-Object InstanceName,VideoOutputTechnology | Format-Table -Auto

Write-Host "== EDID =="
Get-CimInstance -Namespace root\wmi -Class WmiMonitorBasicDisplayParams -ErrorAction SilentlyContinue |
 Select-Object InstanceName,MaxHorizontalImageSize,MaxVerticalImageSize,SupportedDisplayTimings | Format-List

Write-Host "== Événements (7j) =="
$since=(Get-Date).AddDays(-7)
Get-WinEvent -LogName System -ErrorAction SilentlyContinue |
 Where-Object { $_.TimeCreated -ge $since -and $_.ProviderName -in @('Display','amdwddmg','amdkmdag') } |
 Select-Object TimeCreated,Id,ProviderName,Message | Select-Object -First 200 | Format-List

Write-Host "== Synthèse =="
$activeCount = if ($mon) { @(($mon | Where-Object { $_.Active })).Count } else { 0 }
Write-Host "Moniteurs actifs (WMI): $activeCount"
Stop-Transcript
Write-Host "Rapport: $log"
