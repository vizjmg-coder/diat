$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$escapedPath = ($PSScriptRoot -replace '\\', '/') -replace ' ', '%20'
$url = "file:///" + $escapedPath + "/scratch_test_flujo.html"
$tempFile = [System.IO.Path]::GetTempFileName()
Start-Process -FilePath $edge -ArgumentList @("--headless=new", "--disable-gpu", "--allow-file-access-from-files", "--dump-dom", $url) -RedirectStandardOutput $tempFile -Wait
$content = Get-Content $tempFile -Raw
Remove-Item $tempFile -ErrorAction SilentlyContinue

if ($content -match '<pre id="output">([\s\S]*?)</pre>') {
    $json = $matches[1] | ConvertFrom-Json
    foreach ($r in $json) {
        $color = if ($r.status -eq 'PASS') { 'Green' } else { 'Red' }
        Write-Host "[$($r.status)] $($r.msg)" -ForegroundColor $color
    }
} else {
    Write-Host "No output found in DOM" -ForegroundColor Red
}
