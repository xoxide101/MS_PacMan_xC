import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const rootDir = process.cwd();

async function generateStandaloneHtml() {
  // 1. Bundle the entire 6-game React + Motion + 60fps Canvas ArcadeHub into a single IIFE script
  const result = await build({
    entryPoints: [path.join(rootDir, 'scripts', 'standalone-entry.tsx')],
    bundle: true,
    minify: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    jsx: 'automatic',
    tsconfig: path.join(rootDir, 'tsconfig.json'),
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  const jsFile = result.outputFiles.find((f) => f.path.endsWith('.js')) || result.outputFiles[0];
  if (!jsFile) {
    throw new Error('esbuild produced no JavaScript output.');
  }
  const safeJs = jsFile.text.replace(/<\/script>/gi, '<\\/script>');

  // 2. Collect compiled Tailwind v4 CSS emitted by Next.js build
  const cssDir = path.join(rootDir, '.next', 'static', 'css');
  let compiledCss = '';
  if (fs.existsSync(cssDir)) {
    const cssFiles = fs
      .readdirSync(cssDir)
      .filter((name) => name.endsWith('.css'))
      .sort();
    compiledCss = cssFiles
      .map((name) => fs.readFileSync(path.join(cssDir, name), 'utf8'))
      .join('\n');
  } else {
    throw new Error(
      'Compiled CSS directory .next/static/css not found. Run `npm run build` first.'
    );
  }

  const safeCss = compiledCss.replace(/<\/style>/gi, '<\\/style>');

  // 3. Assemble a 100% self-contained index.html that works offline via file:// or any static host
  const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <meta name="theme-color" content="#060811" />
  <title>Retro Arcade Collection — 87 Classic &amp; Evo Cabinets in 60fps HD</title>
  <meta name="description" content="Play 87 Golden Age and modern evolved arcade cabinets in crisp 60fps HiDPI with universal mouse steering, multi-touch virtual joystick, adaptive flip/fold/tablet/desktop layouts, and synthesized music." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600;700&family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --font-outfit: 'Outfit', system-ui, -apple-system, sans-serif;
      --font-jakarta: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      --font-jetbrains: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
      --font-mono: var(--font-jetbrains);
    }
    ${safeCss}
    html {
      margin: 0;
      padding: 0;
      background-color: #060811;
      color: #f1f5f9;
      overflow-x: clip;
      overflow-y: auto;
      height: auto;
    }
    body {
      margin: 0;
      padding: 0;
      background-color: #060811;
      color: #f1f5f9;
      font-family: var(--font-jakarta);
      -webkit-font-smoothing: antialiased;
      overflow: visible;
      min-height: 100%;
    }
    .font-mono {
      font-family: var(--font-jetbrains);
    }
  </style>
</head>
<body class="bg-[#060811] text-slate-100 antialiased selection:bg-amber-400/30 selection:text-amber-100">
  <div id="root"></div>
  <script>${safeJs}</script>
</body>
</html>
`;

  // Write root /index.html (main standalone start page)
  const rootIndexPath = path.join(rootDir, 'index.html');
  fs.writeFileSync(rootIndexPath, html, 'utf8');

  // Also write /public/arcade-index.html so visitors can download the standalone index.html right from the web app
  const publicDir = path.join(rootDir, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const publicDownloadPath = path.join(publicDir, 'arcade-index.html');
  fs.writeFileSync(publicDownloadPath, html, 'utf8');

  const sizeKb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log(
    `Generated standalone index.html (${sizeKb} KB) -> ${rootIndexPath} & ${publicDownloadPath}`
  );
}

generateStandaloneHtml().catch((err) => {
  console.error(err);
  process.exit(1);
});
