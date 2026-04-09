$ErrorActionPreference = 'Stop'
$root = 'c:\Users\Ashish Yadav\OneDrive\Desktop\amanat-app'
$backend = Join-Path $root 'digital-vault-backend'

function Start-TestServer($stdoutName, $stderrName) {
  $stdout = Join-Path $backend $stdoutName
  $stderr = Join-Path $backend $stderrName
  if (Test-Path $stdout) { Remove-Item -LiteralPath $stdout -Force }
  if (Test-Path $stderr) { Remove-Item -LiteralPath $stderr -Force }
  $proc = Start-Process node -ArgumentList 'server.js' -WorkingDirectory $backend -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 4
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

function Wait-ForOtp($logPath, $mobile, $proc, $timeoutSeconds = 25) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if ($proc.HasExited) {
      $text = Read-LogText $logPath
      $pattern = "mobile:\s*'$mobile'[\s\S]{0,160}?otp:\s*'(\d{6})'"
      $match = [regex]::Matches($text, $pattern)
      if ($match.Count -gt 0) { return $match[$match.Count - 1].Groups[1].Value }
    } else {
      $text = Read-LogText $logPath
      $pattern = "mobile:\s*'$mobile'[\s\S]{0,160}?otp:\s*'(\d{6})'"
      $match = [regex]::Matches($text, $pattern)
      if ($match.Count -gt 0) { return $match[$match.Count - 1].Groups[1].Value }
    }
    Start-Sleep -Milliseconds 700
  }
  throw "OTP for $mobile not found in $logPath"
}

$base = 'http://127.0.0.1:5050'
$userA = '9876543280'
$userB = '9876543281'
$pin = '1234'
$result = [ordered]@{}

$serverA = Start-TestServer 'qa-case-a-stdout.log' 'qa-case-a-stderr.log'
try {
  $null = Invoke-JsonPost "$base/auth/send-otp" @{ mobile = $userA }
  Start-Sleep -Seconds 2
  $otpA = Wait-ForOtp $serverA.stdout $userA $serverA.proc
  $verifyA = Invoke-JsonPost "$base/auth/verify-otp" @{ mobile = $userA; otp = $otpA }
  if (-not $verifyA.hasPin) {
    $setPinHeaders = @{ 'X-OTP-Verified-Token' = $verifyA.otp_verified_token }
    $null = Invoke-JsonPost "$base/auth/set-pin" @{ mobile = $userA; pin = $pin } $setPinHeaders
  }
  $loginA = Invoke-JsonPost "$base/auth/login" @{ mobile = $userA; pin = $pin }

  $null = Invoke-JsonPost "$base/auth/send-otp" @{ mobile = $userB }
  Start-Sleep -Seconds 2
  $otpB = Wait-ForOtp $serverA.stdout $userB $serverA.proc
  $verifyB = Invoke-JsonPost "$base/auth/verify-otp" @{ mobile = $userB; otp = $otpB }
  if (-not $verifyB.hasPin) {
    $setPinHeadersB = @{ 'X-OTP-Verified-Token' = $verifyB.otp_verified_token }
    $null = Invoke-JsonPost "$base/auth/set-pin" @{ mobile = $userB; pin = $pin } $setPinHeadersB
  }

  $authHeadersA = @{ Authorization = "Bearer $($loginA.token)" }
  $nomineeCreate = Invoke-RestMethod -Uri "$base/api/nominees" -Method Post -ContentType 'application/json' -Body (@{ name = 'QA Nominee'; phone = $userB; relationship = 'friend' } | ConvertTo-Json -Compress) -Headers $authHeadersA
  $nomineeId = $nomineeCreate.nominee.id
  $null = Invoke-RestMethod -Uri "$base/api/nominees/send-verification" -Method Post -ContentType 'application/json' -Body (@{ nominee_id = $nomineeId } | ConvertTo-Json -Compress) -Headers $authHeadersA
  Start-Sleep -Seconds 2
  $nomineeOtp = Wait-ForOtp $serverA.stdout $userB $serverA.proc
  $nomineeVerify = Invoke-RestMethod -Uri "$base/api/nominees/verify" -Method Post -ContentType 'application/json' -Body (@{ nominee_id = $nomineeId; otp = $nomineeOtp } | ConvertTo-Json -Compress) -Headers $authHeadersA

  $result.caseAResponse = [ordered]@{ loginSuccess = [bool]$loginA.token; roles = $loginA.roles }
  $result.nomineeSetup = [ordered]@{ nomineeId = $nomineeId; verificationStatus = $nomineeVerify.verification.status }
}
finally {
  Stop-TestServer $serverA.proc
}
$logA = Read-LogText $serverA.stdout
$result.caseA = [ordered]@{
  authHits = ([regex]::Matches($logA, 'AUTH LOGIN HIT')).Count
  nomineeHits = ([regex]::Matches($logA, 'NOMINEE LOGIN HIT')).Count
  hasLoginUserLog = $logA -match 'LOGIN USER:'
  hasRolesLog = $logA -match 'ROLES:'
}

$serverB = Start-TestServer 'qa-case-b-stdout.log' 'qa-case-b-stderr.log'
try {
  $loginB = Invoke-JsonPost "$base/auth/login" @{ mobile = $userB; pin = $pin }
  $result.caseBResponse = [ordered]@{ loginSuccess = [bool]$loginB.token; roles = $loginB.roles }
}
finally {
  Stop-TestServer $serverB.proc
}
$logB = Read-LogText $serverB.stdout
$result.caseB = [ordered]@{
  authHits = ([regex]::Matches($logB, 'AUTH LOGIN HIT')).Count
  nomineeHits = ([regex]::Matches($logB, 'NOMINEE LOGIN HIT')).Count
  hasLoginUserLog = $logB -match 'LOGIN USER:'
  hasRolesLog = $logB -match 'ROLES:'
}

$result | ConvertTo-Json -Depth 6
