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

function Get-DateYear($dStr) {
    if (!$dStr) { return $null }
    # Try excel serial
    $num = 0
    if ([double]::TryParse([string]$dStr, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$num)) {
        if ($num -gt 30000 -and $num -lt 60000) {
            $dt = [DateTime]::FromOADate($num)
            return $dt.Year.ToString()
        }
    }
    # Try date parsing
    $dt = [DateTime]::MinValue
    if ([DateTime]::TryParse([string]$dStr, [ref]$dt)) {
        return $dt.Year.ToString()
    }
    if ([string]$dStr -match '(202[0-9])') {
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

# Let's test completion year extraction on heredados:
$heredados = $rvt | Where-Object { (Get-Num $_.'VIGENCIA') -lt 2024 }

Write-Host "--- HEREDADOS BY COMPLETION YEAR ---"
$heredados | ForEach-Object {
    $c = $_.'CONVENIO'
    $v = Get-Num $_.'VIGENCIA'
    $m = Get-Num $_.'LONGITUD EJECUTADA CUATRENIO(m)'
    $yComp = Get-DateYear $_.'NUEVA FECHA DE TERMINACIÓN'
    if (!$yComp) { $yComp = Get-DateYear $_.'FECHA DE TERMINACIÓN' }
    if (!$yComp) { $yComp = '2024' } # Default if within cuatrienio
    [PSCustomObject]@{
        Convenio = $c
        Vigencia = $v
        CuatM = $m
        CompYear = $yComp
    }
} | Group-Object CompYear | Select-Object Name, Count, @{N="SumCuatKM"; E={ [Math]::Round(($_.Group | ForEach-Object { $_.CuatM } | Measure-Object -Sum).Sum / 1000, 4) } } | Format-Table -AutoSize
