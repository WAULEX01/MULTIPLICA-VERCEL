# deploy-filebrowser.ps1
# Faz upload da v6.5.2 para o public_html via API do File Browser da Hostinger.
# Uso:
#   1. No browser integrado (hPanel logado), gerar o link do file browser:
#      fetch('/api/wh-api/api/hapi/v1/accounts/u753364261/file-browser-link?vhost=multiplicaplus.com.br&locale=en_GB', {credentials:'include'})
#      -> pegar j.data.link (ex: https://srv1845-files.hstgr.io/auth?token=XXX)
#   2. Rodar:  .\scripts\deploy-filebrowser.ps1 -Token "XXX"
# O script faz: auth (captura subpath + cookie) -> login proxy (JWT) -> upload dos arquivos.

param(
    [Parameter(Mandatory=$true)][string]$Token
)

$ErrorActionPreference = "Stop"
$base = "https://srv1845-files.hstgr.io"
$dist = "c:\Users\Lenovo\OneDrive - waulex\Documentos\projeto\dist"
$jar = Join-Path $env:TEMP "fb_deploy_$PID.txt"
Remove-Item $jar -ErrorAction SilentlyContinue

Write-Host "=== [1/4] AUTH ===" -ForegroundColor Cyan
$resp = curl.exe -s -c $jar -D - -o NUL --max-time 20 "$base/auth?token=$Token"
$loc = ($resp | Where-Object { $_ -like "Location:*" }) -replace "Location: ","" -replace "`r","" | Select-Object -First 1
if (-not $loc) {
    Write-Host "AUTH FALHOU. Resposta:" -ForegroundColor Red
    $resp
    exit 1
}
Write-Host "SUBPATH: $loc"

Write-Host "=== [2/4] LOGIN PROXY ===" -ForegroundColor Cyan
$jwt = curl.exe -s -b $jar -X POST --max-time 20 "$base$loc/api/login" -H "Content-Type: application/json" -d '{"username":"","password":""}'
if ($jwt.Length -lt 50) {
    Write-Host "LOGIN FALHOU: $jwt" -ForegroundColor Red
    exit 1
}
Write-Host "JWT OK ($($jwt.Length) chars)"

function FB-Upload($rel, $ct) {
    $local = Join-Path $dist $rel
    if (-not (Test-Path $local)) { Write-Host "SKIP $rel (nao existe localmente)" -ForegroundColor DarkGray; return }
    $url = "$base$loc/api/resources/public_html/$rel"
    Write-Host "PUT $rel ($((Get-Item $local).Length) bytes)..." -ForegroundColor Yellow
    $code = curl.exe -s -b $jar -X PUT --max-time 300 $url -H "X-Auth: $jwt" -H "Content-Type: $ct" --data-binary "@$local" -o NUL -w "%{http_code}"
    if ($code -eq "200") {
        Write-Host "  OK" -ForegroundColor Green
    } else {
        Write-Host "  FALHOU (HTTP $code) - tentando TUS..." -ForegroundColor Magenta
        # TUS: POST /api/tus<path>?override=true cria o upload; depois PATCH com Upload-Offset
        $tusUrl = "$base$loc/api/tus/public_html/$rel`?override=true"
        $size = (Get-Item $local).Length
        $create = curl.exe -s -b $jar -X POST $tusUrl -H "X-Auth: $jwt" -H "Tus-Resumable: 1.0.0" -H "Upload-Length: $size" -H "Upload-Metadata: filename $([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($rel)))" -D - -o NUL
        $uploadUrl = ($create | Where-Object { $_ -like "Location:*" }) -replace "Location: ","" -replace "`r","" | Select-Object -First 1
        if ($uploadUrl) {
            Write-Host "  TUS upload URL criado, enviando chunks..."
            # Envia em chunks de 10MB
            $offset = 0
            $fs = [System.IO.File]::OpenRead($local)
            $buf = New-Object byte[] 10485760
            try {
                while ($offset -lt $size) {
                    $read = $fs.Read($buf, 0, $buf.Length)
                    if ($read -eq 0) { break }
                    $chunk = New-Object byte[] $read
                    [Array]::Copy($buf, 0, $chunk, 0, $read)
                    $tmp = Join-Path $env:TEMP "fb_chunk_$PID.bin"
                    [System.IO.File]::WriteAllBytes($tmp, $chunk)
                    $patch = curl.exe -s -b $jar -X PATCH $uploadUrl -H "X-Auth: $jwt" -H "Tus-Resumable: 1.0.0" -H "Upload-Offset: $offset" -H "Content-Type: application/offset+octet-stream" --data-binary "@$tmp" -o NUL -w "%{http_code}"
                    Remove-Item $tmp -ErrorAction SilentlyContinue
                    if ($patch -ne "204" -and $patch -ne "200") {
                        Write-Host "  TUS PATCH falhou em $offset (HTTP $patch)" -ForegroundColor Red
                        break
                    }
                    $offset += $read
                    Write-Host "  chunk $offset / $size"
                }
                if ($offset -ge $size) { Write-Host "  TUS OK" -ForegroundColor Green }
            } finally {
                $fs.Close()
            }
        } else {
            Write-Host "  TUS create falhou: $create" -ForegroundColor Red
        }
    }
}

Write-Host "=== [3/4] UPLOADS ===" -ForegroundColor Cyan
# Ordem: JS grande primeiro (mais critico), depois o resto
FB-Upload "assets/index-CYjMuV8P.js" "application/javascript"
FB-Upload "assets/index-C0eeKsYa.css" "text/css"
FB-Upload "index.html" "text/html"
FB-Upload "api.php" "application/x-httpd-php"
FB-Upload "sw.js" "application/javascript"
FB-Upload "manifest.json" "application/json"
FB-Upload "logo.png" "image/png"
FB-Upload "banner.jpg" "image/jpeg"
FB-Upload "favicon.svg" "image/svg+xml"
FB-Upload "icons.svg" "image/svg+xml"
FB-Upload ".htaccess" "text/plain"

Write-Host "=== [4/4] VERIFICACAO ===" -ForegroundColor Cyan
$out = Join-Path $env:TEMP "fb_verify_$PID.json"
curl.exe -s -b $jar --max-time 25 "$base$loc/api/resources/public_html/assets/" -H "X-Auth: $jwt" -H "Accept: application/json" -H "X-Encoding: false" -o $out
$j = Get-Content $out -Raw | ConvertFrom-Json
$j.items | ForEach-Object { Write-Host "  $($_.name)  $($_.size)" }

Write-Host ""
Write-Host "Concluido. Verifique o site em https://multiplicaplus.com.br" -ForegroundColor Green
