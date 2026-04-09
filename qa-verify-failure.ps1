$ErrorActionPreference = 'Stop'
$backend = 'c:\Users\Ashish Yadav\OneDrive\Desktop\amanat-app\digital-vault-backend'
$port = 5068
$base = "http://127.0.0.1:$port"
$phone = '9876543294'

function Start-TestServer($stdoutName, $stderrName) {
  $stdout = Join-Path $backend $stdoutName
  $stderr = Join-Path $backend $stderrName
  if (Test-Path $stdout) { Remove-Item -LiteralPath $stdout -Force }
  if (Test-Path $stderr) { Remove-Item -LiteralPath $stderr -Force }
  $proc = Start-Process powershell -ArgumentList '-NoProfile','-Command',"`$env:PORT='$port'; node server.js" -WorkingDirectory $backend -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 5
  return @{ proc = $proc; stdout = $stdout; stderr = $stderr }
}
function Stop-TestServer($proc) { if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force; Start-Sleep -Seconds 2 } }
function Read-LogText($path) { if (Test-Path $path) { return [string](Get-Content -LiteralPath $path -Raw) }; return '' }
function Get-OtpFromLog($logPath, $mobile) {
  $text = Read-LogText $logPath
  $m = [regex]::Matches($text, "mobile:\s*'$mobile'[\s\S]{0,220}?otp:\s*'(\d{6})'")
  if ($m.Count -eq 0) { throw "OTP missing" }
  return $m[$m.Count-1].Groups[1].Value
}
$server = Start-TestServer 'qa-verifyfail-step1.log' 'qa-verifyfail-step1.err'
try { Invoke-RestMethod -Uri "$base/auth/send-otp" -Method Post -ContentType 'application/json' -Body (@{ mobile = $phone } | ConvertTo-Json -Compress) | Out-Null } finally { Stop-TestServer $server.proc }
$otp = Get-OtpFromLog $server.stdout $phone
$server = Start-TestServer 'qa-verifyfail-step2.log' 'qa-verifyfail-step2.err'
try {
  try {
    $resp = Invoke-RestMethod -Uri "$base/auth/verify-otp" -Method Post -ContentType 'application/json' -Body (@{ mobile = $phone; otp = $otp } | ConvertTo-Json -Compress)
    [pscustomobject]@{ success = $true; response = $resp; log = (Read-LogText $server.stdout) } | ConvertTo-Json -Depth 5
  } catch {
    $body = $_.ErrorDetails.Message
    [pscustomobject]@{ success = $false; error = $body; log = (Read-LogText $server.stdout) } | ConvertTo-Json -Depth 5
  }
}
finally { Stop-TestServer $server.proc }
