$url = 'https://docs.google.com/spreadsheets/d/13c4V84sj_T1ZQxoq_HLqNHxUUXINzvZJeKWVgK_H55Q/export?format=xlsx&gid=1676437891'
$out = 'scratch_live_sheet.xlsx'
Write-Host "Downloading $url ..."
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
Write-Host "Downloaded size: $((Get-Item $out).Length) bytes"

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $out))

# Shared strings
$sstEntry = $zip.GetEntry('xl/sharedStrings.xml')
$sst = @()
if ($sstEntry) {
    $stream = $sstEntry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    $xml = [xml]$reader.ReadToEnd()
    $reader.Close()
    $stream.Close()
    foreach ($si in $xml.sst.si) {
        if ($si.t) { $sst += $si.t }
        elseif ($si.r) { $sst += ($si.r | ForEach-Object { $_.t }) -join '' }
        else { $sst += '' }
    }
}

$sheetEntry = $zip.GetEntry('xl/worksheets/sheet1.xml')
$stream = $sheetEntry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$wsXml = [xml]$reader.ReadToEnd()
$reader.Close()
$stream.Close()
$zip.Dispose()

$rows = $wsXml.worksheet.sheetData.row
$headerRow = $rows[0]
$colMap = @{}
foreach ($c in $headerRow.c) {
    $rRef = $c.r -replace '[0-9]',''
    $val = if ($c.t -eq 's') { $sst[[int]$c.v] } else { $c.v }
    if ($val) { $colMap[$rRef] = $val.ToString().Trim() }
}

Write-Host "=== COLUMNS FOUND ==="
$colMap.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key): $($_.Value)" }

function Get-Num($v) {
    if (!$v) { return 0 }
    $clean = [string]$v -replace '[^0-9.-]+',''
    $res = 0
    [double]::TryParse($clean, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$res) | Out-Null
    return $res
}

$data = @()
for ($i = 1; $i -lt $rows.Count; $i++) {
    $r = $rows[$i]
    $rowDict = @{}
    foreach ($c in $r.c) {
        $rRef = $c.r -replace '[0-9]',''
        $val = if ($c.t -eq 's') { $sst[[int]$c.v] } else { $c.v }
        $rowDict[$rRef] = $val
    }
    $obj = @{}
    foreach ($k in $colMap.Keys) { $obj[$colMap[$k]] = $rowDict[$k] }
    $data += (New-Object PSObject -Property $obj)
}

$clasifs = @('BICIMOTORRUTAS', 'CAFETEROS', 'CONVOCATORIA 3', 'FINDETER', 'JAC', 'MATERIALES', 'RECURSOS')
$filtered = $data | Where-Object {
    $ind = [string]$_.'INDICADOR'
    $clas = [string]$_.'CLASIFICACIÓN'
    if (!$clas) { $clas = [string]$_.'CLASIFICACION' }
    ($ind -match 'RVT' -or $ind -match 'VÍAS TERCIARIAS') -and ($clasifs -contains $clas.Trim())
}

Write-Host "Filtered rows for RVT: $($filtered.Count)"

# Let's find columns
$c2024 = ($colMap.GetEnumerator() | Where-Object { $_.Value -match 'LONGITUD EJECUTADA 2024' }).Value
$c2025 = ($colMap.GetEnumerator() | Where-Object { $_.Value -match 'LONGITUD EJECUTADA 2025' }).Value
$c2026 = ($colMap.GetEnumerator() | Where-Object { $_.Value -match 'LONGITUD EJECUTADA 2026' }).Value
$c2027 = ($colMap.GetEnumerator() | Where-Object { $_.Value -match 'LONGITUD EJECUTADA 2027' }).Value
$cCuat = ($colMap.GetEnumerator() | Where-Object { $_.Value -match 'LONGITUD EJECUTADA CUATRENIO' }).Value

Write-Host "Column names: 2024='$c2024', 2025='$c2025', 2026='$c2026', 2027='$c2027', Cuat='$cCuat'"

$sum2024 = 0; $sum2025 = 0; $sum2026 = 0; $sum2027 = 0; $sumCuatCol = 0
$sum2024Actual = 0; $sum2024Her = 0
$sum2025Actual = 0; $sum2025Her = 0
$sum2026Actual = 0; $sum2026Her = 0

$discrepancies = @()

foreach ($row in $filtered) {
    $vig = [int](Get-Num $row.'VIGENCIA')
    $isHer = ($vig -gt 0 -and $vig -lt 2024)

    $v24 = Get-Num $row.$c2024
    $v25 = Get-Num $row.$c2025
    $v26 = Get-Num $row.$c2026
    $v27 = Get-Num $row.$c2027
    $vCuat = Get-Num $row.$cCuat

    $sum2024 += $v24
    $sum2025 += $v25
    $sum2026 += $v26
    $sum2027 += $v27
    $sumCuatCol += $vCuat

    if ($isHer) {
        $sum2024Her += $v24
        $sum2025Her += $v25
        $sum2026Her += $v26
    } else {
        $sum2024Actual += $v24
        $sum2025Actual += $v25
        $sum2026Actual += $v26
    }

    $sumYears = $v24 + $v25 + $v26 + $v27
    if ([Math]::Abs($sumYears - $vCuat) -gt 0.01) {
        $discrepancies += [PSCustomObject]@{
            Convenio = $row.'CONVENIO'
            Vigencia = $row.'VIGENCIA'
            IsHeredado = $isHer
            SumYears = $sumYears
            CuatCol = $vCuat
            Diff = ($sumYears - $vCuat)
            Y24 = $v24
            Y25 = $v25
            Y26 = $v26
        }
    }
}

Write-Host "`n=== TOTALES EN GOOGLE SHEETS (COLUMNAS ANUALES) ==="
Write-Host "LONGITUD EJECUTADA 2024: $sum2024 m = $([Math]::Round($sum2024/1000, 3)) km"
Write-Host "   -> Actual: $sum2024Actual m ($([Math]::Round($sum2024Actual/1000, 2)) km), Heredado: $sum2024Her m ($([Math]::Round($sum2024Her/1000, 2)) km)"
Write-Host "LONGITUD EJECUTADA 2025: $sum2025 m = $([Math]::Round($sum2025/1000, 3)) km"
Write-Host "   -> Actual: $sum2025Actual m ($([Math]::Round($sum2025Actual/1000, 2)) km), Heredado: $sum2025Her m ($([Math]::Round($sum2025Her/1000, 2)) km)"
Write-Host "LONGITUD EJECUTADA 2026: $sum2026 m = $([Math]::Round($sum2026/1000, 3)) km"
Write-Host "   -> Actual: $sum2026Actual m ($([Math]::Round($sum2026Actual/1000, 2)) km), Heredado: $sum2026Her m ($([Math]::Round($sum2026Her/1000, 2)) km)"
Write-Host "LONGITUD EJECUTADA 2027: $sum2027 m = $([Math]::Round($sum2027/1000, 3)) km"

Write-Host "`nSUMA DE LAS 4 COLUMNAS (24+25+26+27): $($sum2024 + $sum2025 + $sum2026 + $sum2027) m = $([Math]::Round(($sum2024 + $sum2025 + $sum2026 + $sum2027)/1000, 3)) km"
Write-Host "SUMA DE COLUMNA LONGITUD EJECUTADA CUATRENIO: $sumCuatCol m = $([Math]::Round($sumCuatCol/1000, 3)) km"

Write-Host "`n=== DISCREPANCIAS ENTRE SUMA DE AÑOS Y COLUMNA CUATRIENIO ==="
$discrepancies | Format-Table -AutoSize
