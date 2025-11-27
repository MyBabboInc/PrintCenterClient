$printers = Get-Printer
$results = @()

foreach ($p in $printers) {
    $canDuplex = $false
    try {
        # Get-PrintCapabilities returns an XML string or object depending on version
        # We look for the presence of Duplex feature
        $caps = Get-PrintCapabilities -PrinterName $p.Name -ErrorAction SilentlyContinue
        if ($caps) {
            # Check if XML/Text contains "Duplex" or "TwoSided"
            $capsStr = $caps | Out-String
            if ($capsStr -match "Duplex" -or $capsStr -match "TwoSided") {
                $canDuplex = $true
            }
        }
    }
    catch {
        # Ignore errors
    }
    
    $results += [PSCustomObject]@{
        Name      = $p.Name
        CanDuplex = $canDuplex
    }
}

$results | ConvertTo-Json | Set-Content -Path "printer_caps.json"
