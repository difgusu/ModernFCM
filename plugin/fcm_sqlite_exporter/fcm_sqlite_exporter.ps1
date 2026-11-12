<#
================================================================================
  FCM SQLITE EXPORTER - Plugin per Fantacalcio Manager
  Estrae tutti i dati di Lega (.fcm) e Serie A (.fca) convertendoli
  in database SQLite completi e pronti all'uso (.sqlite).
================================================================================
#>

[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RawArgs
)

try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
}
catch {}

# Fantacalcio Manager e i database Access (.fcm / .fca) richiedono il driver OLEDB
# 32-bit (Microsoft.Jet.OLEDB.4.0). Se avviato da un ambiente a 64-bit,
# lo script si riavvia automaticamente nell'istanza a 32-bit (SysWOW64).
if ([IntPtr]::Size -eq 8) {
    $sysWow64Ps = Join-Path $env:SystemRoot "SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
    if (Test-Path $sysWow64Ps) {
        $callArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Sta", "-File", $MyInvocation.MyCommand.Path)
        if ($RawArgs) {
            $callArgs += $RawArgs
        }
        & $sysWow64Ps $callArgs
        exit $LASTEXITCODE
    }
}

# ==============================================================================
#  PARSING ARGOMENTI FCM (/S=, /C=, /L=, POSIZIONALI %1 %2 %3)
# ==============================================================================
function Format-CleanFcmParam([string]$val) {
    if ([string]::IsNullOrWhiteSpace($val)) { return "" }
    $s = $val.Trim('"', "'", ' ')
    while ($s.StartsWith('\"') -or $s.StartsWith("'") -or ($s.Length -gt 2 -and $s[0] -eq '\' -and $s[1] -ne '\')) {
        $s = $s.Substring(1).Trim('"', "'", ' ')
    }
    while ($s.EndsWith('\"') -or $s.EndsWith("'") -or ($s.Length -gt 3 -and $s.EndsWith('\'))) {
        $s = $s.Substring(0, $s.Length - 1).Trim('"', "'", ' ')
    }
    return $s
}

$FcmArgS = ""
$FcmArgC = ""
$FcmArgL = ""

$allParams = @($RawArgs) + @($args)
$positional = [System.Collections.ArrayList]::new()

for ($i = 0; $i -lt $allParams.Count; $i++) {
    $item = Format-CleanFcmParam $allParams[$i]
    if ([string]::IsNullOrWhiteSpace($item)) { continue }

    if ($item -match '^[/-][Ss][=:]?(.*)$') {
        $val = $Matches[1]
        if ($val -eq "" -and ($i + 1) -lt $allParams.Count -and -not ($allParams[$i + 1] -match '^[/-]')) {
            $val = $allParams[++$i]
        }
        $FcmArgS = Format-CleanFcmParam $val
    }
    elseif ($item -match '^[/-][Cc][=:]?(.*)$') {
        $val = $Matches[1]
        if ($val -eq "" -and ($i + 1) -lt $allParams.Count -and -not ($allParams[$i + 1] -match '^[/-]')) {
            $val = $allParams[++$i]
        }
        $FcmArgC = Format-CleanFcmParam $val
    }
    elseif ($item -match '^[/-][Ll][=:]?(.*)$') {
        $val = $Matches[1]
        if ($val -eq "" -and ($i + 1) -lt $allParams.Count -and -not ($allParams[$i + 1] -match '^[/-]')) {
            $val = $allParams[++$i]
        }
        $FcmArgL = Format-CleanFcmParam $val
    }
    elseif ($item -in @("-nogui", "/nogui", "-silent", "/silent", "-auto", "/auto", "-gui", "/gui")) {
        # Switch silenti ignorati: l'esportatore mostra sempre l'interfaccia grafica
        continue
    }
    else {
        [void]$positional.Add($item)
    }
}

if ($positional.Count -gt 0) {
    for ($p = 0; $p -lt $positional.Count; $p++) {
        $pos = Format-CleanFcmParam $positional[$p]
        if ($pos -match '(?i)\.(fcm|fca)') {
            if ($FcmArgL -eq "") {
                $FcmArgL = $pos
                $positional.RemoveAt($p)
                break
            }
        }
    }
    if ($FcmArgC -eq "" -and $positional.Count -ge 2) {
        $p0 = Format-CleanFcmParam $positional[0]
        $p1 = Format-CleanFcmParam $positional[1]
        if ($p1 -match '[\\/]' -or (-not [string]::IsNullOrWhiteSpace($p1) -and (Test-Path -LiteralPath $p1 -ErrorAction SilentlyContinue))) {
            $FcmArgC = $p1
            if ($FcmArgS -eq "") { $FcmArgS = $p0 }
        }
        elseif ($p0 -match '[\\/]' -or (-not [string]::IsNullOrWhiteSpace($p0) -and (Test-Path -LiteralPath $p0 -ErrorAction SilentlyContinue))) {
            $FcmArgC = $p0
        }
    }
    elseif ($FcmArgC -eq "" -and $positional.Count -eq 1) {
        $FcmArgC = Format-CleanFcmParam $positional[0]
    }
}

# ==============================================================================
#  PERCORSI, FILE DI CONFIGURAZIONE E LOG
# ==============================================================================
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if ([string]::IsNullOrWhiteSpace($ScriptDir)) { $ScriptDir = $PSScriptRoot }
if ([string]::IsNullOrWhiteSpace($ScriptDir)) { $ScriptDir = (Get-Location).Path }
$ConfigFile = Join-Path $ScriptDir "config_sqlite.json"
$LogFilePath = Join-Path $ScriptDir "exporter_log.txt"

$Config = @{
    DataFolder        = ""
    OutputDir         = ""
    OnlyCurrentSeason = $true
    SelectedFiles     = @()
}

if (Test-Path -LiteralPath $ConfigFile -ErrorAction SilentlyContinue) {
    try {
        $savedConfig = Get-Content $ConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($savedConfig.DataFolder) { $Config.DataFolder = "" + $savedConfig.DataFolder }
        if ($savedConfig.OutputDir) { $Config.OutputDir = "" + $savedConfig.OutputDir }
        if ($null -ne $savedConfig.OnlyCurrentSeason) { $Config.OnlyCurrentSeason = [bool]$savedConfig.OnlyCurrentSeason }
        if ($savedConfig.SelectedFiles) { $Config.SelectedFiles = @($savedConfig.SelectedFiles) }
    }
    catch {}
}

# ==============================================================================
#  RILEVAMENTO AUTOMATICO CARTELLE FCM E DESTINAZIONE SQLITE
# ==============================================================================
function Find-DefaultFcmDataFolder {
    if ($FcmArgL -ne "" -and (Test-Path -LiteralPath $FcmArgL -ErrorAction SilentlyContinue)) {
        $p = Split-Path -Parent $FcmArgL
        if (Test-Path -LiteralPath $p -ErrorAction SilentlyContinue) { return (Resolve-Path $p).Path }
    }
    if ($Config.DataFolder -ne "" -and (Test-Path -LiteralPath $Config.DataFolder -ErrorAction SilentlyContinue)) {
        return (Resolve-Path $Config.DataFolder).Path
    }
    $candidates = [System.Collections.ArrayList]::new()
    try {
        $myDocs = [Environment]::GetFolderPath([Environment+SpecialFolder]::MyDocuments)
        if ($myDocs) {
            [void]$candidates.Add((Join-Path $myDocs "Fantacalcio Manager\data"))
            [void]$candidates.Add((Join-Path $myDocs "FCM\data"))
        }
    }
    catch {}
    if ($env:USERPROFILE) {
        [void]$candidates.Add((Join-Path $env:USERPROFILE "Documents\Fantacalcio Manager\data"))
        [void]$candidates.Add((Join-Path $env:USERPROFILE "Documenti\Fantacalcio Manager\data"))
    }
    [void]$candidates.Add("C:\Fantacalcio Manager\data")
    [void]$candidates.Add("C:\Program Files (x86)\Fantacalcio Manager\data")
    [void]$candidates.Add((Join-Path $ScriptDir "..\..\data"))
    [void]$candidates.Add((Join-Path $ScriptDir "..\data"))

    foreach ($cand in $candidates) {
        if (-not [string]::IsNullOrWhiteSpace($cand) -and (Test-Path -LiteralPath $cand -ErrorAction SilentlyContinue)) {
            $fcmCount = (Get-ChildItem -Path $cand -Filter "*.fcm" -ErrorAction SilentlyContinue | Measure-Object).Count
            if ($fcmCount -gt 0) { return (Resolve-Path $cand).Path }
        }
    }
    foreach ($cand in $candidates) {
        if (-not [string]::IsNullOrWhiteSpace($cand) -and (Test-Path -LiteralPath $cand -ErrorAction SilentlyContinue)) {
            return (Resolve-Path $cand).Path
        }
    }
    return ""
}

function Find-DefaultFcmSiteFolder([string]$dataFolder) {
    if ($FcmArgC -ne "") { return $FcmArgC }
    if ($Config.OutputDir -ne "" -and (Test-Path -LiteralPath $Config.OutputDir -ErrorAction SilentlyContinue)) {
        return $Config.OutputDir
    }
    if ($dataFolder -ne "" -and (Test-Path -LiteralPath $dataFolder -ErrorAction SilentlyContinue)) {
        $fcmRoot = Split-Path -Parent $dataFolder
        $siti = Join-Path $fcmRoot "siti"
        if (Test-Path -LiteralPath $siti -ErrorAction SilentlyContinue) { return (Resolve-Path $siti).Path }
        $sito = Join-Path $fcmRoot "sito"
        if (Test-Path -LiteralPath $sito -ErrorAction SilentlyContinue) { return (Resolve-Path $sito).Path }
    }
    return ""
}

function Get-ResolvedSqliteOutputDir([string]$siteOrSqliteDir) {
    if ([string]::IsNullOrWhiteSpace($siteOrSqliteDir)) { return "" }
    $trimmed = $siteOrSqliteDir.Trim().TrimEnd('\', '/')
    if ($trimmed -match "(?i)[\\/]sqlite$") {
        return $trimmed
    }
    else {
        return (Join-Path $trimmed "sqlite")
    }
}

# Risoluzione percorsi iniziali
if ($FcmArgL -ne "") {
    $parentData = Split-Path -Parent $FcmArgL
    if ($parentData -ne "" -and (Test-Path -LiteralPath $parentData -ErrorAction SilentlyContinue)) {
        $Config.DataFolder = (Resolve-Path $parentData).Path
    }
}
if ([string]::IsNullOrWhiteSpace($Config.DataFolder) -or -not (Test-Path -LiteralPath $Config.DataFolder -ErrorAction SilentlyContinue)) {
    $detectedData = Find-DefaultFcmDataFolder
    if ($detectedData -ne "") { $Config.DataFolder = $detectedData }
}

$SiteDir = ""
if ($FcmArgC -ne "" -and (Test-Path -LiteralPath $FcmArgC -ErrorAction SilentlyContinue)) {
    $SiteDir = (Resolve-Path $FcmArgC).Path
}
elseif ($Config.OutputDir -ne "" -and (Test-Path -LiteralPath $Config.OutputDir -ErrorAction SilentlyContinue)) {
    $SiteDir = (Resolve-Path $Config.OutputDir).Path
}
else {
    $SiteDir = Find-DefaultFcmSiteFolder $Config.DataFolder
}

# ==============================================================================
#  ACCESSO CONDIVISO (ANTI-LOCK) E CONNESSIONE ACCESS / JET OLEDB
# ==============================================================================
# Copia binaria a basso livello con FileShare.ReadWrite per consentire la lettura
# anche quando il file .fcm o .fca è aperto e bloccato da FCM in esecuzione (anche come Admin).
function Copy-FileShared([string]$src, [string]$dst) {
    $bufSize = 65536
    $inStream = [System.IO.FileStream]::new($src, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    try {
        $outStream = [System.IO.FileStream]::new($dst, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        try {
            $inStream.CopyTo($outStream, $bufSize)
        }
        finally {
            $outStream.Close()
        }
    }
    finally {
        $inStream.Close()
    }
}

function Open-FcmConnection([string]$filePath) {
    $c = New-Object -ComObject ADODB.Connection
    $connStrings = @(
        "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$filePath;Mode=Share Deny None;Jet OLEDB:Database Locking Mode=1;",
        "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$filePath;Mode=Read;",
        "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$filePath;Mode=Share Deny None;",
        "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$filePath;Mode=Read;"
    )
    foreach ($cs in $connStrings) {
        try {
            $c.Open($cs)
            return $c
        }
        catch {}
    }
    throw "Impossibile aprire il database Access '$filePath': provider OLEDB non disponibile o file inaccessibile."
}

function Close-FcmConnection($conn) {
    if ($null -ne $conn) {
        try { $conn.Close() } catch {}
        try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($conn) | Out-Null } catch {}
    }
}

function Get-FcaPath([string]$fcmPath, [int]$annoArchivio, [string]$nomeArchivio, [string]$dataFolder = "") {
    $foldersToCheck = [System.Collections.ArrayList]::new()
    if ($fcmPath) {
        $p = Split-Path -Parent $fcmPath
        if ($p -and (Test-Path -LiteralPath $p)) { [void]$foldersToCheck.Add($p) }
    }
    if ($dataFolder -and (Test-Path -LiteralPath $dataFolder) -and -not ($foldersToCheck -contains $dataFolder)) {
        [void]$foldersToCheck.Add($dataFolder)
    }
    foreach ($folder in $foldersToCheck) {
        if ($nomeArchivio) {
            $candidate = Join-Path $folder "ArchivioA$($annoArchivio)$($nomeArchivio).fca"
            if (Test-Path -LiteralPath $candidate) { return $candidate }
        }
        $fcaFiles = Get-ChildItem -Path $folder -Filter "ArchivioA$($annoArchivio)*.fca" -ErrorAction SilentlyContinue
        if ($fcaFiles.Count -gt 0) { return $fcaFiles[0].FullName }
    }
    return ""
}

function Get-FcmMetadata([string]$filePath) {
    $meta = @{
        Path         = $filePath
        FileName     = (Split-Path -Leaf $filePath)
        Nome         = "Sconosciuto"
        Stagione     = 0
        AnnoArchivio = 0
        AnniStagione = ""
        NomeArchivio = ""
        Valido       = $false
    }
    $c = $null
    $tempCopy = $null
    try {
        try {
            $c = Open-FcmConnection $filePath
        }
        catch {
            # Se l'apertura diretta fallisce per lock esclusivo, tenta con copia temporanea condivisa
            $tempCopy = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "fcm_meta_" + [System.Guid]::NewGuid().ToString("N") + ".fcm")
            Copy-FileShared $filePath $tempCopy
            $c = Open-FcmConnection $tempCopy
        }

        $rs = $c.Execute("SELECT Nome, Stagione, AnnoArchivio, NomeArchivio FROM Lega")
        if (-not $rs.EOF) {
            $meta.Nome = "" + $rs.Fields.Item("Nome").Value
            $meta.Stagione = [int]$rs.Fields.Item("Stagione").Value
            $meta.AnnoArchivio = [int]$rs.Fields.Item("AnnoArchivio").Value
            $meta.NomeArchivio = "" + $rs.Fields.Item("NomeArchivio").Value
            $meta.AnniStagione = "$($meta.AnnoArchivio)/$($meta.AnnoArchivio + 1)"
            $meta.Valido = $true
        }
    }
    catch {
        $meta.Valido = $false
    }
    finally {
        Close-FcmConnection $c
        if ($tempCopy -and (Test-Path -LiteralPath $tempCopy)) {
            Remove-Item -LiteralPath $tempCopy -Force -ErrorAction SilentlyContinue
            $tLdb = [System.IO.Path]::ChangeExtension($tempCopy, ".ldb")
            if (Test-Path -LiteralPath $tLdb) { Remove-Item -LiteralPath $tLdb -Force -ErrorAction SilentlyContinue }
        }
    }
    return $meta
}

function Get-SqliteType([int]$adoType) {
    switch ($adoType) {
        { $_ -in 2, 3, 16, 17, 18, 19, 20, 11 } { return "INTEGER" }
        { $_ -in 4, 5, 6, 14, 131, 139 } { return "REAL" }
        { $_ -in 128, 204, 205 } { return "BLOB" }
        default { return "TEXT" }
    }
}

function Find-SqliteCliPath {
    $cmd = Get-Command "sqlite3.exe" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $local = Join-Path $ScriptDir "sqlite3.exe"
    if (Test-Path -LiteralPath $local) { return $local }
    return ""
}

# Colonne che non devono finire nei database pubblicati sul sito: recapiti personali e
# credenziali (dal campo Telef2 della fantasquadra il plugin di invio formazione legge la
# password della squadra). Il sito non legge nessuna di queste colonne.
# I modelli seguono l'operatore -like (senza distinzione tra maiuscole e minuscole) e
# valgono per tutte le tabelle degli archivi .fcm e .fca.
$script:ReservedColumnPatterns = @('Telef*', '*Mail*', '*Passw*', '*Pwd*')

function Test-ReservedColumn([string]$columnName) {
    foreach ($pattern in $script:ReservedColumnPatterns) {
        if ($columnName -like $pattern) { return $true }
    }
    return $false
}

# Converte un file Access (.fcm o .fca) in database SQLite.
# Crea automaticamente una copia shadow temporanea in %TEMP% con FileShare.ReadWrite:
# questo garantisce l'estrazione completa di TUTTE le tabelle (incluse 'Statistiche')
# anche quando l'archivio è aperto ed eventualmente bloccato da FCM eseguito come Admin.
function Convert-JetToSqlite([string]$accessPath, [string]$sqliteDestination, [string]$sqliteCli, [scriptblock]$logCallback) {
    if (-not (Test-Path -LiteralPath $accessPath)) {
        & $logCallback "File non trovato: $accessPath" $true
        return $false
    }
    if (Test-Path -LiteralPath $sqliteDestination) {
        Remove-Item -LiteralPath $sqliteDestination -Force -ErrorAction SilentlyContinue
    }

    $workPath = $accessPath
    $tempDbCopy = $null
    try {
        $tempDbCopy = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "fcm_exp_" + [System.Guid]::NewGuid().ToString("N") + [System.IO.Path]::GetExtension($accessPath))
        Copy-FileShared $accessPath $tempDbCopy
        $workPath = $tempDbCopy
    }
    catch {
        & $logCallback "Avviso: impossibile creare copia shadow temporanea ($($_)). Apertura diretta." $false
        $workPath = $accessPath
        $tempDbCopy = $null
    }

    $conn = $null
    $tempSql = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "fcm_sql_" + [System.Guid]::NewGuid().ToString("N") + ".sql")
    $hadErrors = $false
    try {
        $conn = Open-FcmConnection $workPath
        $schema = $conn.OpenSchema(20) # adSchemaTables
        $tables = [System.Collections.ArrayList]::new()
        while (-not $schema.EOF) {
            if ($schema.Fields.Item("TABLE_TYPE").Value -eq "TABLE") {
                [void]$tables.Add($schema.Fields.Item("TABLE_NAME").Value)
            }
            $schema.MoveNext()
        }
        $schema.Close()

        $writer = [System.IO.StreamWriter]::new($tempSql, $false, [System.Text.Encoding]::UTF8)
        $writer.WriteLine("PRAGMA foreign_keys = OFF;")
        $writer.WriteLine("PRAGMA journal_mode = OFF;")
        $writer.WriteLine("PRAGMA synchronous = OFF;")
        $writer.WriteLine("BEGIN TRANSACTION;")

        $totalRecs = 0
        foreach ($tbl in $tables) {
            try {
                $rs = $conn.Execute("SELECT * FROM [$tbl]")
                $fCount = $rs.Fields.Count
                $colDefs = [System.Collections.ArrayList]::new()
                $colNames = [System.Collections.ArrayList]::new()
                # Indici dei campi da esportare: le colonne riservate restano fuori sia dallo
                # schema (CREATE TABLE) sia dai dati (INSERT)
                $colIndexes = [System.Collections.ArrayList]::new()
                $skippedCols = [System.Collections.ArrayList]::new()
                # Nei nomi SQLite i doppi apici vanno raddoppiati, come gli apici nei valori
                $tblSql = '"' + ([string]$tbl).Replace('"', '""') + '"'

                for ($i = 0; $i -lt $fCount; $i++) {
                    $fld = $rs.Fields.Item($i)
                    if (Test-ReservedColumn $fld.Name) {
                        [void]$skippedCols.Add($fld.Name)
                    }
                    else {
                        $colSql = '"' + ([string]$fld.Name).Replace('"', '""') + '"'
                        [void]$colIndexes.Add($i)
                        [void]$colNames.Add($colSql)
                        [void]$colDefs.Add("$colSql $(Get-SqliteType $fld.Type)")
                    }
                }
                if ($colIndexes.Count -eq 0) {
                    $rs.Close()
                    & $logCallback "  -> Tabella '$tbl': non esportata (contiene solo colonne riservate)" $false
                    continue
                }
                $writer.WriteLine("CREATE TABLE $tblSql ($($colDefs -join ', '));")
                $colsJoined = $colNames -join ', '

                $tRecs = 0
                while (-not $rs.EOF) {
                    $vals = [System.Collections.ArrayList]::new()
                    foreach ($i in $colIndexes) {
                        $val = $rs.Fields.Item($i).Value
                        
                        if ($null -eq $val -or $val -is [System.DBNull]) {
                            [void]$vals.Add("NULL")
                        } 
                        elseif ($val -is [bool]) {
                            [void]$vals.Add($(if ($val) { "1" } else { "0" }))
                        } 
                        elseif ($val -is [int] -or $val -is [int16] -or $val -is [int64] -or $val -is [byte] -or $val -is [sbyte]) {
                            [void]$vals.Add("$val")
                        } 
                        elseif ($val -is [double] -or $val -is [float] -or $val -is [decimal]) {
                            $numStr = [System.Convert]::ToString($val, [System.Globalization.CultureInfo]::InvariantCulture)
                            [void]$vals.Add($numStr)
                        } 
                        else {
                            $escaped = $val.ToString().Replace("'", "''")
                            [void]$vals.Add("'$escaped'")
                        }
                    }
                    $writer.WriteLine("INSERT INTO $tblSql ($colsJoined) VALUES ($($vals -join ', '));")
                    $tRecs++
                    $rs.MoveNext()
                }
                $rs.Close()
                $totalRecs += $tRecs
                & $logCallback "  -> Tabella '$tbl': $tRecs record estratti" $false
                if ($skippedCols.Count -gt 0) {
                    & $logCallback "     Colonne riservate non esportate: $($skippedCols -join ', ')" $false
                }
            }
            catch {
                $hadErrors = $true
                & $logCallback "Errore lettura tabella '$tbl': $_" $true
            }
        }
        $writer.WriteLine("COMMIT;")
        $writer.Close()

        # Esecuzione importazione tramite SQLite CLI (usa il solo nome file SQL per evitare
        # che gli spazi nel percorso %TEMP% dell'utente vengano spezzati dal parser CLI di sqlite3)
        $fullSqliteDest = [System.IO.Path]::GetFullPath($sqliteDestination)
        $tempSqlDir = Split-Path -Parent $tempSql
        $tempSqlLeaf = Split-Path -Leaf $tempSql
        Push-Location -LiteralPath $tempSqlDir
        try {
            $sqliteOutput = & $sqliteCli $fullSqliteDest ".read $tempSqlLeaf" 2>&1
        }
        finally {
            Pop-Location
        }
        if ($LASTEXITCODE -ne 0 -or ($sqliteOutput -match "(?i)error")) {
            $hadErrors = $true
            & $logCallback "Errore SQLite CLI su '$sqliteDestination': $sqliteOutput" $true
        }
        return (-not $hadErrors)
    }
    catch {
        & $logCallback "Errore conversione '$accessPath': $_" $true
        return $false
    }
    finally {
        Close-FcmConnection $conn
        if (Test-Path -LiteralPath $tempSql) { Remove-Item -LiteralPath $tempSql -Force -ErrorAction SilentlyContinue }
        if ($tempDbCopy -and (Test-Path -LiteralPath $tempDbCopy)) {
            Remove-Item -LiteralPath $tempDbCopy -Force -ErrorAction SilentlyContinue
            $tmpLdb = [System.IO.Path]::ChangeExtension($tempDbCopy, ".ldb")
            if (Test-Path -LiteralPath $tmpLdb) { Remove-Item -LiteralPath $tmpLdb -Force -ErrorAction SilentlyContinue }
        }
    }
}

# Esportazione di una singola stagione in due database SQLite (.fcm e .fca)
function Export-FcmSeasonToSqlite([string]$fcmPath, [string]$baseOutputDir, [scriptblock]$logCallback, [string]$dataFolder = "") {
    $meta = Get-FcmMetadata $fcmPath
    if (-not $meta.Valido) {
        & $logCallback "Impossibile leggere i metadati da $fcmPath" $true
        return $null
    }

    $sqliteCli = Find-SqliteCliPath
    if (-not $sqliteCli) {
        & $logCallback "ERRORE CRITICO: 'sqlite3.exe' non trovato nella cartella dello script o nel PATH." $true
        return $null
    }

    $numStagione = $meta.Stagione
    $seasonFolder = Join-Path $baseOutputDir "stagione_$numStagione"
    if (-not (Test-Path -LiteralPath $seasonFolder)) {
        New-Item -ItemType Directory -Path $seasonFolder -Force | Out-Null
    }

    # 1. Conversione Archivio Lega (.fcm -> lega_X.sqlite)
    $destLegaSqlite = Join-Path $seasonFolder "lega_$numStagione.sqlite"
    & $logCallback "Generazione database SQLite Lega: $(Split-Path -Leaf $destLegaSqlite)..." $false
    $okLega = Convert-JetToSqlite $fcmPath $destLegaSqlite $sqliteCli $logCallback

    # 2. Ricerca e Conversione Archivio Serie A (.fca -> seriea_X.sqlite)
    $fcaPath = Get-FcaPath $fcmPath $meta.AnnoArchivio $meta.NomeArchivio $dataFolder
    $destSerieASqlite = Join-Path $seasonFolder "seriea_$numStagione.sqlite"
    $okFca = $true
    if ($fcaPath -and (Test-Path -LiteralPath $fcaPath)) {
        & $logCallback "Trovato archivio Serie A: $(Split-Path -Leaf $fcaPath). Conversione in $(Split-Path -Leaf $destSerieASqlite)..." $false
        $okFca = Convert-JetToSqlite $fcaPath $destSerieASqlite $sqliteCli $logCallback
    }
    else {
        & $logCallback "Nessun file .fca trovato per l'anno $($meta.AnnoArchivio)." $false
    }

    $success = ($okLega -and $okFca)
    if ($success) {
        & $logCallback "Stagione $numStagione convertita con successo in SQLite!" $false
    }
    else {
        & $logCallback "Stagione $numStagione completata con errori su una o piu tabelle." $true
    }

    return @{
        id            = $numStagione
        anno          = $meta.AnnoArchivio
        anni_stagione = $meta.AnniStagione
        nome_lega     = $meta.Nome
        cartella      = "stagione_$numStagione"
        lega_sqlite   = "lega_$numStagione.sqlite"
        seriea_sqlite = "seriea_$numStagione.sqlite"
        success       = $success
    }
}

# ==============================================================================
#  INTERFACCIA GRAFICA (Windows Forms)
# ==============================================================================
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Select-FolderPopup([string]$initialPath, [string]$description) {
    try {
        $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
        $dlg.Description = $description
        $dlg.ShowNewFolderButton = $true
        $clean = ("" + $initialPath).Trim().Trim('"', "'")
        if ($clean -ne "" -and (Test-Path -LiteralPath $clean -PathType Container -ErrorAction SilentlyContinue)) {
            $dlg.SelectedPath = $clean
        }
        $owner = if ($null -ne $Form -and $Form.Visible) { $Form } else { $null }
        $res = if ($null -ne $owner) { $dlg.ShowDialog($owner) } else { $dlg.ShowDialog() }
        if ($res -eq [System.Windows.Forms.DialogResult]::OK -and -not [string]::IsNullOrWhiteSpace($dlg.SelectedPath)) {
            return $dlg.SelectedPath
        }
    }
    catch {}
    return $null
}

function Test-SearchMatch([string]$text, [string]$query) {
    if ([string]::IsNullOrEmpty($query)) { return $true }
    if ([string]::IsNullOrEmpty($text)) { return $false }
    return ($text.IndexOf($query, [System.StringComparison]::OrdinalIgnoreCase) -ge 0)
}

$script:AllFcmFiles = [System.Collections.ArrayList]::new()
$script:CheckedPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$script:CurrentSortColumn = 0
$script:CurrentSortAscending = $true
$script:IsRenderingList = $false
$script:CurrentSeasonNumber = 0
$script:HasConsolidatedPreviousSeasons = $false

$script:CharArrowUp = [char]0x25B2
$script:CharArrowDown = [char]0x25BC
$script:CharCross = [char]0x2715
$script:CharAgrave = [char]0x00E0

$Form = New-Object System.Windows.Forms.Form
$Form.Text = "FCM SQLite Exporter - Conversione Completa Archivi"
$Form.Size = New-Object System.Drawing.Size(780, 740)
$Form.StartPosition = "CenterScreen"
$Form.FormBorderStyle = "FixedDialog"
$Form.MaximizeBox = $false
$Form.BackColor = [System.Drawing.Color]::FromArgb(245, 247, 250)
$Form.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$Form.TopMost = $true
$Form.Add_Shown({
        $Form.Activate()
        $Form.BringToFront()
        $Form.TopMost = $false
    })

# Intestazione
$LblHeader = New-Object System.Windows.Forms.Label
$LblHeader.Text = "FCM SQLite Exporter"
$LblHeader.Font = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
$LblHeader.ForeColor = [System.Drawing.Color]::FromArgb(24, 43, 73)
$LblHeader.Location = New-Object System.Drawing.Point(20, 15)
$LblHeader.Size = New-Object System.Drawing.Size(400, 30)
$Form.Controls.Add($LblHeader)

$LblSub = New-Object System.Windows.Forms.Label
$LblSub.Text = "Estrae gli archivi completi (.fcm Lega e .fca Serie A) e li converte in database SQLite standard."
$LblSub.ForeColor = [System.Drawing.Color]::Gray
$LblSub.Location = New-Object System.Drawing.Point(22, 45)
$LblSub.Size = New-Object System.Drawing.Size(720, 20)
$Form.Controls.Add($LblSub)

# 1. Gruppo Cartella Dati FCM
$GrpData = New-Object System.Windows.Forms.GroupBox
$GrpData.Text = "Cartella Dati Fantacalcio Manager (.fcm e .fca)"
$GrpData.Location = New-Object System.Drawing.Point(20, 70)
$GrpData.Size = New-Object System.Drawing.Size(725, 65)
$Form.Controls.Add($GrpData)

$TxtData = New-Object System.Windows.Forms.TextBox
$TxtData.Text = $Config.DataFolder
$TxtData.Location = New-Object System.Drawing.Point(15, 25)
$TxtData.Size = New-Object System.Drawing.Size(600, 23)
$GrpData.Controls.Add($TxtData)

$BtnBrowseData = New-Object System.Windows.Forms.Button
$BtnBrowseData.Text = "Sfoglia..."
$BtnBrowseData.Location = New-Object System.Drawing.Point(625, 24)
$BtnBrowseData.Size = New-Object System.Drawing.Size(85, 26)
$BtnBrowseData.Add_Click({
        $selected = Select-FolderPopup $TxtData.Text "Seleziona la cartella dati di Fantacalcio Manager (.fcm e .fca)"
        if ($selected) {
            $TxtData.Text = $selected
            $script:CheckedPaths.Clear()
            Update-FileList
        }
    })
$GrpData.Controls.Add($BtnBrowseData)
$TxtData.Add_Leave({ Update-FileList })

if ($FcmArgL -ne "") {
    $TxtData.ReadOnly = $true
    $TxtData.BackColor = [System.Drawing.Color]::FromArgb(238, 240, 244)
    $BtnBrowseData.Enabled = $false
    $GrpData.Text = "Cartella Dati Fantacalcio Manager (impostata automaticamente da FCM)"
}

# 2. Gruppo Destinazione SQLite
$GrpOut = New-Object System.Windows.Forms.GroupBox
$GrpOut.Text = "Cartella Principale di Salvataggio SQLite"
$GrpOut.Location = New-Object System.Drawing.Point(20, 142)
$GrpOut.Size = New-Object System.Drawing.Size(725, 75)
$Form.Controls.Add($GrpOut)

$TxtOut = New-Object System.Windows.Forms.TextBox
$TxtOut.Text = if ($SiteDir -ne "") { $SiteDir } else { "" }
$TxtOut.Location = New-Object System.Drawing.Point(15, 22)
$TxtOut.Size = New-Object System.Drawing.Size(600, 23)
$GrpOut.Controls.Add($TxtOut)

$BtnBrowseOut = New-Object System.Windows.Forms.Button
$BtnBrowseOut.Text = "Sfoglia..."
$BtnBrowseOut.Location = New-Object System.Drawing.Point(625, 21)
$BtnBrowseOut.Size = New-Object System.Drawing.Size(85, 26)
$BtnBrowseOut.Add_Click({
        $selected = Select-FolderPopup $TxtOut.Text "Seleziona la cartella dove salvare i database SQLite"
        if ($selected) {
            $TxtOut.Text = $selected
            Update-SqliteHint
            Update-ConsolidatedState
            Update-ListViewDisplay
        }
    })
$GrpOut.Controls.Add($BtnBrowseOut)

if ($FcmArgC -ne "") {
    $TxtOut.ReadOnly = $true
    $TxtOut.BackColor = [System.Drawing.Color]::FromArgb(238, 240, 244)
    $BtnBrowseOut.Enabled = $false
    $GrpOut.Text = "Cartella Destinazione (impostata automaticamente da FCM)"
}

$LblSqliteHint = New-Object System.Windows.Forms.Label
$LblSqliteHint.ForeColor = [System.Drawing.Color]::FromArgb(60, 90, 130)
$LblSqliteHint.Font = New-Object System.Drawing.Font("Segoe UI", 8.5)
$LblSqliteHint.Location = New-Object System.Drawing.Point(15, 50)
$LblSqliteHint.Size = New-Object System.Drawing.Size(695, 18)
$GrpOut.Controls.Add($LblSqliteHint)

function Update-SqliteHint {
    $curOut = $TxtOut.Text.Trim()
    if ($curOut -ne "") {
        $resolved = Get-ResolvedSqliteOutputDir $curOut
        $LblSqliteHint.Text = "Destinazione Database SQLite: $resolved"
    }
    else {
        $LblSqliteHint.Text = "I database SQLite verranno salvati nella sottocartella \sqlite\"
    }
}
Update-SqliteHint

$TxtOut.Add_TextChanged({
        Update-SqliteHint
        Update-ConsolidatedState
        Update-ListViewDisplay
    })

# 3. Gruppo Selezione File FCM
$GrpFiles = New-Object System.Windows.Forms.GroupBox
$GrpFiles.Text = "Archivi Stagionali (.fcm) Rilevati"
$GrpFiles.Location = New-Object System.Drawing.Point(20, 222)
$GrpFiles.Size = New-Object System.Drawing.Size(725, 230)
$Form.Controls.Add($GrpFiles)

$ListView = New-Object System.Windows.Forms.ListView
$ListView.Location = New-Object System.Drawing.Point(15, 22)
$ListView.Size = New-Object System.Drawing.Size(695, 155)
$ListView.View = [System.Windows.Forms.View]::Details
$ListView.CheckBoxes = $true
$ListView.FullRowSelect = $true
$ListView.GridLines = $true

[void]$ListView.Columns.Add("Stagione $($script:CharArrowUp)", 75)
[void]$ListView.Columns.Add("Anno", 80)
[void]$ListView.Columns.Add("Nome Lega", 175)
[void]$ListView.Columns.Add("Nome File", 220)
[void]$ListView.Columns.Add("Stato", 140)
$GrpFiles.Controls.Add($ListView)

# Pulsantiera selezione e filtri
$BtnSelectAll = New-Object System.Windows.Forms.Button
$BtnSelectAll.Text = "Tutte"
$BtnSelectAll.Location = New-Object System.Drawing.Point(15, 188)
$BtnSelectAll.Size = New-Object System.Drawing.Size(58, 26)
$GrpFiles.Controls.Add($BtnSelectAll)

$BtnSelectLeague = New-Object System.Windows.Forms.Button
$BtnSelectLeague.Text = "Tutte Lega"
$BtnSelectLeague.Location = New-Object System.Drawing.Point(77, 188)
$BtnSelectLeague.Size = New-Object System.Drawing.Size(82, 26)
$GrpFiles.Controls.Add($BtnSelectLeague)

$BtnSelectCurrent = New-Object System.Windows.Forms.Button
$BtnSelectCurrent.Text = "Solo Attuale"
$BtnSelectCurrent.Location = New-Object System.Drawing.Point(163, 188)
$BtnSelectCurrent.Size = New-Object System.Drawing.Size(85, 26)
$GrpFiles.Controls.Add($BtnSelectCurrent)

$BtnDeselectAll = New-Object System.Windows.Forms.Button
$BtnDeselectAll.Text = "Deseleziona"
$BtnDeselectAll.Location = New-Object System.Drawing.Point(252, 188)
$BtnDeselectAll.Size = New-Object System.Drawing.Size(80, 26)
$GrpFiles.Controls.Add($BtnDeselectAll)

$BtnAddFile = New-Object System.Windows.Forms.Button
$BtnAddFile.Text = "Aggiungi..."
$BtnAddFile.Location = New-Object System.Drawing.Point(336, 188)
$BtnAddFile.Size = New-Object System.Drawing.Size(75, 26)
$GrpFiles.Controls.Add($BtnAddFile)

$BtnRefresh = New-Object System.Windows.Forms.Button
$BtnRefresh.Text = "Ricarica"
$BtnRefresh.Location = New-Object System.Drawing.Point(415, 188)
$BtnRefresh.Size = New-Object System.Drawing.Size(65, 26)
$GrpFiles.Controls.Add($BtnRefresh)

$LblFilter = New-Object System.Windows.Forms.Label
$LblFilter.Text = "Filtro:"
$LblFilter.Location = New-Object System.Drawing.Point(486, 192)
$LblFilter.Size = New-Object System.Drawing.Size(40, 20)
$GrpFiles.Controls.Add($LblFilter)

$TxtFilter = New-Object System.Windows.Forms.TextBox
$TxtFilter.Location = New-Object System.Drawing.Point(528, 189)
$TxtFilter.Size = New-Object System.Drawing.Size(152, 24)
$GrpFiles.Controls.Add($TxtFilter)

$BtnClearFilter = New-Object System.Windows.Forms.Button
$BtnClearFilter.Text = "$($script:CharCross)"
$BtnClearFilter.Font = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Bold)
$BtnClearFilter.Location = New-Object System.Drawing.Point(684, 188)
$BtnClearFilter.Size = New-Object System.Drawing.Size(26, 26)
$GrpFiles.Controls.Add($BtnClearFilter)

# Identificazione della Lega attuale
function Get-CurrentLeagueName {
    if ($FcmArgL -ne "" -and (Test-Path -LiteralPath $FcmArgL -ErrorAction SilentlyContinue)) {
        $curM = Get-FcmMetadata $FcmArgL
        if ($curM.Valido -and -not [string]::IsNullOrWhiteSpace($curM.Nome)) {
            return $curM.Nome
        }
    }
    if ($script:CurrentSeasonNumber -gt 0) {
        $currItem = $script:AllFcmFiles | Where-Object { $_.Stagione -eq $script:CurrentSeasonNumber } | Select-Object -First 1
        if ($currItem -and -not [string]::IsNullOrWhiteSpace($currItem.Nome)) {
            return $currItem.Nome
        }
    }
    if ($script:AllFcmFiles.Count -gt 0) {
        $lastItem = $script:AllFcmFiles | Sort-Object Stagione | Select-Object -Last 1
        if ($lastItem -and -not [string]::IsNullOrWhiteSpace($lastItem.Nome)) {
            return $lastItem.Nome
        }
    }
    return ""
}

function Update-ConsolidatedState {
    $curOut = if ($null -ne $TxtOut) { $TxtOut.Text.Trim() } else { "" }
    $destSqlite = if ($curOut -ne "") { Get-ResolvedSqliteOutputDir $curOut } else { "" }
    $consolidatedSet = [System.Collections.Generic.HashSet[int]]::new()
    
    if ($destSqlite -ne "" -and (Test-Path -LiteralPath $destSqlite -ErrorAction SilentlyContinue)) {
        $subDirs = Get-ChildItem -Path $destSqlite -Directory -ErrorAction SilentlyContinue
        foreach ($d in $subDirs) {
            if ($d.Name -match '^stagione_(\d+)$') {
                $sNum = [int]$Matches[1]
                $dbLega = Join-Path $d.FullName "lega_$sNum.sqlite"
                if (Test-Path -LiteralPath $dbLega -ErrorAction SilentlyContinue) {
                    [void]$consolidatedSet.Add($sNum)
                }
            }
        }
    }

    $currentSeasonNum = 0
    if ($FcmArgL -ne "" -and (Test-Path -LiteralPath $FcmArgL -ErrorAction SilentlyContinue)) {
        $curM = Get-FcmMetadata $FcmArgL
        if ($curM.Valido) { $currentSeasonNum = [int]$curM.Stagione }
    }
    if ($currentSeasonNum -eq 0 -and $script:AllFcmFiles.Count -gt 0) {
        $currentSeasonNum = [int]($script:AllFcmFiles | Measure-Object -Property Stagione -Maximum).Maximum
    }
    $script:CurrentSeasonNumber = $currentSeasonNum

    $previousConsolidatedCount = 0
    foreach ($item in $script:AllFcmFiles) {
        if ($item.Stagione -eq $currentSeasonNum -and $currentSeasonNum -gt 0) {
            $item.Stato = "Attuale"
        }
        elseif ($consolidatedSet.Contains($item.Stagione)) {
            $item.Stato = "Consolidata"
            $previousConsolidatedCount++
        }
        else {
            $item.Stato = "Da generare"
        }
    }

    $script:HasConsolidatedPreviousSeasons = ($previousConsolidatedCount -gt 0)

    if ($null -ne $ChkOnlyCurrent) {
        if ($script:HasConsolidatedPreviousSeasons) {
            $ChkOnlyCurrent.Enabled = $true
            $ChkOnlyCurrent.Text = "Esporta solo la stagione attuale (Stag. $currentSeasonNum) - $previousConsolidatedCount stagioni precedenti gia$($script:CharAgrave) convertite"
        }
        else {
            $ChkOnlyCurrent.Enabled = $false
            $ChkOnlyCurrent.Text = "Esporta solo la stagione attuale (nessun database precedente trovato in \sqlite\)"
            $ChkOnlyCurrent.Checked = $false
        }
    }
}

function Update-ListViewDisplay {
    $script:IsRenderingList = $true
    try {
        $ListView.BeginUpdate()
        $ListView.Items.Clear()

        $query = if ($null -ne $TxtFilter) { $TxtFilter.Text.Trim() } else { "" }
        $filtered = [System.Collections.ArrayList]::new()
        foreach ($item in $script:AllFcmFiles) {
            if ($query -eq "" -or `
                (Test-SearchMatch $item.StagioneText $query) -or `
                (Test-SearchMatch $item.AnniStagione $query) -or `
                (Test-SearchMatch $item.Nome $query) -or `
                (Test-SearchMatch $item.FileName $query) -or `
                (Test-SearchMatch $item.Stato $query)) {
                [void]$filtered.Add($item)
            }
        }

        $sorted = switch ($script:CurrentSortColumn) {
            0 {
                if ($script:CurrentSortAscending) { @($filtered | Sort-Object -Property Stagione, FileName) }
                else { @($filtered | Sort-Object -Property Stagione, FileName -Descending) }
            }
            1 {
                if ($script:CurrentSortAscending) { @($filtered | Sort-Object -Property AnniStagione, Stagione) }
                else { @($filtered | Sort-Object -Property AnniStagione, Stagione -Descending) }
            }
            2 {
                if ($script:CurrentSortAscending) { @($filtered | Sort-Object -Property Nome, Stagione) }
                else { @($filtered | Sort-Object -Property Nome, Stagione -Descending) }
            }
            3 {
                if ($script:CurrentSortAscending) { @($filtered | Sort-Object -Property FileName) }
                else { @($filtered | Sort-Object -Property FileName -Descending) }
            }
            4 {
                if ($script:CurrentSortAscending) { @($filtered | Sort-Object -Property Stato, Stagione) }
                else { @($filtered | Sort-Object -Property Stato, Stagione -Descending) }
            }
            default { @($filtered) }
        }

        if ($null -ne $sorted) {
            foreach ($m in $sorted) {
                $lvItem = New-Object System.Windows.Forms.ListViewItem($m.StagioneText)
                [void]$lvItem.SubItems.Add($m.AnniStagione)
                [void]$lvItem.SubItems.Add($m.Nome)
                [void]$lvItem.SubItems.Add($m.FileName)
                [void]$lvItem.SubItems.Add($m.Stato)
                $lvItem.Tag = $m.Path
                $lvItem.Checked = $script:CheckedPaths.Contains($m.Path)
                [void]$ListView.Items.Add($lvItem)
            }
        }

        $arrow = if ($script:CurrentSortAscending) { " $($script:CharArrowUp)" } else { " $($script:CharArrowDown)" }
        $ListView.Columns[0].Text = "Stagione$(if ($script:CurrentSortColumn -eq 0) { $arrow } else { '' })"
        $ListView.Columns[1].Text = "Anno$(if ($script:CurrentSortColumn -eq 1) { $arrow } else { '' })"
        $ListView.Columns[2].Text = "Nome Lega$(if ($script:CurrentSortColumn -eq 2) { $arrow } else { '' })"
        $ListView.Columns[3].Text = "Nome File$(if ($script:CurrentSortColumn -eq 3) { $arrow } else { '' })"
        $ListView.Columns[4].Text = "Stato$(if ($script:CurrentSortColumn -eq 4) { $arrow } else { '' })"
    }
    finally {
        $ListView.EndUpdate()
        $script:IsRenderingList = $false
    }
}

# Funzione 'Solo Attuale': seleziona solo la stagione attiva
function Select-OnlyCurrentSeason {
    $script:CheckedPaths.Clear()
    foreach ($m in $script:AllFcmFiles) {
        if ($m.Stagione -eq $script:CurrentSeasonNumber) {
            [void]$script:CheckedPaths.Add($m.Path)
        }
    }
    Update-ListViewDisplay
}

# Funzione 'Tutte': seleziona TUTTI i file .fcm rilevati nella cartella
function Select-AllDetectedFiles {
    $script:CheckedPaths.Clear()
    foreach ($m in $script:AllFcmFiles) {
        [void]$script:CheckedPaths.Add($m.Path)
    }
    Update-ListViewDisplay
    Add-LogMessage "Selezionati tutti i $($script:AllFcmFiles.Count) archivi rilevati." $false
}

# Funzione 'Tutte Lega': seleziona tutti i file .fcm della Lega attuale
function Select-AllCurrentLeagueFiles {
    $script:CheckedPaths.Clear()
    $currentLeague = Get-CurrentLeagueName
    $matched = 0
    foreach ($m in $script:AllFcmFiles) {
        if ($currentLeague -ne "") {
            if ($m.Nome -eq $currentLeague) {
                [void]$script:CheckedPaths.Add($m.Path)
                $matched++
            }
        }
        else {
            [void]$script:CheckedPaths.Add($m.Path)
            $matched++
        }
    }
    Update-ListViewDisplay
    if ($currentLeague -ne "") {
        Add-LogMessage "Selezionati $matched archivi della lega attuale '$currentLeague'." $false
    }
    else {
        Add-LogMessage "Selezionati $matched archivi." $false
    }
}

function Update-FileList {
    $script:AllFcmFiles.Clear()
    $folder = $TxtData.Text.Trim()
    if ($folder -ne "" -and (Test-Path -LiteralPath $folder -PathType Container -ErrorAction SilentlyContinue)) {
        $files = Get-ChildItem -Path $folder -Filter "*.fcm" -ErrorAction SilentlyContinue | Sort-Object Name
        $metaList = [System.Collections.ArrayList]::new()
        foreach ($f in $files) {
            $m = Get-FcmMetadata $f.FullName
            if ($m.Valido) { [void]$metaList.Add($m) }
        }

        foreach ($m in $metaList) {
            $obj = [PSCustomObject]@{
                Stagione     = [int]$m.Stagione
                StagioneText = "Stag. $($m.Stagione)"
                AnniStagione = "" + $m.AnniStagione
                Nome         = "" + $m.Nome
                FileName     = "" + $m.FileName
                Path         = "" + $m.Path
                Stato        = "Da generare"
            }
            [void]$script:AllFcmFiles.Add($obj)
        }

        Update-ConsolidatedState

        if ($script:CheckedPaths.Count -eq 0) {
            if ($script:HasConsolidatedPreviousSeasons -and $Config.OnlyCurrentSeason) {
                if ($null -ne $ChkOnlyCurrent) { $ChkOnlyCurrent.Checked = $true }
                Select-OnlyCurrentSeason
                Add-LogMessage "Rilevati database consolidati. Selezionata solo la stagione attuale ($($script:CurrentSeasonNumber))." $false
            }
            else {
                if ($null -ne $ChkOnlyCurrent) { $ChkOnlyCurrent.Checked = $false }
                Select-AllCurrentLeagueFiles
                Add-LogMessage "Trovati $($metaList.Count) archivi FCM validi." $false
            }
        }
    }
    Update-ListViewDisplay
}

$ListView.Add_ColumnClick({
        param($src, $e)
        $col = $e.Column
        if ($script:CurrentSortColumn -eq $col) {
            $script:CurrentSortAscending = -not $script:CurrentSortAscending
        }
        else {
            $script:CurrentSortColumn = $col
            $script:CurrentSortAscending = $true
        }
        Update-ListViewDisplay
    })

$ListView.Add_ItemChecked({
        param($src, $e)
        if (-not $script:IsRenderingList -and $null -ne $e.Item -and $null -ne $e.Item.Tag) {
            $p = [string]$e.Item.Tag
            if ($e.Item.Checked) { [void]$script:CheckedPaths.Add($p) }
            else { [void]$script:CheckedPaths.Remove($p) }
        }
    })

$TxtFilter.Add_TextChanged({ Update-ListViewDisplay })
$BtnClearFilter.Add_Click({ $TxtFilter.Text = "" })

$BtnSelectAll.Add_Click({
        if ($ChkOnlyCurrent) { $ChkOnlyCurrent.Checked = $false }
        Select-AllDetectedFiles
    })

$BtnSelectLeague.Add_Click({
        if ($ChkOnlyCurrent) { $ChkOnlyCurrent.Checked = $false }
        Select-AllCurrentLeagueFiles
    })

$BtnSelectCurrent.Add_Click({
        if ($ChkOnlyCurrent -and $ChkOnlyCurrent.Enabled) { $ChkOnlyCurrent.Checked = $true }
        Select-OnlyCurrentSeason
    })

$BtnDeselectAll.Add_Click({
        if ($ChkOnlyCurrent) { $ChkOnlyCurrent.Checked = $false }
        $script:CheckedPaths.Clear()
        Update-ListViewDisplay
    })

$BtnAddFile.Add_Click({
        $dlg = New-Object System.Windows.Forms.OpenFileDialog
        $dlg.Title = "Seleziona archivi Fantacalcio Manager"
        $dlg.Filter = "Archivi FCM (*.fcm)|*.fcm|Tutti i file (*.*)|*.*"
        $dlg.Multiselect = $true
        $res = if ($null -ne $Form -and $Form.Visible) { $dlg.ShowDialog($Form) } else { $dlg.ShowDialog() }
        if ($res -eq [System.Windows.Forms.DialogResult]::OK) {
            foreach ($f in $dlg.FileNames) {
                $m = Get-FcmMetadata $f
                if ($m.Valido) {
                    [void]$script:AllFcmFiles.Add([PSCustomObject]@{
                            Stagione     = [int]$m.Stagione
                            StagioneText = "Stag. $($m.Stagione)"
                            AnniStagione = "" + $m.AnniStagione
                            Nome         = "" + $m.Nome
                            FileName     = "" + $m.FileName
                            Path         = "" + $m.Path
                            Stato        = "Da generare"
                        })
                    [void]$script:CheckedPaths.Add($m.Path)
                }
            }
            Update-ConsolidatedState
            Update-ListViewDisplay
        }
    })

$BtnRefresh.Add_Click({ Update-FileList })

# 4. Opzione Esporta Solo Attuale
$ChkOnlyCurrent = New-Object System.Windows.Forms.CheckBox
$ChkOnlyCurrent.Text = "Esporta solo la stagione attuale"
$ChkOnlyCurrent.Checked = $Config.OnlyCurrentSeason
$ChkOnlyCurrent.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$ChkOnlyCurrent.ForeColor = [System.Drawing.Color]::FromArgb(20, 80, 140)
$ChkOnlyCurrent.Location = New-Object System.Drawing.Point(20, 458)
$ChkOnlyCurrent.Size = New-Object System.Drawing.Size(725, 22)
$ChkOnlyCurrent.Add_CheckedChanged({
        if ($ChkOnlyCurrent.Checked) { Select-OnlyCurrentSeason }
        else { Select-AllCurrentLeagueFiles }
    })
$Form.Controls.Add($ChkOnlyCurrent)

# 5. ProgressBar e Registro Log
$ProgressBar = New-Object System.Windows.Forms.ProgressBar
$ProgressBar.Location = New-Object System.Drawing.Point(20, 486)
$ProgressBar.Size = New-Object System.Drawing.Size(725, 16)
$Form.Controls.Add($ProgressBar)

$LblLog = New-Object System.Windows.Forms.Label
$LblLog.Text = "Registro Operazioni:"
$LblLog.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$LblLog.ForeColor = [System.Drawing.Color]::FromArgb(50, 60, 80)
$LblLog.Location = New-Object System.Drawing.Point(20, 508)
$LblLog.Size = New-Object System.Drawing.Size(580, 20)
$Form.Controls.Add($LblLog)

$BtnOpenLog = New-Object System.Windows.Forms.Button
$BtnOpenLog.Text = "Apri File Log"
$BtnOpenLog.Location = New-Object System.Drawing.Point(620, 505)
$BtnOpenLog.Size = New-Object System.Drawing.Size(125, 24)
$BtnOpenLog.Add_Click({
        if (Test-Path -LiteralPath $LogFilePath) {
            Start-Process "notepad.exe" "`"$LogFilePath`""
        }
        else {
            [System.Windows.Forms.MessageBox]::Show($Form, "Il file di log non e ancora stato generato.", "Registro Operazioni", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
        }
    })
$Form.Controls.Add($BtnOpenLog)

$TxtLog = New-Object System.Windows.Forms.TextBox
$TxtLog.Multiline = $true
$TxtLog.ReadOnly = $true
$TxtLog.ScrollBars = "Vertical"
$TxtLog.BackColor = [System.Drawing.Color]::White
$TxtLog.Location = New-Object System.Drawing.Point(20, 532)
$TxtLog.Size = New-Object System.Drawing.Size(725, 105)
$Form.Controls.Add($TxtLog)

# Registra sia nel controllo GUI a video che nel file di testo persistente con timestamp
function Add-LogMessage([string]$msg, [bool]$isError = $false) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $prefix = if ($isError) { "[ERRORE] " } else { "" }
    $formattedMsg = "[$timestamp] $prefix$msg"

    if ($null -ne $TxtLog -and -not $TxtLog.IsDisposed) {
        $TxtLog.AppendText("$formattedMsg`r`n")
        $TxtLog.SelectionStart = $TxtLog.TextLength
        $TxtLog.ScrollToCaret()
        [System.Windows.Forms.Application]::DoEvents()
    }
    Write-Host $formattedMsg

    try {
        [System.IO.File]::AppendAllText($LogFilePath, "$formattedMsg`r`n", [System.Text.Encoding]::UTF8)
    }
    catch {}
}

# 6. Pulsante Avvio
$BtnStart = New-Object System.Windows.Forms.Button
$BtnStart.Text = "AVVIA CONVERSIONE SQLITE"
$BtnStart.Font = New-Object System.Drawing.Font("Segoe UI", 10.5, [System.Drawing.FontStyle]::Bold)
$BtnStart.ForeColor = [System.Drawing.Color]::White
$BtnStart.BackColor = [System.Drawing.Color]::FromArgb(16, 124, 65)
$BtnStart.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$BtnStart.Location = New-Object System.Drawing.Point(20, 645)
$BtnStart.Size = New-Object System.Drawing.Size(725, 42)

$BtnStart.Add_Click({
        $selected = @()
        foreach ($item in $script:AllFcmFiles) {
            if ($script:CheckedPaths.Contains($item.Path)) { $selected += $item.Path }
        }
        if ($selected.Count -eq 0) {
            [System.Windows.Forms.MessageBox]::Show($Form, "Seleziona almeno un archivio .fcm da elaborare!", "Attenzione", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning)
            return
        }

        $rawDest = $TxtOut.Text.Trim()
        if ($rawDest -eq "") {
            [System.Windows.Forms.MessageBox]::Show($Form, "Specifica la cartella di destinazione!", "Attenzione", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning)
            return
        }

        $sqliteCli = Find-SqliteCliPath
        if (-not $sqliteCli) {
            [System.Windows.Forms.MessageBox]::Show($Form, "Impossibile trovare 'sqlite3.exe'! Assicurati che sia nella cartella dello script o nel PATH di Windows.", "sqlite3.exe mancante", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
            return
        }

        $destSqlite = Get-ResolvedSqliteOutputDir $rawDest

        # Salvataggio preferenze
        $Config.DataFolder = $TxtData.Text.Trim()
        $Config.OutputDir = $rawDest
        $Config.OnlyCurrentSeason = $ChkOnlyCurrent.Checked
        $Config.SelectedFiles = $selected
        try { $Config | ConvertTo-Json -Depth 5 | Set-Content $ConfigFile -Encoding UTF8 } catch {}

        $BtnStart.Enabled = $false
        $ProgressBar.Value = 0
        $ProgressBar.Maximum = $selected.Count

        $sessionHeader = "`r`n================================================================================`r`n" +
                         "[" + (Get-Date).ToString("yyyy-MM-dd HH:mm:ss") + "] FCM SQLITE EXPORTER - AVVIO CONVERSIONE`r`n" +
                         "================================================================================"
        try { [System.IO.File]::AppendAllText($LogFilePath, "$sessionHeader`r`n", [System.Text.Encoding]::UTF8) } catch {}

        Add-LogMessage "Inizio conversione SQLite per $($selected.Count) stagioni..." $false
        Add-LogMessage "Cartella di destinazione SQLite: $destSqlite" $false
        Add-LogMessage "File di log persistente: $LogFilePath" $false

        if (-not (Test-Path -LiteralPath $destSqlite -ErrorAction SilentlyContinue)) {
            New-Item -ItemType Directory -Path $destSqlite -Force | Out-Null
        }

        $filesWithMeta = @()
        foreach ($f in $selected) {
            $m = Get-FcmMetadata $f
            $filesWithMeta += [PSCustomObject]@{ Path = $f; Stagione = if ($m.Valido) { $m.Stagione } else { 0 } }
        }
        $sortedSelected = $filesWithMeta | Sort-Object Stagione | Select-Object -ExpandProperty Path

        $step = 0
        $globalHadErrors = $false
        foreach ($fPath in $sortedSelected) {
            $step++
            $fName = Split-Path -Leaf $fPath
            Add-LogMessage "Elaborazione ($step/$($sortedSelected.Count)): $fName" $false
            $resExp = Export-FcmSeasonToSqlite $fPath $destSqlite {
                param($msg, $isErr)
                Add-LogMessage "  $msg" ($isErr -eq $true)
                if ($isErr -eq $true) { $script:globalHadErrors = $true }
            } $Config.DataFolder

            if ($null -eq $resExp -or -not $resExp.success) {
                $globalHadErrors = $true
            }
            $ProgressBar.Value = $step
        }

        # Invalida cache statistiche storiche se presente
        $cacheFile = Join-Path $destSqlite "statistiche_storiche.json"
        if (Test-Path -LiteralPath $cacheFile) { Remove-Item -LiteralPath $cacheFile -Force -ErrorAction SilentlyContinue }

        $BtnStart.Enabled = $true

        if ($globalHadErrors) {
            Add-LogMessage "CONVERSIONE COMPLETATA CON AVVISI O ERRORI. Verifica i dettagli nel file: $LogFilePath" $true
            [System.Windows.Forms.MessageBox]::Show($Form, "Conversione completata, ma si sono verificati errori o avvisi durante l'estrazione.`n`nConsulta il registro a video o apri il file di log per i dettagli:`n$LogFilePath", "Attenzione - Errori riscontrati", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning)
        }
        else {
            Add-LogMessage "COMPLETATO CON SUCCESSO! Tutti i database SQLite sono stati generati correttamente in: $destSqlite" $false
            [System.Windows.Forms.MessageBox]::Show($Form, "Conversione completata con successo!`n`nTutti i database SQLite sono pronti in:`n$destSqlite`n`nRegistro salvato in:`n$LogFilePath", "Fatto", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
            $Form.Close()
        }
    })
$Form.Controls.Add($BtnStart)

Update-FileList
[void]$Form.ShowDialog()
