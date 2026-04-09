$ErrorActionPreference = 'Stop'
$backend = 'c:\Users\Ashish Yadav\OneDrive\Desktop\amanat-app\digital-vault-backend'
$port = 5071
$base = "http://127.0.0.1:$port"
$userA = '9876543297'
$userB = '9876543298'
$pin = '1234'

function Start-TestServer($stdoutName, $stderrName) {
  $stdout = Join-Path $backend $stdoutName
  $stderr = Join-Path $backend $stderrName
  if (Test-Path $stdout) { Remove-Item -LiteralPath $stdout -Force }
  if (Test-Path $stderr) { Remove-Item -LiteralPath $stderr -Force }
  $proc = Start-Process cmd -ArgumentList '/c',"set PORT=$port&& node server.js" -WorkingDirectory $backend -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 5
  return @{ proc = $proc; stdout = $stdout; stderr = $stderr }
}

function Stop-TestServer($proc) {
  if ($proc -and -not $proc.HasExited) {
    Start-Sleep -Seconds 2
    Stop-Process -Id $proc.Id -Force
    Start-Sleep -Seconds 2
  }
}

function Read-LogText($path) {
  if (Test-Path $path) { return [string](Get-Content -LiteralPath $path -Raw) }
  return ''
}

function Get-OtpFromLog($logPath, $mobile) {
  $text = Read-LogText $logPath
  $m = [regex]::Matches($text, "mobile:\s*'$mobile'[\s\S]{0,220}?otp:\s*'(\d{6})'")
  if ($m.Count -eq 0) { throw "OTP missing for $mobile`n$text" }
  return $m[$m.Count-1].Groups[1].Value
}

function Invoke-JsonPost($url, $body, $headers = @{}) {
  return Invoke-RestMethod -Uri $url -Method Post -ContentType 'application/json' -Body ($body | ConvertTo-Json -Compress) -Headers $headers
}

function Collect-LogSummary($text) {
  return [ordered]@{
    authHits = ([regex]::Matches($text, 'AUTH LOGIN HIT')).Count
    nomineeHits = ([regex]::Matches($text, 'NOMINEE LOGIN HIT')).Count
    hasDevOtp = ($text -match 'DEV OTP:')
    hasLoginUser = ($text -match 'LOGIN USER:')
    hasRoles = ($text -match 'ROLES:')
    hasSqlError = ($text -match 'column .* does not exist' -or $text -match 'SQL' -or $text -match 'Migration failed')
  }
}

$result = [ordered]@{}

# Normal user: send OTP
$s1 = Start-TestServer 'qa-final-step1.out' 'qa-final-step1.err'
try {
  $sendA = Invoke-JsonPost "$base/auth/send-otp" @{ mobile = $userA }
  $result.normalSendOtp = [ordered]@{ success = $sendA.success; message = $sendA.message }
}
finally { Stop-TestServer $s1.proc }
$log1 = Read-LogText $s1.stdout
$otpA = Get-OtpFromLog $s1.stdout $userA
$result.normalSendOtpLogs = Collect-LogSummary $log1

# Normal user: verify OTP + set pin + login + logout + login again
$s2 = Start-TestServer 'qa-final-step2.out' 'qa-final-step2.err'
try {
  $verifyA = Invoke-JsonPost "$base/auth/verify-otp" @{ mobile = $userA; otp = $otpA }
  if (-not $verifyA.hasPin) {
    $headersPinA = @{ 'X-OTP-Verified-Token' = $verifyA.otp_verified_token }
    $null = Invoke-JsonPost "$base/auth/set-pin" @{ mobile = $userA; pin = $pin } $headersPinA
  }
  $loginA = Invoke-JsonPost "$base/auth/login" @{ mobile = $userA; pin = $pin }
  $logoutA = Invoke-JsonPost "$base/auth/logout" @{ refreshToken = $loginA.refreshToken }
  $loginA2 = Invoke-JsonPost "$base/auth/login" @{ mobile = $userA; pin = $pin }
  $result.normalUser = [ordered]@{
    verifySuccess = $verifyA.success
    firstLoginSuccess = [bool]$loginA.token
    secondLoginSuccess = [bool]$loginA2.token
    logoutSuccess = $logoutA.success
    roles = $loginA.roles
  }
}
finally { Stop-TestServer $s2.proc }
$log2 = Read-LogText $s2.stdout
$result.normalUserLogs = Collect-LogSummary $log2
$result.normalUserErrors = Read-LogText $s2.stderr

