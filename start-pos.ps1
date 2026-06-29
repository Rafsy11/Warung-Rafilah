# POS System Startup Script
# Run as Administrator untuk best results

param(
    [switch]$Stop,
    [switch]$Restart,
    [switch]$Logs,
    [switch]$Status,
    [switch]$Backup
)

$ErrorActionPreference = "Stop"
$composeFile = "docker-compose.yml"
$projectName = "pos"

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Check-Prerequisites {
    Write-ColorOutput "`n🔍 Checking prerequisites..." "Cyan"
    
    # Check Docker
    try {
        $dockerVersion = docker --version
        Write-ColorOutput "  ✓ Docker: $dockerVersion" "Green"
    } catch {
        Write-ColorOutput "  ✗ Docker not found! Please install Docker Desktop." "Red"
        exit 1
    }
    
    # Check if Docker is running
    try {
        docker info | Out-Null
        Write-ColorOutput "  ✓ Docker is running" "Green"
    } catch {
        Write-ColorOutput "  ✗ Docker is not running! Please start Docker Desktop." "Red"
        exit 1
    }
    
    # Check .env file
    if (Test-Path ".env") {
        Write-ColorOutput "  ✓ .env file found" "Green"
    } else {
        Write-ColorOutput "  ✗ .env file not found! Copy from .env.example" "Red"
        exit 1
    }
    
    # Check critical env vars
    $envContent = Get-Content ".env" -Raw
    $criticalVars = @("JWT_SECRET", "POSTGRES_PASSWORD", "CLOUDFLARE_TUNNEL_TOKEN")
    $missingVars = @()
    
    foreach ($var in $criticalVars) {
        if ($envContent -notmatch "$var=.+") {
            $missingVars += $var
        }
    }
    
    if ($missingVars.Count -gt 0) {
        Write-ColorOutput "  ✗ Missing critical environment variables:" "Red"
        foreach ($var in $missingVars) {
            Write-ColorOutput "    - $var" "Red"
        }
        exit 1
    }
    
    Write-ColorOutput "  ✓ All environment variables configured" "Green"
}

function Show-Status {
    Write-ColorOutput "`n📊 POS System Status" "Cyan"
    Write-ColorOutput "=" * 60 "Cyan"
    
    $containers = docker-compose -f $composeFile -p $projectName ps
    Write-Host $containers
    
    Write-ColorOutput "`n🏥 Health Status:" "Cyan"
    
    $services = @("pos_postgres", "pos_nextjs", "pos_n8n", "pos_waha", "pos_cloudflared")
    foreach ($service in $services) {
        try {
            $health = docker inspect --format='{{.State.Health.Status}}' $service 2>$null
            if ($health -eq "healthy") {
                Write-ColorOutput "  ✓ $service : HEALTHY" "Green"
            } elseif ($health -eq "unhealthy") {
                Write-ColorOutput "  ✗ $service : UNHEALTHY" "Red"
            } else {
                $status = docker inspect --format='{{.State.Status}}' $service 2>$null
                if ($status -eq "running") {
                    Write-ColorOutput "  ○ $service : RUNNING (no healthcheck)" "Yellow"
                } else {
                    Write-ColorOutput "  ✗ $service : $status" "Red"
                }
            }
        } catch {
            Write-ColorOutput "  ✗ $service : NOT FOUND" "Red"
        }
    }
    
    # System resources
    Write-ColorOutput "`n💻 System Resources:" "Cyan"
    $os = Get-CimInstance Win32_OperatingSystem
    $totalMemGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
    $freeMemGB = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
    $usedMemGB = $totalMemGB - $freeMemGB
    $memPercent = [math]::Round(($usedMemGB / $totalMemGB) * 100, 0)
    
    Write-Host "  Memory: ${usedMemGB}GB / ${totalMemGB}GB (${memPercent}%)"
    
    $disk = Get-PSDrive -Name C
    $freeSpaceGB = [math]::Round($disk.Free / 1GB, 2)
    $totalSpaceGB = [math]::Round(($disk.Used + $disk.Free) / 1GB, 2)
    $diskPercent = [math]::Round((($totalSpaceGB - $freeSpaceGB) / $totalSpaceGB) * 100, 0)
    
    Write-Host "  Disk C: ${freeSpaceGB}GB free / ${totalSpaceGB}GB total (${diskPercent}% used)"
}

