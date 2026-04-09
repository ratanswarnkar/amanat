$ErrorActionPreference = 'Stop'
$backend = 'c:\Users\Ashish Yadav\OneDrive\Desktop\amanat-app\digital-vault-backend'
$stdout = Join-Path $backend 'qa-probe-stdout.log'
$stderr = Join-Path $backend 'qa-probe-stderr.log'
if (Test-Path $stdout) { Remove-Item -LiteralPath $stdout -Force }
if (Test-Path $stderr) { Remove-Item -LiteralPath $stderr -Force }
$proc = Start-Process node -ArgumentList 'server.js' -WorkingDirectory $backend -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 4
try {
  $resp = Invoke-RestMethod -Uri 'http://127.0.0.1:5050/auth/send-otp' -Method Post -ContentType 'application/json' -Body (@{ mobile = '9876543290' } | ConvertTo-Json -Compress)
  Start-Sleep -Seconds 2
  [pscustomobject]@{
    response = ($resp | ConvertTo-Json -Compress)
    stdout = (Get-Content -LiteralPath $stdout -Raw)
    stderr = (Get-Content -LiteralPath $stderr -Raw)
  } | ConvertTo-Json -Depth 4
}
finally {
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
}