# Multi-role setup: send OTP for userB
$s3 = Start-TestServer 'qa-final-step3.out' 'qa-final-step3.err'
try {
  $sendB = Invoke-JsonPost "$base/auth/send-otp" @{ mobile = $userB }
  $result.multiSendOtp = [ordered]@{ success = $sendB.success; message = $sendB.message }
}
finally { Stop-TestServer $s3.proc }
$log3 = Read-LogText $s3.stdout
$otpB = Get-OtpFromLog $s3.stdout $userB
$result.multiSendOtpLogs = Collect-LogSummary $log3

# Multi-role setup: verify B, set pin, owner login, create nominee, send nominee verification
$s4 = Start-TestServer 'qa-final-step4.out' 'qa-final-step4.err'
try {
  $verifyB = Invoke-JsonPost "$base/auth/verify-otp" @{ mobile = $userB; otp = $otpB }
  if (-not $verifyB.hasPin) {
    $headersPinB = @{ 'X-OTP-Verified-Token' = $verifyB.otp_verified_token }
    $null = Invoke-JsonPost "$base/auth/set-pin" @{ mobile = $userB; pin = $pin } $headersPinB
  }
  $loginOwner = Invoke-JsonPost "$base/auth/login" @{ mobile = $userA; pin = $pin }
  $authHeadersA = @{ Authorization = "Bearer $($loginOwner.token)" }
  $nomineeCreate = Invoke-RestMethod -Uri "$base/api/nominees" -Method Post -ContentType 'application/json' -Body (@{ name = 'QA Nominee'; phone = $userB; relationship = 'friend' } | ConvertTo-Json -Compress) -Headers $authHeadersA
  $nomineeId = $nomineeCreate.nominee.id
  $null = Invoke-RestMethod -Uri "$base/api/nominees/send-verification" -Method Post -ContentType 'application/json' -Body (@{ nominee_id = $nomineeId } | ConvertTo-Json -Compress) -Headers $authHeadersA
  $result.multiSetup = [ordered]@{ nomineeId = $nomineeId; verifySuccess = $verifyB.success }
}
finally { Stop-TestServer $s4.proc }
$log4 = Read-LogText $s4.stdout
$nomineeOtp = Get-OtpFromLog $s4.stdout $userB
$result.multiSetupLogs = Collect-LogSummary $log4
$result.multiSetupErrors = Read-LogText $s4.stderr

# Multi-role finish: approve nominee, login B normally
$s5 = Start-TestServer 'qa-final-step5.out' 'qa-final-step5.err'
try {
  $loginOwner2 = Invoke-JsonPost "$base/auth/login" @{ mobile = $userA; pin = $pin }
  $authHeadersA2 = @{ Authorization = "Bearer $($loginOwner2.token)" }
  $nomineeVerify = Invoke-RestMethod -Uri "$base/api/nominees/verify" -Method Post -ContentType 'application/json' -Body (@{ nominee_id = $result.multiSetup.nomineeId; otp = $nomineeOtp } | ConvertTo-Json -Compress) -Headers $authHeadersA2
  $loginB = Invoke-JsonPost "$base/auth/login" @{ mobile = $userB; pin = $pin }
  $result.multiRoleUser = [ordered]@{
    nomineeApprovalStatus = $nomineeVerify.verification.status
    loginSuccess = [bool]$loginB.token
    roles = $loginB.roles
  }
}
finally { Stop-TestServer $s5.proc }
$log5 = Read-LogText $s5.stdout
$result.multiRoleUserLogs = Collect-LogSummary $log5
$result.multiRoleUserErrors = Read-LogText $s5.stderr

$result | ConvertTo-Json -Depth 7
