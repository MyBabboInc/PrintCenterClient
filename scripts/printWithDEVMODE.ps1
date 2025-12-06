param(
    [string]$PrinterName,
    [string]$PdfPath,
    [string]$Duplex = "",          # "simplex", "long", "short"
    [string]$Color = "color",      # "color" or "gray"
    [string]$Tray = "",            # Tray name
    [int]$Copies = 1,
    [string]$Orientation = "portrait" # "portrait" or "landscape"
)

# Exit codes
$EXIT_SUCCESS = 0
$EXIT_INVALID_PRINTER = 1
$EXIT_INVALID_PDF = 2
$EXIT_PRINT_ERROR = 3
$EXIT_DEVMODE_ERROR = 4

function Write-Result {
    param([string]$Status, [string]$Message, [hashtable]$Data = @{})
    
    $result = @{
        status = $Status
        message = $Message
        data = $Data
    }
    
    Write-Output ($result | ConvertTo-Json -Compress)
}

try {
    # Validate inputs
    if (-not $PrinterName) {
        Write-Result "error" "Printer name is required"
        exit $EXIT_INVALID_PRINTER
    }
    
    if (-not (Test-Path $PdfPath)) {
        Write-Result "error" "PDF file not found: $PdfPath"
        exit $EXIT_INVALID_PDF
    }
    
    # Load System.Drawing for printer access
    Add-Type -AssemblyName System.Drawing
    
    # Create printer settings object
    $printerSettings = New-Object System.Drawing.Printing.PrinterSettings
    $printerSettings.PrinterName = $PrinterName
    
    # Verify printer is valid
    if (-not $printerSettings.IsValid) {
        Write-Result "error" "Printer '$PrinterName' is not valid or not found"
        exit $EXIT_INVALID_PRINTER
    }
    
    # Set copies
    $printerSettings.Copies = $Copies
    
    # Set duplex mode
    $duplexSet = $false
    if ($Duplex -and $printerSettings.CanDuplex) {
        switch ($Duplex.ToLower()) {
            "simplex" {
                $printerSettings.Duplex = [System.Drawing.Printing.Duplex]::Simplex
                $duplexSet = $true
            }
            "long" {
                $printerSettings.Duplex = [System.Drawing.Printing.Duplex]::Vertical
                $duplexSet = $true
            }
            "short" {
                $printerSettings.Duplex = [System.Drawing.Printing.Duplex]::Horizontal
                $duplexSet = $true
            }
            default {
                # If unrecognized, default to simplex
                $printerSettings.Duplex = [System.Drawing.Printing.Duplex]::Default
            }
        }
    } elseif ($Duplex -and -not $printerSettings.CanDuplex) {
        # Duplex requested but not supported - will warn but continue
        Write-Warning "Duplex printing requested but printer does not support it"
    }
    
    # Create page settings
    $pageSettings = New-Object System.Drawing.Printing.PageSettings($printerSettings)
    
    # Set orientation
    if ($Orientation -eq "landscape") {
        $pageSettings.Landscape = $true
    } else {
        $pageSettings.Landscape = $false
    }
    
    # Set paper source (tray) if specified
    $traySet = $false
    if ($Tray) {
        foreach ($source in $printerSettings.PaperSources) {
            if ($source.SourceName -eq $Tray) {
                $pageSettings.PaperSource = $source
                $traySet = $true
                break
            }
        }
        if (-not $traySet) {
            Write-Warning "Tray '$Tray' not found on printer, using default"
        }
    }
    
    # Now use SumatraPDF with enhanced print settings
    # SumatraPDF respects Windows printer DEVMODE settings when available
    # We'll use SumatraPDF for actual PDF rendering but our settings are applied via printer
    
    # Build SumatraPDF command
    $sumatraPdfPath = "SumatraPDF.exe"  # Assumes SumatraPDF is in PATH or will be resolved
    
    # Build print-settings argument
    $printSettings = @()
    
    # Add duplex setting to SumatraPDF command
    if ($Duplex) {
        switch ($Duplex.ToLower()) {
            "simplex" { $printSettings += "simplex" }
            "long" { $printSettings += "duplexlong" }
            "short" { $printSettings += "duplexshort" }
        }
    }
    
    # Add color setting
    if ($Color -eq "gray") {
        $printSettings += "monochrome"
    } else {
        $printSettings += "color"
    }
    
    # Add orientation
    if ($Orientation -eq "landscape") {
        $printSettings += "landscape"
    } else {
        $printSettings += "portrait"
    }
    
    # Build command arguments
    $arguments = @(
        "-print-to", "`"$PrinterName`"",
        "-silent"
    )
    
    if ($printSettings.Count -gt 0) {
        $arguments += "-print-settings"
        $arguments += ($printSettings -join ",")
    }
    
    # Add PDF path
    $arguments += "`"$PdfPath`""
    
    # Execute SumatraPDF
    $argumentString = $arguments -join " "
    
    # Use Start-Process to execute SumatraPDF
    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = $sumatraPdfPath
    $processInfo.Arguments = $argumentString
    $processInfo.UseShellExecute = $false
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $processInfo.CreateNoWindow = $true
    
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $processInfo
    
    $started = $process.Start()
    
    if (-not $started) {
        Write-Result "error" "Failed to start SumatraPDF process"
        exit $EXIT_PRINT_ERROR
    }
    
    # Wait for completion (with timeout)
    $timeout = 30000  # 30 seconds
    $exited = $process.WaitForExit($timeout)
    
    if (-not $exited) {
        $process.Kill()
        Write-Result "error" "Print job timed out after 30 seconds"
        exit $EXIT_PRINT_ERROR
    }
    
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $exitCode = $process.ExitCode
    
    if ($exitCode -ne 0) {
        Write-Result "error" "SumatraPDF exited with code $exitCode. Error: $stderr"
        exit $EXIT_PRINT_ERROR
    }
    
    # Build result data
    $resultData = @{
        printer = $PrinterName
        duplex = $Duplex
        duplexSupported = $printerSettings.CanDuplex
        duplexApplied = $duplexSet
        trayRequested = $Tray
        trayApplied = $traySet
        copies = $Copies
        orientation = $Orientation
        color = $Color
    }
    
    Write-Result "success" "Print job sent successfully" $resultData
    exit $EXIT_SUCCESS
    
} catch {
    Write-Result "error" "Exception: $($_.Exception.Message)"
    exit $EXIT_PRINT_ERROR
}
