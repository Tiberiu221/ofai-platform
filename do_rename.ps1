# Find what's locking
$suspects = @("Code", "node", "java", "watchman", "metro", "expo", "git", "fsnotifier")
foreach ($name in $suspects) {
    $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
    if ($procs) {
        foreach ($p in $procs) {
            Write-Host "Running: $($p.ProcessName) (PID: $($p.Id))"
        }
    }
}

# Kill ALL of them (except adb which we need)
foreach ($name in $suspects) {
    Stop-Process -Name $name -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 5

# Try rename
try {
    Rename-Item -Path "C:\Users\tiber\Desktop\AppReduceri\appredueri_mobile" -NewName "appredueri_mobile_old" -Force -ErrorAction Stop
    Write-Host "SUCCESS!"
} catch {
    Write-Host "Still locked: $($_.Exception.Message)"
}
