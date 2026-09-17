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
    if ([string]$val -match '\b(202[0-9])\b') {
        return $matches[1]
    }
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

$rvt = $data | Where-Object {
    $ind = [string]$_.'INDICADOR'
    ($ind -match 'RVT' -or $ind -match 'VÍAS TERCIARIAS')
}

# Find column for Nueva Fecha Term and Fecha Term
$colNuevaTerm = ($colMap.GetEnumerator() | Where-Object { $_.Value -match 'NUEVA FECHA DE TERMINACI' }).Value
$colTerm = ($colMap.GetEnumerator() | Where-Object { $_.Value -match '^FECHA DE TERMINACI' }).Value

Write-Host "Col Nueva Term:" $colNuevaTerm
Write-Host "Col Term:" $colTerm

$years = @('2024', '2025', '2026', '2027')
$contratado = @{ '2024'=0; '2025'=0; '2026'=0; '2027'=0 }
$ejecActual = @{ '2024'=0; '2025'=0; '2026'=0; '2027'=0 }
$ejecHeredado = @{ '2024'=0; '2025'=0; '2026'=0; '2027'=0 }

foreach ($row in $rvt) {
    $vig = [int](Get-Num $row.'VIGENCIA')
    $isHeredado = ($vig -gt 0 -and $vig -lt 2024)
    $vigStr = $vig.ToString()
    
    $alcM = Get-Num $row.'ALCANCE (m)'
    $le = Get-Num $row.'LONGITUD EJECUTADA (m)'
    $lc = Get-Num $row.'LONGITUD EJECUTADA CUATRENIO(m)'
    if (!$isHeredado -and $lc -eq 0 -and $le -gt 0) { $lc = $le }
    $valCuat = if ($lc -gt 0) { $lc } else { if ($isHeredado) { 0 } else { $le } }

    if (!$isHeredado) {
        if ($contratado.ContainsKey($vigStr)) {
            $contratado[$vigStr] += ($alcM / 1000)
            $ejecActual[$vigStr] += ($valCuat / 1000)
        }
    } else {
        # Heredado: assign to completion year during cuatrienio
        $yComp = Get-YearFromVal $row.$colNuevaTerm
        if (!$yComp) { $yComp = Get-YearFromVal $row.$colTerm }
        if (!$yComp -or !$ejecHeredado.ContainsKey($yComp)) {
            $yComp = '2024' # default to first year of cuatrienio
        }
        $ejecHeredado[$yComp] += ($valCuat / 1000)
    }
}

Write-Host "`n====================== TABLA CONTRATADO ======================"
Write-Host "VIGENCIA | CONTRATADO"
$sumCont = 0
foreach ($y in $years) {
    $val = $contratado[$y]
    $sumCont += $val
    Write-Host ("{0,-8} | {1,8:N2} km" -f $y, $val)
}
Write-Host ("{0,-8} | {1,8:N2} km" -f "TOTAL", $sumCont)

Write-Host "`n====================== TABLA EJECUTADO ======================="
Write-Host "VIGENCIA | EJECUTADO | HEREDADO  | EJECUTADO + HEREDADOS"
$sumAct = 0
$sumHer = 0
$sumTot = 0
foreach ($y in $years) {
    $act = $ejecActual[$y]
    $her = $ejecHeredado[$y]
    $tot = $act + $her
    $sumAct += $act
    $sumHer += $her
    $sumTot += $tot
    Write-Host ("{0,-8} | {1,8:N2} km | {2,8:N2} km | {3,8:N2} km" -f $y, $act, $her, $tot)
}
Write-Host ("{0,-8} | {1,8:N2} km | {2,8:N2} km | {3,8:N2} km" -f "TOTAL", $sumAct, $sumHer, $sumTot)
