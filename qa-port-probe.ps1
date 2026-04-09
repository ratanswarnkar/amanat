$ErrorActionPreference = 'Stop'
$root = 'c:\Users\Ashish Yadav\OneDrive\Desktop\amanat-app'
$backend = Join-Path $root 'digital-vault-backend'
$port = 5066
$base = "http://127.0.0.1:$port"

function Start-TestServer($stdoutName, $stderrName) {
  $stdout = Join-Path $backend $stdoutName
  $stderr = Join-Path $backend $stderrName
  if (Test-Path $stdout) { Remove-Item -LiteralPath $stdout -Force }
  if (Test-Path $stderr) { Remove-Item -LiteralPath $stderr -Force }
  $proc = Start-Process powershell -ArgumentList '-NoProfile','-Command',"`$env:PORT='$port'; node server.js" -WorkingDirectory $backend -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 5
  return @{ proc = $proc; stdout = $stdout; stderr = $stderr }
}

function Stop-TestServer($proc) {
  if ($proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
    Start-Sleep -Seconds 2
  }
}

function Invoke-JsonPost($url, $body, $headers = @{}) {
  return Invoke-RestMethod -Uri $url -Method Post -ContentType 'application/json' -Body ($body | ConvertTo-Json -Compress) -Headers $headers
}

function Read-LogText($path) {
  if (Test-Path $path) { return [string](Get-Content -LiteralPath $path -Raw) }
  return ''
}

function Get-OtpFromLog($logPath, $mobile) {
  $text = Read-LogText $logPath
  $pattern = "mobile:\s*'$mobile'[\s\S]{0,220}?otp:\s*'(\d{6})'"
  $match = [regex]::Matches($text, $pattern)
  if ($match.Count -eq 0) {
    throw "OTP for $mobile not found in $logPath. Log contents:`n$text"
  }
  return $match[$match.Count - 1].Groups[1].Value
}

$userA = '9876543280'
$userB = '9876543281'
$pin = '1234'
$result = [ordered]@{}

$server = Start-TestServer 'qa-port-step1-stdout.log' 'qa-port-step1-stderr.log'
try {
  $send = Invoke-JsonPost "$base/auth/send-otp" @{ mobile = $userA }
  $result.probe = $send
}
finally {
  Stop-TestServer $server.proc
}
$result.probeLog = Read-LogText $server.stdout
$result | ConvertTo-Json -Depth 5
