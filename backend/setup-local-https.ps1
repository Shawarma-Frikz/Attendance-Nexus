param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^(?:\d{1,3}\.){3}\d{1,3}$")]
  [string]$LanIp
)
$ErrorActionPreference = "Stop"
if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
  throw "mkcert is not on this PowerShell PATH. Run this in the terminal where mkcert works, or restart PowerShell after installing it."
}
$backend = $PSScriptRoot
$mobile = Join-Path (Split-Path $backend -Parent) "mobile"
$certDir = Join-Path $backend "certs"
$mobileCertDir = Join-Path $mobile "certs"
New-Item -ItemType Directory -Force -Path $certDir, $mobileCertDir | Out-Null
$serverCert = Join-Path $certDir "server.pem"
$serverKey = Join-Path $certDir "server-key.pem"
& mkcert -cert-file $serverCert -key-file $serverKey $LanIp localhost 127.0.0.1
if ($LASTEXITCODE -ne 0) { throw "mkcert failed to create the HTTPS server certificate." }
$caRoot = (& mkcert -CAROOT | Out-String).Trim()
$publicRoot = Join-Path $caRoot "rootCA.pem"
if (-not (Test-Path -LiteralPath $publicRoot)) { throw "Could not find rootCA.pem under $caRoot" }
Copy-Item -LiteralPath $publicRoot -Destination (Join-Path $mobileCertDir "rootCA.pem") -Force
Write-Host "Created HTTPS server certificate: $serverCert"
Write-Host "Copied only the public CA certificate to mobile\certs\rootCA.pem"
Write-Host "Private server key remains in backend\certs and is git-ignored."
Write-Host ("Next set API base to https://" + $LanIp + ":8443")
