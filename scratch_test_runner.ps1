$outFile = [System.IO.Path]::GetTempFileName()
$errFile = [System.IO.Path]::GetTempFileName()
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$p = Start-Process -FilePath $edge -ArgumentList @(
    "--headless=new",
    "--disable-gpu",
    "--dump-dom",
    "http://127.0.0.1:5501/test_pdf_2024_2027.html"
) -RedirectStandardOutput $outFile -RedirectStandardError $errFile -Wait -PassThru

$lines = Get-Content $outFile
$outputLine = $lines | Select-String -Pattern "id=""output""" -Context 0,2
Write-Host "--- TEST RESULT ---"
$outputLine

Remove-Item $outFile, $errFile -ErrorAction SilentlyContinue
