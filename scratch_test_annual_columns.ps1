# Script de verificación automatizada para columnas anuales de Longitud y Área Ejecutada (2024-2027)
$outFile = [System.IO.Path]::GetTempFileName()
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$url = "file:///$($PSScriptRoot -replace '\\', '/')/scratch_test_annual_calculations.html"

Write-Host "Ejecutando suite de pruebas en Microsoft Edge Headless..." -ForegroundColor Cyan
Start-Process -FilePath $edge -ArgumentList "--headless=new --disable-gpu --allow-file-access-from-files --dump-dom `"$url`"" -RedirectStandardOutput $outFile -Wait

$content = Get-Content $outFile -Raw
if ($content -match '<pre id="output">([\s\S]*?)</pre>') {
    $json = $matches[1]
    $results = $json | ConvertFrom-Json
    $passCount = ($results | Where-Object { $_.status -eq 'PASS' }).Count
    $totalCount = $results.Count

    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "RESULTADOS DE VERIFICACIÓN ANUAL DIAT" -ForegroundColor Green
    Write-Host "Pruebas superadas: $passCount / $totalCount" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green

    foreach ($r in $results) {
        $color = if ($r.status -eq 'PASS') { 'Green' } else { 'Red' }
        Write-Host "[$($r.status)] $($r.msg)" -ForegroundColor $color
    }
} else {
    Write-Host "Error: No se pudieron extraer los resultados del DOM." -ForegroundColor Red
}

Remove-Item $outFile -ErrorAction SilentlyContinue
