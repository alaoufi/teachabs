param(
    [Parameter(Mandatory=$true)][ValidatePattern('^emulator-[0-9]+$')][string]$Serial,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$ExpectedRevision,
    [string]$ApkPath = "$PSScriptRoot/app/build/outputs/apk/debug/app-debug.apk",
    [string]$OutputDirectory = "$PSScriptRoot/review-output",
    [int[]]$Widths = @(320,360,393),
    [string[]]$FontScales = @('1.0','1.3','1.6'),
    [string[]]$Routes = @()
)
$ErrorActionPreference = 'Stop'
$adbCommand = Get-Command adb -ErrorAction SilentlyContinue
$adb = if ($adbCommand) { $adbCommand.Source } elseif ($env:ANDROID_HOME) { Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe' } else { throw 'Android adb is required.' }
if (-not (Test-Path $adb)) { throw 'adb executable was not found.' }
function Native([string]$Executable,[string[]]$Arguments) {
    # Windows PowerShell 5.1 may expose successful native stderr as ErrorRecord objects.
    $ErrorActionPreference = 'Continue'
    $result = & $Executable @Arguments 2>&1
    $code = $LASTEXITCODE
    if ($code -ne 0) { throw "Native command failed ($code): $Executable $($Arguments -join ' ')`n$result" }
    return ($result -join "`n").Trim()
}
function Device([string[]]$Arguments) { return (Native -Executable $adb -Arguments (@('-s',$Serial) + $Arguments)) }
if ((Device @('get-state')) -ne 'device') { throw 'The selected emulator is not ready.' }
if ((Device @('shell','getprop','ro.kernel.qemu')) -ne '1') { throw 'Only a disposable Android emulator may be changed by this script.' }
foreach ($width in $Widths) { if ($width -notin @(320,360,393,412)) { throw 'Choose a documented mobile viewport width.' } }
foreach ($scale in $FontScales) { if ($scale -notin @('1.0','1.3','1.6','2.0')) { throw 'Choose a documented Android font scale.' } }
if (-not (Test-Path $ApkPath)) { throw 'Build the review APK first.' }
$aaptCommand = Get-Command aapt -ErrorAction SilentlyContinue
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Split-Path (Split-Path $adb -Parent) -Parent }
$aapt = if ($aaptCommand) { $aaptCommand.Source } else { (Get-ChildItem "$sdk/build-tools/*/aapt.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1).FullName }
if (-not $aapt) { throw 'SDK aapt is required to verify the APK identity and permissions.' }
$badging = Native -Executable $aapt -Arguments @('dump','badging',(Resolve-Path $ApkPath).Path)
if ($badging -notmatch "package: name='app.teachabs.adminpreview' versionCode='14'" -or $badging -match 'uses-permission') { throw 'APK identity/version/permissions differ from this review candidate.' }
$pageTitles = @{}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $ApkPath).Path)
try {
    $entry = $archive.GetEntry('assets/preview-manifest.json')
    if (-not $entry) { throw 'The APK has no packaged preview manifest.' }
    $reader = New-Object System.IO.StreamReader($entry.Open())
    try { $manifest = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
    if ($manifest.sourceDirty -ne $false -or $manifest.sourceRevision -ne $ExpectedRevision) { throw 'The APK is not the verified clean review commit.' }
    if ($manifest.mode -ne 'offline-static-preview' -or $manifest.network -ne $false -or $manifest.persistence -ne $false) { throw 'This is not the expected offline preview artifact.' }
    foreach ($file in $manifest.files.PSObject.Properties) {
        $asset = $archive.GetEntry('assets/' + $file.Name)
        if (-not $asset) { throw "Missing packaged asset: $($file.Name)" }
        $stream = $asset.Open(); $sha = [System.Security.Cryptography.SHA256]::Create()
        try { $actual = ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant() }
        finally { $stream.Dispose(); $sha.Dispose() }
        if ($actual -ne $file.Value) { throw "Packaged asset hash mismatch: $($file.Name)" }
        if ($file.Name.EndsWith('.html')) {
            $htmlReader = New-Object System.IO.StreamReader($asset.Open())
            try { $html = $htmlReader.ReadToEnd() } finally { $htmlReader.Dispose() }
            $heading = [regex]::Match($html, '<h1>([^<]+)</h1>')
            if (-not $heading.Success) { throw "Page heading is missing: $($file.Name)" }
            $pageTitles[$file.Name] = [System.Net.WebUtility]::HtmlDecode($heading.Groups[1].Value)
        }
    }
} finally { $archive.Dispose() }
$allRoutes = @($manifest.routes.PSObject.Properties.Name | Where-Object { $_ -like '/admin*' })
if ($Routes.Count -eq 0) { $Routes = $allRoutes }
foreach ($route in $Routes) { if ($route -notin $allRoutes) { throw "Route is not packaged: $route" } }
$run = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = Join-Path $OutputDirectory $run
New-Item -ItemType Directory -Force -Path $out | Out-Null
$remote = "/sdcard/Download/teachabs-admin-review-$run"
Device @('shell','mkdir','-p',$remote) | Out-Null
$originalSize = Device @('shell','wm','size')
$originalDensity = Device @('shell','wm','density')
$originalScale = Device @('shell','settings','get','system','font_scale')
$sizeOverride = if ($originalSize -match 'Override size:\s*(\d+x\d+)') { $Matches[1] } else { 'reset' }
$densityOverride = if ($originalDensity -match 'Override density:\s*(\d+)') { $Matches[1] } else { 'reset' }
$metadata = [ordered]@{
    status = 'capture-only-not-visual-approval'; sourceRevision = $manifest.sourceRevision;
    apkSha256 = (Get-FileHash $ApkPath -Algorithm SHA256).Hash; apkBadging = $badging;
    serial = $Serial; api = (Device @('shell','getprop','ro.build.version.sdk'));
    webView = (Device @('shell','dumpsys','webviewupdate'));
    originalSize = $originalSize; originalDensity = $originalDensity; originalFontScale = $originalScale;
    widths = $Widths; fontScales = $FontScales; routes = $Routes; screenshots = @(); restoration = [ordered]@{}; restored = $false
}
function Capture([string]$Name) {
    Device @('shell','screencap','-p',"$remote/$Name.png") | Out-Null
    Device @('pull',"$remote/$Name.png",(Join-Path $out "$Name.png")) | Out-Null
    $metadata.screenshots += "$Name.png"
}
function WaitPage([string]$Route,[string]$Name) {
    $expectedTitle = $pageTitles[$manifest.routes.$Route]
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        Start-Sleep -Milliseconds 400
        $activity = Device @('shell','dumpsys','activity','activities')
        if ($activity -notmatch '(?m)(mResumedActivity|topResumedActivity)[^\r\n]*app\.teachabs\.adminpreview') { continue }
        Device @('shell','uiautomator','dump',"$remote/$Name.xml") | Out-Null
        $localXml = Join-Path $out "$Name.xml"
        Device @('pull',"$remote/$Name.xml",$localXml) | Out-Null
        [xml]$tree = Get-Content $localXml -Raw -Encoding UTF8
        $titles = @($tree.SelectNodes('//node') | ForEach-Object { $_.GetAttribute('text'); $_.GetAttribute('content-desc') })
        if ($titles -contains $expectedTitle) { return }
    }
    throw "The intended page was not confirmed by Android UIAutomator: $Route ($expectedTitle). Inspect the native screenshot/tree rather than approving this capture."
}
try {
    Device @('install','-r',(Resolve-Path $ApkPath).Path) | Out-Null
    Device @('shell','wm','density','480') | Out-Null
    foreach ($width in $Widths) {
        $physicalWidth = $width * 3
        Device @('shell','wm','size',"${physicalWidth}x2400") | Out-Null
        foreach ($scale in $FontScales) {
            Device @('shell','settings','put','system','font_scale',$scale) | Out-Null
            Start-Sleep -Milliseconds 600
            $index = 0
            foreach ($route in $Routes) {
                $index++
                Device @('shell','am','force-stop','app.teachabs.adminpreview') | Out-Null
                Device @('shell','am','start','-W','-n','app.teachabs.adminpreview/.PreviewActivity','--es','preview_route',$route) | Out-Null
                Start-Sleep -Milliseconds 700
                $name = "w${width}-f$($scale.Replace('.','_'))-p$index"
                WaitPage $route $name
                Capture "$name-top"
                Device @('shell','input','swipe',[string]([int]($physicalWidth/2)),'1900',[string]([int]($physicalWidth/2)),'600','450') | Out-Null
                Start-Sleep -Milliseconds 250
                Capture "$name-scroll"
            }
        }
    }
} finally {
    try {
        Device @('shell','wm','size',$sizeOverride) | Out-Null
        $actual = Device @('shell','wm','size')
        $metadata.restoration.size = @{success=($actual -eq $originalSize); actual=$actual}
    } catch { $metadata.restoration.size = @{success=$false; error=$_.Exception.Message} }
    try {
        Device @('shell','wm','density',$densityOverride) | Out-Null
        $actual = Device @('shell','wm','density')
        $metadata.restoration.density = @{success=($actual -eq $originalDensity); actual=$actual}
    } catch { $metadata.restoration.density = @{success=$false; error=$_.Exception.Message} }
    try {
        if ($originalScale -eq 'null') { Device @('shell','settings','delete','system','font_scale') | Out-Null }
        else { Device @('shell','settings','put','system','font_scale',$originalScale) | Out-Null }
        $actual = Device @('shell','settings','get','system','font_scale')
        $metadata.restoration.fontScale = @{success=($actual -eq $originalScale); actual=$actual}
    } catch { $metadata.restoration.fontScale = @{success=$false; error=$_.Exception.Message} }
    $metadata.restored = $metadata.restoration.size.success -and $metadata.restoration.density.success -and $metadata.restoration.fontScale.success
    $metadata | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $out 'capture-report.json') -Encoding UTF8
}
if (-not $metadata.restored) { throw "Emulator restoration is incomplete; inspect $out/capture-report.json before continuing." }
Write-Output "Native Android evidence saved at $out. Screenshots still require human visual review. This is not release approval."
