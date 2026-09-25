# Erzeugt sw.js mit der Liste aller Dateien fuer den Offline-Betrieb.
# Nach jeder Aenderung an der App ausfuehren, dann bekommen installierte Apps das Update.
# Aufruf: powershell -ExecutionPolicy Bypass -File tools\build-sw.ps1
$root = Split-Path $PSScriptRoot -Parent
$skip = @('tools', '.claude')
$files = Get-ChildItem $root -Recurse -File | Where-Object {
  $rel = $_.FullName.Substring($root.Length + 1)
  $top = $rel.Split('\')[0]
  ($skip -notcontains $top) -and ($rel -ne 'sw.js') -and ($rel -notlike '*.md') -and ($rel -notlike '*.txt')
} | ForEach-Object { $_.FullName.Substring($root.Length + 1).Replace('\', '/') } | Sort-Object

# Version aus dem Inhalt aller Dateien, damit sich der Cache nur bei echten Aenderungen erneuert
$sha = [System.Security.Cryptography.SHA256]::Create()
$ms = New-Object System.IO.MemoryStream
foreach ($f in $files) { $b = [System.IO.File]::ReadAllBytes((Join-Path $root $f)); $ms.Write($b, 0, $b.Length) }
$hash = ($sha.ComputeHash($ms.ToArray()) | ForEach-Object { $_.ToString('x2') }) -join ''
$version = 'wiw-' + $hash.Substring(0, 12)

$list = ($files | ForEach-Object { "  './$_'" }) -join ",`n"
$sw = @"
/* Wo ist was - Service Worker: macht die App offline nutzbar. Automatisch erzeugt von tools/build-sw.ps1 */
const CACHE = '$version';
const ASSETS = [
  './',
$list
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('wiw-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req))
  );
});
"@
[System.IO.File]::WriteAllText((Join-Path $root 'sw.js'), $sw, (New-Object System.Text.UTF8Encoding $false))
"sw.js geschrieben: $($files.Count) Dateien, Version $version"
