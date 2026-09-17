$url = "https://docs.google.com/spreadsheets/d/13c4V84sj_T1ZQxoq_HLqNHxUUXINzvZJeKWVgK_H55Q/export?format=xlsx&gid=1676437891"
Invoke-WebRequest -Uri $url -OutFile "scratch_sheet.zip"
Expand-Archive -Path "scratch_sheet.zip" -DestinationPath "scratch_unzipped" -Force

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

$rvt = $data | Where-Object {
    $ind = [string]$_.'INDICADOR'
    ($ind -match 'RVT' -or $ind -match 'VÍAS TERCIARIAS')
}

$heredados = $rvt | Where-Object { (Get-Num $_.'VIGENCIA') -lt 2024 }

Write-Host "Heredados count:" $heredados.Count
Write-Host "Heredados by Vigencia:"
$heredados | Group-Object { (Get-Num $_.'VIGENCIA') } | Select-Object Name, Count, @{N="SumCuatM"; E={ ($_.Group | ForEach-Object { Get-Num $_.'LONGITUD EJECUTADA CUATRENIO(m)' } | Measure-Object -Sum).Sum } }, @{N="SumCuatKM"; E={ [Math]::Round(($_.Group | ForEach-Object { Get-Num $_.'LONGITUD EJECUTADA CUATRENIO(m)' } | Measure-Object -Sum).Sum / 1000, 4) } } | Format-Table -AutoSize

Write-Host "`nLook at 2020, 2021, 2022, 2023 convenios in detail:"
foreach ($h in $heredados) {
    $c = $h.'CONVENIO'
    $v = Get-Num $h.'VIGENCIA'
    $m = Get-Num $h.'LONGITUD EJECUTADA CUATRENIO(m)'
    $term = $h.'FECHA DE TERMINACIÓN'
    $nuevaTerm = $h.'NUEVA FECHA DE TERMINACIÓN'
    $acta = $h.'FECHA DE ACTA DE INICIO'
    $estado = $h.'ESTADO CONVENIO'
    if ($m -gt 0) {
        Write-Host ("Vig {0}: Conv {1} | Cuat={2} m ({3} km) | Term={4} | NuevaTerm={5} | Estado={6}" -f $v, $c, $m, ($m/1000), $term, $nuevaTerm, $estado)
    }
}
