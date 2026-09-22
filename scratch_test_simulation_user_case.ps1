# Simulación del caso de usuario:
# En el Excel hay convenios que ya tienen las 4 columnas (que sumaban 56.51 km actual y 31.19 km heredado),
# y convenios que aún NO tenían las 4 columnas (columnas en 0 / vacías).
# Verificamos que con el nuevo fallback, la suma total no se reduce a 56.51 km, sino que mantiene los 98.27 km completos (+ heredados = 131.37 km).

$ssXml = [xml](Get-Content 'scratch_unzipped\xl\sharedStrings.xml')
$sst = @()
foreach ($si in $ssXml.sst.si) {
    if ($si.t) { $sst += $si.t }
    elseif ($si.r) { $sst += ($si.r | ForEach-Object { $_.t }) -join '' }
    else { $sst += '' }
}
$wsXml = [xml](Get-Content 'scratch_unzipped\xl\worksheets\sheet1.xml')
$rows = $wsXml.worksheet.sheetData.row
$headerRow = $rows[0]
$colMap = @{}
foreach ($c in $headerRow.c) {
    $rRef = $c.r -replace '[0-9]',''
    $val = if ($c.t -eq 's') { $sst[[int]$c.v] } else { $c.v }
    if ($val) { $colMap[$rRef] = $val.ToString().Trim() }
}
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

$colNuevaTerm = ($colMap.GetEnumerator() | Where-Object { $_.Value -match 'NUEVA FECHA DE TERMINACI' }).Value
$colTerm = ($colMap.GetEnumerator() | Where-Object { $_.Value -match '^FECHA DE TERMINACI' }).Value

# Función idéntica a script.js
function Get-FallbackYear($row, $isHer, $vigStr) {
    $cuatrenioYears = @('2024', '2025', '2026', '2027')
    $compY = $null
    $val = $row.$colNuevaTerm
    if (!$val) { $val = $row.$colTerm }
    if ($val) {
        $num = Get-Num $val
        if ($num -gt 30000 -and $num -lt 60000) {
            $dt = [DateTime]::FromOADate($num)
            $y = $dt.Year.ToString()
            if ($cuatrenioYears -contains $y) { $compY = $y }
            elseif ([int]$y -lt 2024) { $compY = '2024' }
            else { $compY = '2027' }
        }
        if (!$compY -and [string]$val -match '\b(202[0-9])\b') {
            $compY = $matches[1]
        }
    }
    if (!$compY) { $compY = '2024' }

    if ($isHer) {
        return $compY
    } else {
        if ($cuatrenioYears -contains $vigStr) { return $vigStr }
        if ($cuatrenioYears -contains $compY) { return $compY }
        return '2024'
    }
}

$years = @('2024', '2025', '2026', '2027')
$totalOldWay = 0
$totalNewWay = 0

foreach ($row in $filtered) {
    $vig = [int](Get-Num $row.'VIGENCIA')
    $isHer = ($vig -gt 0 -and $vig -lt 2024)
    $vigStr = $vig.ToString()

    $lc = Get-Num $row.'LONGITUD EJECUTADA CUATRENIO(m)'
    $le = Get-Num $row.'LONGITUD EJECUTADA (m)'
    if (!$isHer -and $lc -eq 0 -and $le -gt 0) { $lc = $le }
    $valTotal = if ($lc -gt 0) { $lc } else { if ($isHer) { 0 } else { $le } }

    if (!$isHer) {
        $totalOldWay += ($valTotal / 1000)
    }

    # New way with fallback
    # Sum over 4 years:
    $rowSum = 0
    foreach ($y in $years) {
        # If no annual cols, fallback matches only 1 year:
        $fbY = Get-FallbackYear $row $isHer $vigStr
        if ($y -eq $fbY) {
            $rowSum += ($valTotal / 1000)
        }
    }
    if (!$isHer) {
        $totalNewWay += $rowSum
    }
}

Write-Host "Total Ejecutado Anterior (Old Way): $([Math]::Round($totalOldWay, 2)) km"
Write-Host "Total Ejecutado Nuevo (Con Fallback): $([Math]::Round($totalNewWay, 2)) km"
Write-Host "Diferencia: $([Math]::Round($totalNewWay - $totalOldWay, 6)) km"
