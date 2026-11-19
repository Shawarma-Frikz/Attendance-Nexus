$ErrorActionPreference = "Stop"
$cert = Join-Path $PSScriptRoot "certs\server.pem"
$key = Join-Path $PSScriptRoot "certs\server-key.pem"
if (-not (Test-Path -LiteralPath $cert) -or -not (Test-Path -LiteralPath $key)) {
  throw "TLS files missing. First run .\setup-local-https.ps1 -LanIp <your-Wi-Fi-IPv4>."
}
$python = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $python)) {
  throw "Backend virtual environment missing. Create it and install backend requirements first."
}
& $python -m uvicorn main:app --host 0.0.0.0 --port 8443 --ssl-certfile $cert --ssl-keyfile $key --reload
