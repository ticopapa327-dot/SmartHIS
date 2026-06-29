# Temporary route fix for accessing 192.168.1.60 through OpenVPN.
#
# Usage, run PowerShell as Administrator from the SmartHIS repo:
#   powershell -ExecutionPolicy Bypass -File ".\scripts\fix-openvpn-route-to-60.ps1"
#
# Remove the temporary route:
#   powershell -ExecutionPolicy Bypass -File ".\scripts\fix-openvpn-route-to-60.ps1" -Remove
#
# Diagnose only, no route changes:
#   powershell -ExecutionPolicy Bypass -File ".\scripts\fix-openvpn-route-to-60.ps1" -DiagnoseOnly

[CmdletBinding()]
param(
    [string]$Target = "192.168.1.60",
    [string]$VpnGateway = "10.8.0.1",
    [int[]]$Ports = @(22, 7070),
    [switch]$RouteSubnet,
    [switch]$Remove,
    [switch]$DiagnoseOnly
)

$ErrorActionPreference = "Stop"

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-VpnInterface {
    $vpnCandidates = Get-NetIPConfiguration |
        Where-Object {
            $_.NetAdapter.Status -eq "Up" -and
            $_.IPv4Address -and
            (
                $_.IPv4Address.IPAddress -like "10.8.0.*" -or
                $_.InterfaceAlias -match "OpenVPN|TAP|TUN|Wintun|VPN" -or
                $_.InterfaceDescription -match "OpenVPN|TAP|TUN|Wintun|VPN"
            )
        } |
        Sort-Object @{
            Expression = {
                if ($_.IPv4Address.IPAddress -like "10.8.0.*") { 0 } else { 1 }
            }
        }, InterfaceIndex

    return $vpnCandidates | Select-Object -First 1
}

function Test-PortQuick {
    param(
        [string]$ComputerName,
        [int]$Port,
        [int]$TimeoutMs = 2000
    )

    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $asyncResult = $client.BeginConnect($ComputerName, $Port, $null, $null)
        $connected = $asyncResult.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
        if (-not $connected) {
            return $false
        }
        $client.EndConnect($asyncResult)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Show-Diagnostics {
    param(
        [string]$DestinationPrefix,
        [object]$VpnInterface
    )

    Write-Host "====== Network diagnostics ======"
    Write-Host "Target: $Target"
    Write-Host "Route prefix: $DestinationPrefix"
    Write-Host "OpenVPN gateway: $VpnGateway"
    Write-Host ""

    if ($VpnInterface) {
        Write-Host "Detected VPN interface:"
        Write-Host "  Alias: $($VpnInterface.InterfaceAlias)"
        Write-Host "  Index: $($VpnInterface.InterfaceIndex)"
        Write-Host "  Address: $($VpnInterface.IPv4Address.IPAddress)"
        Write-Host "  Description: $($VpnInterface.InterfaceDescription)"
    } else {
        Write-Host "No active OpenVPN/TAP/TUN interface detected."
    }

    Write-Host ""
    Write-Host "Related routes:"
    Get-NetRoute -AddressFamily IPv4 |
        Where-Object {
            $_.DestinationPrefix -eq $DestinationPrefix -or
            $_.DestinationPrefix -eq "192.168.1.0/24" -or
            $_.DestinationPrefix -eq "0.0.0.0/0"
        } |
        Sort-Object DestinationPrefix, RouteMetric, InterfaceMetric |
        Format-Table DestinationPrefix, NextHop, InterfaceIndex, RouteMetric, InterfaceMetric, PolicyStore -AutoSize

    Write-Host ""
    $selectedRoute = Find-NetRoute -RemoteIPAddress $Target -ErrorAction SilentlyContinue
    if ($selectedRoute) {
        Write-Host "Selected route for target:"
        $selectedRoute | Format-Table DestinationPrefix, NextHop, InterfaceIndex, RouteMetric, InterfaceMetric -AutoSize
    }

    Write-Host ""
    foreach ($port in $Ports) {
        Write-Host "Testing ${Target}:$port ..."
        if (Test-PortQuick -ComputerName $Target -Port $port) {
            Write-Host "  Result: reachable"
        } else {
            Write-Host "  Result: unreachable"
        }
    }
}

$prefix = if ($RouteSubnet) { "192.168.1.0/24" } else { "$Target/32" }
$vpnInterface = Get-VpnInterface

Show-Diagnostics -DestinationPrefix $prefix -VpnInterface $vpnInterface

if ($DiagnoseOnly) {
    Write-Host ""
    Write-Host "DiagnoseOnly mode: no route changes were made."
    exit 0
}

if (-not (Test-IsAdmin)) {
    Write-Host ""
    Write-Host "Administrator privileges are required to add or remove routes."
    Write-Host "Open PowerShell as Administrator and run this script again."
    exit 1
}

if (-not $vpnInterface) {
    Write-Host ""
    Write-Host "No usable OpenVPN interface was found. Connect OpenVPN first."
    exit 1
}

Write-Host ""
Write-Host "====== Route changes ======"

$existingRoutes = Get-NetRoute -DestinationPrefix $prefix -ErrorAction SilentlyContinue
foreach ($route in $existingRoutes) {
    Write-Host "Removing existing route: $($route.DestinationPrefix), next hop $($route.NextHop), interface $($route.InterfaceIndex)"
    Remove-NetRoute `
        -DestinationPrefix $route.DestinationPrefix `
        -InterfaceIndex $route.InterfaceIndex `
        -NextHop $route.NextHop `
        -Confirm:$false `
        -ErrorAction SilentlyContinue
}

if ($Remove) {
    Write-Host "Temporary route removed for $prefix."
    exit 0
}

if ($RouteSubnet) {
    Write-Host "Warning: adding a route for the entire 192.168.1.0/24 subnet."
    Write-Host "If your local network also uses 192.168.1.0/24, local devices may become unreachable."
}

Write-Host "Adding temporary route: $prefix -> $VpnGateway, interface index $($vpnInterface.InterfaceIndex)"
New-NetRoute `
    -DestinationPrefix $prefix `
    -InterfaceIndex $vpnInterface.InterfaceIndex `
    -NextHop $VpnGateway `
    -RouteMetric 1 `
    -PolicyStore ActiveStore | Out-Null

Write-Host ""
Write-Host "====== Verification after change ======"
Show-Diagnostics -DestinationPrefix $prefix -VpnInterface $vpnInterface

Write-Host ""
Write-Host "Done. This route is temporary and may disappear after reboot or VPN reconnect."
