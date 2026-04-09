$ErrorActionPreference = 'Stop'
$backend = 'c:\Users\Ashish Yadav\OneDrive\Desktop\amanat-app\digital-vault-backend'
$port = 5070
$base = "http://127.0.0.1:$port"
$phone = '9876543296'
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
function Stop-TestServer($proc) { if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force; Start-Sleep -Seconds 2 } }
function Read-LogText($path) { if (Test-Path $path) { return [string](Get-Content -LiteralPath $path -Raw) }; return '' }
function Get-OtpFromLog($logPath, $mobile) {
  $text = Read-LogText $logPath
  $m = [regex]::Matches($text, "mobile:\s*'$mobile'[\s\S]{0,220}?otp:\s*'(\d{6})'")
  if ($m.Count -eq 0) { throw "OTP missing for $mobile`n$text" }
  return $m[$m.Count-1].Groups[1].Value
}
function Invoke-JsonPost($url, $body, $headers = @{}) {
  return Invoke-RestMethod -Uri $url -Method Post -ContentType 'application/json' -Body ($body | ConvertTo-Json -Compress) -Headers $headers
}

$server = Start-TestServer 'qa-final-auth-stdout.log' 'qa-final-auth-stderr.log'
try {
  $send = Invoke-JsonPost "$base/auth/send-otp" @{ mobile = $phone }
}
finally { Stop-TestServer $server.proc }
$otp = Get-OtpFromLog $server.stdout $phone

$server = Start-TestServer 'qa-final-auth2-stdout.log' 'qa-final-auth2-stderr.log'
try {
  $verify = Invoke-JsonPost "$base/auth/verify-otp" @{ mobile = $phone; otp = $otp }
  $headers = @{ 'X-OTP-Verified-Token' = $verify.otp_verified_token }
  $null = Invoke-JsonPost "$base/auth/set-pin" @{ mobile = $phone; pin = $pin } $headers
  $login = Invoke-JsonPost "$base/auth/login" @{ mobile = $phone; pin = $pin }
  [pscustomobject]@{
    verifySuccess = $verify.success
    loginSuccess = [bool]$login.token
    roles = $login.roles
    authHits = ([regex]::Matches((Read-LogText $server.stdout), 'AUTH LOGIN HIT')).Count
    nomineeHits = ([regex]::Matches((Read-LogText $server.stdout), 'NOMINEE LOGIN HIT')).Count
    loginUserLog = ((Read-LogText $server.stdout) -match 'LOGIN USER:')
    rolesLog = ((Read-LogText $server.stdout) -match 'ROLES:')
  } | ConvertTo-Json -Depth 5
}
finally { Stop-TestServer $server.proc }
