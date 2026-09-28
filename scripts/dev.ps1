<#
  Visual arts — 一键启动 / 重启 / 停止

  用法（在项目根目录）：
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev.ps1 start
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev.ps1 restart
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev.ps1 stop
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev.ps1 status
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev.ps1 logs

  参数：
    -Port 3000    监听端口（默认 3000）
    -Prod         生产模式：先 npm run build，再 npm run start
    -Force        端口被别的程序占用时也强制结束它
    -NoBrowser    启动后不自动打开浏览器
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet("start", "restart", "stop", "status", "logs")]
  [string]$Action = "start",
  [int]$Port = 3000,
  [switch]$Prod,
  [switch]$Force,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root ".logs"
$logFile = Join-Path $logDir "dev.log"
$pidFile = Join-Path $logDir "server.pid"
$url = "http://localhost:$Port"

function Write-Title([string]$text) {
  Write-Host ""
  Write-Host " $text" -ForegroundColor White
}

function Write-Ok([string]$text) {
  Write-Host "  [OK] $text" -ForegroundColor Green
}

function Write-Info([string]$text) {
  Write-Host "  [..] $text" -ForegroundColor Gray
}

function Write-Warn([string]$text) {
  Write-Host "  [!!] $text" -ForegroundColor Yellow
}

function Write-Fail([string]$text) {
  Write-Host "  [XX] $text" -ForegroundColor Red
}

function Get-ListeningPid([int]$targetPort) {
  try {
    $connection = Get-NetTCPConnection -State Listen -LocalPort $targetPort -ErrorAction Stop |
      Select-Object -First 1
    if ($connection) { return [int]$connection.OwningProcess }
  } catch {
    $line = netstat -ano |
      Select-String -Pattern "LISTENING" |
      Select-String -Pattern ":$targetPort\s" |
      Select-Object -First 1
    if ($line) { return [int](($line.ToString().Trim() -split "\s+")[-1]) }
  }
  return 0
}

function Get-ProcessCommandLine([int]$processId) {
  if (-not $processId) { return "" }
  $info = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
  if ($info -and $info.CommandLine) { return [string]$info.CommandLine }
  return ""
}

function Test-IsProjectProcess([int]$processId) {
  $commandLine = Get-ProcessCommandLine $processId
  if (-not $commandLine) { return $false }
  if ($commandLine -like "*$root*") { return $true }
  return ($commandLine -match "next" -and $commandLine -match "start-server|next\\dist")
}

function Wait-ForPort([int]$targetPort, [int]$timeoutSeconds, [switch]$ExpectOpen) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $listening = [bool](Get-ListeningPid $targetPort)
    if ($ExpectOpen -and $listening) { return $true }
    if (-not $ExpectOpen -and -not $listening) { return $true }
    if ($ExpectOpen) {
      try {
        $client = New-Object System.Net.Sockets.TcpClient
        $client.Connect("127.0.0.1", $targetPort)
        $client.Close()
        return $true
      } catch {}
    }
    Start-Sleep -Milliseconds 400
  }
  return $false
}

function Show-LogTail([int]$lines = 20) {
  if (-not (Test-Path $logFile)) { return }
  Write-Info "最近日志（$logFile）："
  Get-Content -LiteralPath $logFile -Tail $lines | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
}

