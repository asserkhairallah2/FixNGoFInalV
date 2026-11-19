@echo off
title FixNGo Localhost Server (http://localhost:3000)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$raw = [System.IO.File]::ReadAllText('%~f0'); $ps = ($raw -split '# --- PS_START ---\r?\n')[1]; Invoke-Expression $ps"
pause
exit /b
# --- PS_START ---
$port = 3000
$listener = $null
foreach ($p in 3000..3010) {
  try {
    $l = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
    $l.Server.SetSocketOption([System.Net.Sockets.SocketOptionLevel]::Socket, [System.Net.Sockets.SocketOptionName]::ReuseAddress, $true)
    $l.Start(50)
    $listener = $l
    $port = $p
    break
  } catch {}
}

$url = "http://localhost:$port"
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  FixNGo Complete Interactive App (138 Screens)" -ForegroundColor White
Write-Host "  Running at: $url" -ForegroundColor Green
Write-Host "  Keep this window open. Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Cyan

Start-Process $url

$html = @"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FixNGo · Complete Interactive App (138 Screens)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #EEF2F6; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.35); border-radius: 9999px; }
  </style>
</head>
<body>
  <div id="root">
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#334155;font-weight:700;">
      Loading FixNGo (138 Screens)...
    </div>
  </div>

  <script type="module">
    import React from 'https://esm.sh/react@18.3.1';
    import * as JsxRuntime from 'https://esm.sh/react@18.3.1/jsx-runtime';
    import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';
    import * as LucideIcons from 'https://esm.sh/lucide-react@0.460.0?deps=react@18.3.1';

    const FallbackIcon = ({ size = 16, className = '' }) =>
      React.createElement(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          className
        },
        React.createElement('circle', { cx: 12, cy: 12, r: 9 })
      );

    const LucideProxy = new Proxy(LucideIcons, {
      get(target, prop) {
        if (prop === '__esModule') return true;
        return target[prop] || FallbackIcon;
      }
    });

    const files = [
      '01_AuthOnboarding.js',
      '02_CarOwner.js',
      '03_Mechanic.js',
      '04_TowCaptain.js',
      '05_ServiceCenter.js',
      '06_Admin.js',
      '07_SharedSettings.js',
      'fixngo_complete_interactive_app.js'
    ];

    async function boot() {
      try {
        const moduleExports = {};
        const customRequire = (id) => {
          if (id === 'react') return React;
          if (id === 'react/jsx-runtime' || id === 'react/jsx-dev-runtime') return JsxRuntime;
          if (id === 'lucide-react') return LucideProxy;
          const clean = id.replace(/^\.\//, '').replace(/\.js$/, '') + '.js';
          if (moduleExports[clean]) return moduleExports[clean];
          throw new Error('Module not found: ' + id);
        };

        for (const file of files) {
          const res = await fetch('/' + file + '?t=' + Date.now());
          if (!res.ok) throw new Error('Failed to load ' + file);
          const source = await res.text();
          const compiled = window.Babel.transform(source, {
            presets: [['react', { runtime: 'classic' }]],
            plugins: ['transform-modules-commonjs'],
            filename: file
          }).code;

          const mod = { exports: {} };
          const fn = new Function('require', 'module', 'exports', 'React', compiled);
          fn(customRequire, mod, mod.exports, React);
          moduleExports[file] = mod.exports;
        }

        const App = moduleExports['fixngo_complete_interactive_app.js'].default;
        const root = createRoot(document.getElementById('root'));
        root.render(React.createElement(App));
      } catch (err) {
        console.error(err);
        document.getElementById('root').innerHTML =
          '<div style="padding:24px;color:#E51C23;font-family:monospace;white-space:pre-wrap;">Error loading FixNGo:\n' +
          err.message +
          '</div>';
      }
    }

    boot();
  </script>
</body>
</html>
"@

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $requestLine = $reader.ReadLine()
    while ($line = $reader.ReadLine()) {
      if ($line -eq '') { break }
    }
    if ($requestLine) {
      $parts = $requestLine.Split(' ')
      $rawPath = if ($parts.Length -gt 1) { $parts[1] } else { '/' }
      $cleanPath = ($rawPath -split '\?')[0].TrimStart('/')
      $cleanPath = [System.Uri]::UnescapeDataString($cleanPath)

      $status = '200 OK'
      $contentType = 'text/html; charset=utf-8'
      $bytes = [byte[]]@()

      if ($cleanPath -eq '' -or $cleanPath -eq 'index.html') {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($html)
      } elseif ($cleanPath -eq 'favicon.ico') {
        $status = '204 No Content'
      } elseif (Test-Path -LiteralPath $cleanPath -PathType Leaf) {
        if ($cleanPath.EndsWith('.js')) { $contentType = 'application/javascript; charset=utf-8' }
        elseif ($cleanPath.EndsWith('.jpg') -or $cleanPath.EndsWith('.jpeg')) { $contentType = 'image/jpeg' }
        elseif ($cleanPath.EndsWith('.png')) { $contentType = 'image/png' }
        $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $cleanPath))
      } else {
        $status = '404 Not Found'
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
      }

      $header = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      if ($bytes.Length -gt 0) {
        $stream.Write($bytes, 0, $bytes.Length)
      }
      $stream.Flush()
    }
  } catch {} finally {
    $client.Close()
  }
}