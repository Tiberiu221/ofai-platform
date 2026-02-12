$targetPath = "C:\Users\tiber\Desktop\AppReduceri\appredueri_mobile"

# Check for common locking culprits
$suspects = @("node", "watchman", "java", "adb", "Code", "fsutil")
foreach ($name in $suspects) {
    $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
    if ($procs) {
        foreach ($p in $procs) {
            Write-Host "FOUND: $($p.ProcessName) (PID: $($p.Id))"
        }
    }
}

# Try to find open handles using handle.exe alternative
Write-Host ""
Write-Host "Attempting rename..."
try {
    Rename-Item -Path $targetPath -NewName "appredueri_mobile_old" -Force -ErrorAction Stop
    Write-Host "SUCCESS: Folder renamed!"
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "Trying cmd /c rename..."
    cmd /c "rename `"$targetPath`" appredueri_mobile_old" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS via cmd!"
    } else {
        Write-Host "Still locked. Try closing VS Code and any file explorers, then run again."
    }
}