function Stop-Server([switch]$Quiet) {
  $targetPid = Get-ListeningPid $Port
  $recordedPid = 0
  if (Test-Path $pidFile) {
    $raw = (Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($raw -and [int]::TryParse($raw.Trim(), [ref]$recordedPid)) {} else { $recordedPid = 0 }
  }

  if (-not $targetPid -and -not $recordedPid) {
    if (-not $Quiet) { Write-Info "端口 $Port 上没有正在运行的服务。" }
    return $true
  }

  if ($targetPid) {
    if (-not (Test-IsProjectProcess $targetPid) -and -not $Force) {
      $detail = Get-ProcessCommandLine $targetPid
      Write-Fail "端口 $Port 被其它程序占用（PID $targetPid），它不是本项目的服务。"
      if ($detail) { Write-Host "       $detail" -ForegroundColor DarkGray }
      Write-Warn "确认可以结束后，请加 -Force 重新执行，或先手动结束该程序。"
      return $false
    }
    Write-Info "正在停止 $url 上的服务（PID $targetPid）…"
    Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
  }

  if ($recordedPid -and $recordedPid -ne $targetPid) {
    Stop-Process -Id $recordedPid -Force -ErrorAction SilentlyContinue
  }

  if (-not (Wait-ForPort $Port 15)) {
    Write-Warn "端口 $Port 仍被占用，请重试或手动结束后再启动。"
    return $false
  }

  Remove-Item -LiteralPath $pidFile -ErrorAction SilentlyContinue
  if (-not $Quiet) { Write-Ok "已停止。" }
  return $true
}

function Test-Http([string]$targetUrl) {
  try {
    $response = Invoke-WebRequest -Uri $targetUrl -UseBasicParsing -TimeoutSec 10 -Method Head
    return $response.StatusCode
  } catch {
    try {
      $response = Invoke-WebRequest -Uri $targetUrl -UseBasicParsing -TimeoutSec 10
      return $response.StatusCode
    } catch {
      return 0
    }
  }
}

function Open-App {
  if ($NoBrowser) { return }
  try {
    Start-Process $url | Out-Null
    Write-Ok "已打开浏览器：$url"
  } catch {
    Write-Info "请手动打开：$url"
  }
}

function Start-Server {
  $existing = Get-ListeningPid $Port
  if ($existing) {
    if (Test-IsProjectProcess $existing) {
      Write-Info "服务已经在运行（PID $existing）。"
      Write-Ok "地址：$url"
      Open-App
      return $true
    }
    $detail = Get-ProcessCommandLine $existing
    if (-not $Force) {
      Write-Fail "端口 $Port 已被其它程序占用（PID $existing），它不是本项目的服务。"
      if ($detail) { Write-Host "       $detail" -ForegroundColor DarkGray }
      Write-Warn "可以改用别的端口（例如 启动.cmd -Port 3001），或确认无误后加 -Force 强制结束该程序。"
      return $false
    }
    Write-Warn "端口 $Port 被其它程序占用（PID $existing），-Force 已指定，正在结束它…"
    if (-not (Stop-Server)) { return $false }
  }

  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    Write-Fail "没有找到 Node.js，请先安装（https://nodejs.org）后重试。"
    return $false
  }
  Write-Info "Node.js：$((& node -v))"

  if (-not (Test-Path (Join-Path $root "node_modules\next"))) {
    Write-Info "首次运行，正在安装依赖（npm install）…"
    Push-Location $root
    try { & npm install } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) {
      Write-Fail "依赖安装失败，请检查网络后重试。"
      return $false
    }
  }

  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  Remove-Item -LiteralPath $logFile -ErrorAction SilentlyContinue

  if ($Prod) {
    Write-Info "生产模式：正在构建（npm run build）…"
    Push-Location $root
    try { & npm run build } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) {
      Write-Fail "构建失败，请查看上面的输出。"
      return $false
    }
  }

  $command = if ($Prod) { "npm run start -- --port $Port" } else { "npm run dev -- --port $Port" }
  Write-Info "正在后台启动：$command"
  $process = Start-Process -FilePath $env:ComSpec `
    -ArgumentList "/c $command > `"$logFile`" 2>&1" `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -PassThru
  $process.Id | Set-Content -LiteralPath $pidFile -Encoding ascii

  Write-Info "等待服务就绪…"
  $ready = Wait-ForPort $Port 90 -ExpectOpen
  if (-not $ready) {
    Write-Fail "启动超时。以下日志可能说明原因："
    Show-LogTail 25
    Stop-Server -Quiet | Out-Null
    return $false
  }

  $status = Test-Http $url
  if ($status -ge 200 -and $status -lt 500) {
    Write-Ok "启动成功：$url（HTTP $status）"
  } else {
    Write-Warn "端口已监听，但首页暂未返回正常响应，可稍等几秒或查看日志。"
  }
  Write-Info "服务在后台运行，本窗口可以关闭。"
  Write-Info "查看日志：.logs\dev.log　停止：双击「停止.cmd」"
  Open-App
  return $true
}

switch ($Action) {
  "start" {
    Write-Title "Visual arts · 启动"
    $ok = Start-Server
    if (-not $ok) { exit 1 }
  }
  "restart" {
    Write-Title "Visual arts · 重启"
    if (-not (Stop-Server)) { exit 1 }
    $ok = Start-Server
    if (-not $ok) { exit 1 }
  }
  "stop" {
    Write-Title "Visual arts · 停止"
    if (-not (Stop-Server)) { exit 1 }
  }
  "status" {
    Write-Title "Visual arts · 状态"
    $targetPid = Get-ListeningPid $Port
    if ($targetPid) {
      $isProject = Test-IsProjectProcess $targetPid
      Write-Ok "端口 $Port 正在监听（PID $targetPid，$(if ($isProject) { '本项目' } else { '其它程序' })）"
      $status = Test-Http $url
      if ($status) { Write-Ok "HTTP $status · $url" } else { Write-Warn "端口在监听，但 HTTP 请求没有响应。" }
    } else {
      Write-Info "未运行。双击「启动.cmd」即可。"
    }
    if (Test-Path $logFile) { Write-Info "日志：$logFile（$((Get-Item $logFile).LastWriteTime)）" }
  }
  "logs" {
    Write-Title "Visual arts · 日志"
    if (-not (Test-Path $logFile)) {
      Write-Info "还没有日志文件，先启动一次即可生成。"
      break
    }
    Write-Info "$logFile"
    Get-Content -LiteralPath $logFile -Tail 40
  }
}
