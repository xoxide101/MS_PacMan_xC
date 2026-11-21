import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';

const rootDir = process.cwd();

async function compileTailwindCss() {
  const globalsPath = path.join(rootDir, 'app', 'globals.css');
  const rawCss = fs.readFileSync(globalsPath, 'utf8');

  // Compile Tailwind v4 directly via @tailwindcss/postcss so standalone HTML ALWAYS
  // includes every utility class used in components/, independent of .next/ dev/build state.
  const processed = await postcss([
    tailwindcss({
      base: rootDir,
    }),
  ]).process(rawCss, {
    from: globalsPath,
  });

  const compiledCss = processed.css;
  if (!compiledCss || compiledCss.length < 10000) {
    throw new Error(
      `Tailwind CSS compilation produced unexpectedly small output (${compiledCss?.length ?? 0} bytes).`
    );
  }
  return compiledCss;
}

async function generateStandaloneHtml() {
  // 1. Bundle the entire 87-game React + Motion + 60fps Canvas ArcadeHub into a single IIFE script
  const [result, compiledCss] = await Promise.all([
    build({
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
    }),
    compileTailwindCss(),
  ]);

  const jsFile = result.outputFiles.find((f) => f.path.endsWith('.js')) || result.outputFiles[0];
  if (!jsFile) {
    throw new Error('esbuild produced no JavaScript output.');
  }
  const safeJs = jsFile.text.replace(/<\/script>/gi, '<\\/script>');
  const safeCss = compiledCss.replace(/<\/style>/gi, '<\\/style>');

  // 2. Assemble a 100% self-contained index.html that works offline via file:// or any static host
  const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <meta name="theme-color" content="#060811" />
  <title>Retro Arcade Collection — 87 Classic &amp; Evo Cabinets in 60fps HD</title>
  <meta name="description" content="Play 87 Golden Age and modern evolved arcade cabinets in crisp 60fps HiDPI with universal mouse steering, multi-touch virtual joystick, adaptive flip/fold/tablet/desktop layouts, and synthesized music." />
  <style>
    :root {
      --font-outfit: 'Outfit', 'Segoe UI', system-ui, -apple-system, sans-serif;
      --font-jakarta: 'Plus Jakarta Sans', 'Segoe UI', system-ui, -apple-system, sans-serif;
      --font-jetbrains: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      --font-mono: var(--font-jetbrains);
    }
    ${safeCss}
    html, body {
      margin: 0;
      padding: 0;
      background-color: #060811;
      color: #f1f5f9;
      font-family: var(--font-jakarta);
      -webkit-font-smoothing: antialiased;
    }
    .font-mono {
      font-family: var(--font-jetbrains);
    }
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .no-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
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
  const cssKb = (Buffer.byteLength(compiledCss, 'utf8') / 1024).toFixed(1);
  console.log(
    `Generated standalone index.html (${sizeKb} KB total, ${cssKb} KB compiled Tailwind CSS) -> ${rootIndexPath} & ${publicDownloadPath}`
  );
}

generateStandaloneHtml().catch((err) => {
  console.error(err);
  process.exit(1);
});
