$printer = Get-Printer | Select-Object -First 1
if ($printer) {
    Write-Host "Printer: $($printer.Name)"
    Write-Host "--- Get-Printer Properties ---"
    $printer | Select-Object * | Out-String | Write-Host
    
    Write-Host "--- Get-PrintConfiguration ---"
    try {
        Get-PrintConfiguration -PrinterName $printer.Name | Select-Object * | Out-String | Write-Host
    }
    catch {
        Write-Host "Error getting config: $_"
    }

    Write-Host "--- Get-PrintCapabilities ---"
    try {
        # This might return XML
        $caps = Get-PrintCapabilities -PrinterName $printer.Name
        $caps | Out-String | Write-Host
    }
    catch {
        Write-Host "Error getting capabilities: $_"
    }
}
else {
    Write-Host "No printers found."
}
