$ErrorActionPreference = 'Stop'
$backend = 'c:\Users\Ashish Yadav\OneDrive\Desktop\amanat-app\digital-vault-backend'
$port = 5073
$base = "http://127.0.0.1:$port"
$owner = '9876543297'
$nominee = '9876543300'
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
function Stop-TestServer($proc) { if ($proc -and -not $proc.HasExited) { Start-Sleep -Seconds 2; Stop-Process -Id $proc.Id -Force; Start-Sleep -Seconds 2 } }
function Read-LogText($path) { if (Test-Path $path) { return [string](Get-Content -LiteralPath $path -Raw) }; return '' }
function Get-OtpFromLog($logPath, $mobile) { $text = Read-LogText $logPath; $m = [regex]::Matches($text, "mobile:\s*'$mobile'[\s\S]{0,220}?otp:\s*'(\d{6})'"); if ($m.Count -eq 0) { throw "OTP missing for $mobile`n$text" }; return $m[$m.Count-1].Groups[1].Value }
function PostJson($url, $body, $headers=@{}) { Invoke-RestMethod -Uri $url -Method Post -ContentType 'application/json' -Body ($body | ConvertTo-Json -Compress) -Headers $headers }

$result = [ordered]@{}

# nominee account create via auth
$s1 = Start-TestServer 'qa-multi-s1.out' 'qa-multi-s1.err'
try { $null = PostJson "$base/auth/send-otp" @{ mobile = $nominee } } finally { Stop-TestServer $s1.proc }
$otp1 = Get-OtpFromLog $s1.stdout $nominee
$result.sendOtpLog = (Read-LogText $s1.stdout)

$s2 = Start-TestServer 'qa-multi-s2.out' 'qa-multi-s2.err'
try {
  $verify = PostJson "$base/auth/verify-otp" @{ mobile = $nominee; otp = $otp1 }
  if (-not $verify.hasPin) {
    $headersPin = @{ 'X-OTP-Verified-Token' = $verify.otp_verified_token }
    $null = PostJson "$base/auth/set-pin" @{ mobile = $nominee; pin = $pin } $headersPin
  }
  $result.nomineeAccountVerify = $verify.success
}
finally { Stop-TestServer $s2.proc }

# owner creates nominee link and sends nominee OTP
$s3 = Start-TestServer 'qa-multi-s3.out' 'qa-multi-s3.err'
try {
  $loginOwner = PostJson "$base/auth/login" @{ mobile = $owner; pin = $pin }
  $authHeaders = @{ Authorization = "Bearer $($loginOwner.token)" }
  $nomineeCreate = Invoke-RestMethod -Uri "$base/api/nominees" -Method Post -ContentType 'application/json' -Body (@{ name = 'Multi Role Nominee'; phone = $nominee; relationship = 'friend' } | ConvertTo-Json -Compress) -Headers $authHeaders
  $nomineeId = $nomineeCreate.nominee.id
  $null = Invoke-RestMethod -Uri "$base/api/nominees/send-verification" -Method Post -ContentType 'application/json' -Body (@{ nominee_id = $nomineeId } | ConvertTo-Json -Compress) -Headers $authHeaders
  $result.nomineeId = $nomineeId
}
finally { Stop-TestServer $s3.proc }
$otp2 = Get-OtpFromLog $s3.stdout $nominee
$result.nomineeSendVerificationLog = (Read-LogText $s3.stdout)

# owner verifies nominee link, then nominee uses normal auth/login
$s4 = Start-TestServer 'qa-multi-s4.out' 'qa-multi-s4.err'
try {
  $loginOwner2 = PostJson "$base/auth/login" @{ mobile = $owner; pin = $pin }
  $authHeaders2 = @{ Authorization = "Bearer $($loginOwner2.token)" }
  $verifyNominee = Invoke-RestMethod -Uri "$base/api/nominees/verify" -Method Post -ContentType 'application/json' -Body (@{ nominee_id = $result.nomineeId; otp = $otp2 } | ConvertTo-Json -Compress) -Headers $authHeaders2
  $loginNominee = PostJson "$base/auth/login" @{ mobile = $nominee; pin = $pin }
  $result.nomineeVerificationStatus = $verifyNominee.verification.status
  $result.normalLoginRoles = $loginNominee.roles
}
finally { Stop-TestServer $s4.proc }
$log4 = Read-LogText $s4.stdout
$result.authHits = ([regex]::Matches($log4, 'AUTH LOGIN HIT')).Count
$result.nomineeHits = ([regex]::Matches($log4, 'NOMINEE LOGIN HIT')).Count
$result.hasLoginUserLog = ($log4 -match 'LOGIN USER:')
$result.hasRolesLog = ($log4 -match 'ROLES:')
$result.stderr = Read-LogText $s4.stderr

$result | ConvertTo-Json -Depth 6
