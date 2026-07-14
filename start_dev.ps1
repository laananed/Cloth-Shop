$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $rootDir 'backend'
$pythonPath = Join-Path $backendDir '.venv\Scripts\python.exe'

if (-not (Test-Path -LiteralPath $pythonPath)) {
    $pythonPath = Join-Path $rootDir '.venv\Scripts\python.exe'
}

if (-not (Test-Path -LiteralPath $pythonPath)) {
    $pythonPath = 'python.exe'
}

Start-Process -FilePath $pythonPath `
    -WorkingDirectory $backendDir `
    -ArgumentList '-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8050'

Start-Process -FilePath $pythonPath `
    -WorkingDirectory $rootDir `
    -ArgumentList '-m', 'http.server', '5900'

function Wait-ForPort {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $client = New-Object System.Net.Sockets.TcpClient
        try {
            $client.Connect('127.0.0.1', $Port)
            return $true
        } catch {
            Start-Sleep -Seconds 1
        } finally {
            $client.Dispose()
        }
    }

    return $false
}

Write-Host 'Waiting for backend and frontend services...'
$backendReady = Wait-ForPort -Port 8050
$frontendReady = Wait-ForPort -Port 5900

if (-not ($backendReady -and $frontendReady)) {
    throw 'Startup timed out. Check the backend and frontend service output.'
}

Write-Host 'Backend ready: http://127.0.0.1:8050'
Write-Host 'Frontend ready: http://127.0.0.1:5900/index.html'
Start-Process 'http://127.0.0.1:8050'
Start-Process 'http://127.0.0.1:5900/index.html'
