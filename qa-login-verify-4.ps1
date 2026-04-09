$ErrorActionPreference = 'Stop'
$root = 'c:\Users\Ashish Yadav\OneDrive\Desktop\amanat-app'
$backend = Join-Path $root 'digital-vault-backend'
$port = 5067
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

$userA = '9876543292'
$userB = '9876543293'
$pin = '1234'
$result = [ordered]@{}

# A1 send OTP normal user
$server = Start-TestServer 'qa-v2-step1-stdout.log' 'qa-v2-step1-stderr.log'
try { $null = Invoke-JsonPost "$base/auth/send-otp" @{ mobile = $userA } } finally { Stop-TestServer $server.proc }
$step1Log = Read-LogText $server.stdout
$otpA = Get-OtpFromLog $server.stdout $userA

# A2 verify + set pin + login
$server = Start-TestServer 'qa-v2-step2-stdout.log' 'qa-v2-step2-stderr.log'
try {
  $verifyA = Invoke-JsonPost "$base/auth/verify-otp" @{ mobile = $userA; otp = $otpA }
  if (-not $verifyA.hasPin) {
    $setPinHeaders = @{ 'X-OTP-Verified-Token' = $verifyA.otp_verified_token }
    $null = Invoke-JsonPost "$base/auth/set-pin" @{ mobile = $userA; pin = $pin } $setPinHeaders
  }
  $loginA = Invoke-JsonPost "$base/auth/login" @{ mobile = $userA; pin = $pin }
  $result.caseAResponse = [ordered]@{ loginSuccess = [bool]$loginA.token; roles = $loginA.roles }
}
finally { Stop-TestServer $server.proc }
$step2Log = Read-LogText $server.stdout
$result.caseA = [ordered]@{
  endpoints = @('/auth/send-otp','/auth/verify-otp','/auth/login')
  authHits = ([regex]::Matches($step2Log, 'AUTH LOGIN HIT')).Count
  nomineeHits = ([regex]::Matches($step2Log, 'NOMINEE LOGIN HIT')).Count
  hasLoginUserLog = $step2Log -match 'LOGIN USER:'
  hasRolesLog = $step2Log -match 'ROLES:'
}

# B1 send OTP for nominee-role candidate
$server = Start-TestServer 'qa-v2-step3-stdout.log' 'qa-v2-step3-stderr.log'
try { $null = Invoke-JsonPost "$base/auth/send-otp" @{ mobile = $userB } } finally { Stop-TestServer $server.proc }
$otpB = Get-OtpFromLog $server.stdout $userB

# B2 verify + set pin + create nominee link and send nominee verification OTP
$server = Start-TestServer 'qa-v2-step4-stdout.log' 'qa-v2-step4-stderr.log'
try {
  $verifyB = Invoke-JsonPost "$base/auth/verify-otp" @{ mobile = $userB; otp = $otpB }
  if (-not $verifyB.hasPin) {
    $setPinHeadersB = @{ 'X-OTP-Verified-Token' = $verifyB.otp_verified_token }
    $null = Invoke-JsonPost "$base/auth/set-pin" @{ mobile = $userB; pin = $pin } $setPinHeadersB
  }
  $loginA2 = Invoke-JsonPost "$base/auth/login" @{ mobile = $userA; pin = $pin }
  $authHeadersA = @{ Authorization = "Bearer $($loginA2.token)" }
  $nomineeCreate = Invoke-RestMethod -Uri "$base/api/nominees" -Method Post -ContentType 'application/json' -Body (@{ name = 'QA Nominee'; phone = $userB; relationship = 'friend' } | ConvertTo-Json -Compress) -Headers $authHeadersA
  $nomineeId = $nomineeCreate.nominee.id
  $null = Invoke-RestMethod -Uri "$base/api/nominees/send-verification" -Method Post -ContentType 'application/json' -Body (@{ nominee_id = $nomineeId } | ConvertTo-Json -Compress) -Headers $authHeadersA
  $result.nomineeSetup = [ordered]@{ nomineeId = $nomineeId }
}
finally { Stop-TestServer $server.proc }
$nomineeOtp = Get-OtpFromLog $server.stdout $userB

# B3 approve nominee
$server = Start-TestServer 'qa-v2-step5-stdout.log' 'qa-v2-step5-stderr.log'
try {
  $loginA3 = Invoke-JsonPost "$base/auth/login" @{ mobile = $userA; pin = $pin }
  $authHeadersA2 = @{ Authorization = "Bearer $($loginA3.token)" }
  $nomineeVerify = Invoke-RestMethod -Uri "$base/api/nominees/verify" -Method Post -ContentType 'application/json' -Body (@{ nominee_id = $result.nomineeSetup.nomineeId; otp = $nomineeOtp } | ConvertTo-Json -Compress) -Headers $authHeadersA2
  $result.nomineeSetup.verificationStatus = $nomineeVerify.verification.status
}
finally { Stop-TestServer $server.proc }

# B4 clean auth login for nominee-role user on fresh server
$server = Start-TestServer 'qa-v2-step6-stdout.log' 'qa-v2-step6-stderr.log'
try {
  $loginB = Invoke-JsonPost "$base/auth/login" @{ mobile = $userB; pin = $pin }
  $result.caseBResponse = [ordered]@{ loginSuccess = [bool]$loginB.token; roles = $loginB.roles }
}
finally { Stop-TestServer $server.proc }
$step6Log = Read-LogText $server.stdout
$result.caseB = [ordered]@{
  endpoints = @('/auth/login')
  authHits = ([regex]::Matches($step6Log, 'AUTH LOGIN HIT')).Count
  nomineeHits = ([regex]::Matches($step6Log, 'NOMINEE LOGIN HIT')).Count
  hasLoginUserLog = $step6Log -match 'LOGIN USER:'
  hasRolesLog = $step6Log -match 'ROLES:'
}

$result | ConvertTo-Json -Depth 6
