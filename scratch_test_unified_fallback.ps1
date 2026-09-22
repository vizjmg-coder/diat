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
function Get-YearFromVal($val) {
    if (!$val) { return $null }
    $num = 0
    if ([double]::TryParse([string]$val, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$num)) {
        if ($num -gt 35000 -and $num -lt 60000) {
            $dt = [DateTime]::FromOADate($num)
            if ($dt.Year -ge 2020 -and $dt.Year -le 2030) { return $dt.Year.ToString() }
        }
    }
    if ([string]$val -match '\b(202[0-9])\b') { return $matches[1] }
    return $null
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

$years = @('2024', '2025', '2026', '2027')
$contratado = @{ '2024'=0; '2025'=0; '2026'=0; '2027'=0 }
$ejecActual = @{ '2024'=0; '2025'=0; '2026'=0; '2027'=0 }
$ejecHeredado = @{ '2024'=0; '2025'=0; '2026'=0; '2027'=0 }

foreach ($row in $filtered) {
    $vig = [int](Get-Num $row.'VIGENCIA')
    $isHeredado = ($vig -gt 0 -and $vig -lt 2024)
    $vigStr = $vig.ToString()
    
    $alcM = Get-Num $row.'ALCANCE (m)'
    $le = Get-Num $row.'LONGITUD EJECUTADA (m)'
    $lc = Get-Num $row.'LONGITUD EJECUTADA CUATRENIO(m)'
    if (!$isHeredado -and $lc -eq 0 -and $le -gt 0) { $lc = $le }
    $valCuat = if ($lc -gt 0) { $lc } else { if ($isHeredado) { 0 } else { $le } }

    # Contratado
    if (!$isHeredado -and $years -contains $vigStr) {
        $contratado[$vigStr] += ($alcM / 1000)
    }

    # Simulate getRowLongitudEjecutadaPlan with fallback:
    # (Since annual columns in original sheet are 0, all rows use fallback)
    $compYear = Get-YearFromVal $row.$colNuevaTerm
    if (!$compYear) { $compYear = Get-YearFromVal $row.$colTerm }

    if ($valCuat -gt 0) {
        if ($isHeredado) {
            $fallbackY = if ($years -contains $compYear) { $compYear } else { '2024' }
            $ejecHeredado[$fallbackY] += ($valCuat / 1000)
        } else {
            $fallbackY = if ($years -contains $vigStr) { $vigStr } elseif ($years -contains $compYear) { $compYear } else { '2024' }
            $ejecActual[$fallbackY] += ($valCuat / 1000)
        }
    }
}

Write-Host "--- SIMULACION CON FALLBACK UNIFICADO ---"
Write-Host "Contratado Total: $([Math]::Round(($contratado.Values | Measure-Object -Sum).Sum, 2)) km"
Write-Host "Ejecutado Actual Total: $([Math]::Round(($ejecActual.Values | Measure-Object -Sum).Sum, 2)) km"
Write-Host "Ejecutado Heredado Total: $([Math]::Round(($ejecHeredado.Values | Measure-Object -Sum).Sum, 2)) km"
Write-Host "Ejecutado Consolidado: $([Math]::Round(($ejecActual.Values | Measure-Object -Sum).Sum + ($ejecHeredado.Values | Measure-Object -Sum).Sum, 2)) km"