function Start-POS {
    Check-Prerequisites
    
    Write-ColorOutput "`n🚀 Starting POS system..." "Cyan"
    
    # Pull latest images
    Write-ColorOutput "`n📥 Pulling latest images..." "Yellow"
    docker-compose -f $composeFile -p $projectName pull
    
    # Start services
    Write-ColorOutput "`n▶️  Starting services..." "Yellow"
    docker-compose -f $composeFile -p $projectName up -d
    
    # Wait for health checks
    Write-ColorOutput "`n⏳ Waiting for services to be healthy..." "Yellow"
    $maxWait = 60
    $waited = 0
    
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 5
        $waited += 5
        
        $appHealth = docker inspect --format='{{.State.Health.Status}}' pos_nextjs 2>$null
        $dbHealth = docker inspect --format='{{.State.Health.Status}}' pos_postgres 2>$null
        
        if ($appHealth -eq "healthy" -and $dbHealth -eq "healthy") {
            break
        }
        
        Write-Host "." -NoNewline
    }
    
    Write-Host ""
    Show-Status
    
    Write-ColorOutput "`n✅ POS system started successfully!" "Green"
    Write-ColorOutput "`n📍 Access points:" "Cyan"
    Write-ColorOutput "  • Local: http://localhost:3000" "White"
    Write-ColorOutput "  • Via Tunnel: Check Cloudflare dashboard for URL" "White"
    Write-ColorOutput "`n💡 Tips:" "Yellow"
    Write-ColorOutput "  • View logs: .\start-pos.ps1 -Logs" "White"
    Write-ColorOutput "  • Check status: .\start-pos.ps1 -Status" "White"
    Write-ColorOutput "  • Stop system: .\start-pos.ps1 -Stop" "White"
}

function Stop-POS {
    Write-ColorOutput "`n🛑 Stopping POS system..." "Yellow"
    docker-compose -f $composeFile -p $projectName down
    Write-ColorOutput "✅ POS system stopped" "Green"
}

function Restart-POS {
    Write-ColorOutput "`n🔄 Restarting POS system..." "Yellow"
    Stop-POS
    Start-Sleep -Seconds 3
    Start-POS
}

function Show-Logs {
    Write-ColorOutput "`n📜 Showing logs (Ctrl+C to exit)..." "Cyan"
    docker-compose -f $composeFile -p $projectName logs -f --tail=100
}

function Run-Backup {
    Write-ColorOutput "`n💾 Running manual backup..." "Cyan"
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = "backups/manual_backup_$timestamp.dump"
    
    if (!(Test-Path "backups")) {
        New-Item -ItemType Directory -Path "backups" | Out-Null
    }
    
    # Load env vars
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
    
    $dbUser = $env:POSTGRES_USER
    $dbName = $env:POSTGRES_DB
    
    Write-ColorOutput "  Database: $dbName" "White"
    Write-ColorOutput "  File: $backupFile" "White"
    
    docker exec pos_postgres pg_dump -U $dbUser -F c -b -v -f "/backups/manual_backup_$timestamp.dump" $dbName
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "`n✅ Backup completed successfully!" "Green"
        Write-ColorOutput "  Location: $backupFile" "White"
        
        # Show backup size
        $backupSize = (Get-Item "backups/manual_backup_$timestamp.dump").Length / 1MB
        Write-ColorOutput "  Size: $([math]::Round($backupSize, 2)) MB" "White"
    } else {
        Write-ColorOutput "`n✗ Backup failed!" "Red"
    }
}

# Main script logic
Write-ColorOutput @"

  ██████╗  ██████╗ ███████╗    ███████╗██╗   ██╗███████╗████████╗███████╗███╗   ███╗
  ██╔══██╗██╔═══██╗██╔════╝    ██╔════╝╚██╗ ██╔╝██╔════╝╚══██╔══╝██╔════╝████╗ ████║
  ██████╔╝██║   ██║███████╗    ███████╗ ╚████╔╝ ███████╗   ██║   █████╗  ██╔████╔██║
  ██╔═══╝ ██║   ██║╚════██║    ╚════██║  ╚██╔╝  ╚════██║   ██║   ██╔══╝  ██║╚██╔╝██║
  ██║     ╚██████╔╝███████║    ███████║   ██║   ███████║   ██║   ███████╗██║ ╚═╝ ██║
  ╚═╝      ╚═════╝ ╚══════╝    ╚══════╝   ╚═╝   ╚══════╝   ╚═╝   ╚══════╝╚═╝     ╚═╝
                                                                                      
  Warung POS Management System v1.0
  
"@ "Cyan"

if ($Stop) {
    Stop-POS
} elseif ($Restart) {
    Restart-POS
} elseif ($Logs) {
    Show-Logs
} elseif ($Status) {
    Show-Status
} elseif ($Backup) {
    Run-Backup
} else {
    Start-POS
}

Write-Host ""
