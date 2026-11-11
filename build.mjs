#!/usr/bin/env node
/**
 * build.mjs —— 把 content.md + font.toml 编译成单文件 index.html
 *
 *   node build.mjs            构建一次
 *   node build.mjs --watch    监听 content.md / font.toml / style.css，改动即重建
 *   node build.mjs --serve    构建后起一个本地静态服务器（默认 4173 端口）
 *   node build.mjs --open     构建后尝试用系统默认浏览器打开
 *
 * 依赖：只用 Node 标准库。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { exec, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FILE = {
  config: path.join(ROOT, 'font.toml'),
  source: path.join(ROOT, 'content.md'),
  style: path.join(ROOT, 'style.css'),
  app: path.join(ROOT, 'app.js'),
  output: path.join(ROOT, 'index.html'),
};

/* ==========================================================================
 * 1. 极简 TOML 解析（覆盖本配置需要的子集：表、数组表、字符串、数字、
 *    布尔、数组、内联注释、点号键）
 * ========================================================================== */

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (quote === '"' && ch === '\\') i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '#') {
      return line.slice(0, i);
    }
  }
  return line;
}

function splitTopLevel(text, sep) {
  const parts = [];
  let current = '';
  let quote = null;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      current += ch;
      if (quote === '"' && ch === '\\') {
        current += text[++i] ?? '';
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '[' || ch === '{') depth++;
    if (ch === ']' || ch === '}') depth--;
    if (ch === sep && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

function parseTomlValue(raw) {
  const value = raw.trim();
  if (value === '') return '';

  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1);
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return splitTopLevel(inner, ',').map((item) => parseTomlValue(item));
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  const num = value.replace(/_/g, '');
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(num)) return Number(num);
  return value;
}

function parseToml(text) {
  const root = {};
  let table = root;

  for (const rawLine of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;

    const arrayTable = /^\[\[\s*(.+?)\s*\]\]$/.exec(line);
    if (arrayTable) {
      const keys = splitTopLevel(arrayTable[1], '.').map((k) => k.trim().replace(/^["']|["']$/g, ''));
      let parent = root;
      for (const key of keys.slice(0, -1)) {
        parent[key] ??= {};
        parent = parent[key];
      }
      const last = keys[keys.length - 1];
      parent[last] ??= [];
      const entry = {};
      parent[last].push(entry);
      table = entry;
      continue;
    }

    const header = /^\[\s*(.+?)\s*\]$/.exec(line);
    if (header) {
      const keys = splitTopLevel(header[1], '.').map((k) => k.trim().replace(/^["']|["']$/g, ''));
      let parent = root;
      for (const key of keys) {
        if (typeof parent[key] !== 'object' || parent[key] === null || Array.isArray(parent[key])) {
          parent[key] = {};
        }
        parent = parent[key];
      }
      table = parent;
      continue;
    }

    const eq = splitTopLevel(line, '=');
    if (eq.length < 2) continue;
    const keyPart = eq[0].trim();
    const valuePart = eq.slice(1).join('=');
    const keys = splitTopLevel(keyPart, '.').map((k) => k.trim().replace(/^["']|["']$/g, ''));
    let target = table;
    for (const key of keys.slice(0, -1)) {
      target[key] ??= {};
      target = target[key];
    }
    target[keys[keys.length - 1]] = parseTomlValue(valuePart);
  }

  return root;
}

/* ==========================================================================
 * 2. Markdown 渲染（标题、段落、强调、行内代码、列表、引用、代码块、
 *    分隔线、表格、链接、图片、<br>）
 * ========================================================================== */

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInline(text) {
  const codes = [];
  const breaks = [];

  let out = text.replace(/`([^`\n]+)`/g, (_, code) => {
    codes.push(escapeHtml(code.replace(/\\\|/g, '|')));
    return `\u0000${codes.length - 1}\u0000`;
  });

  out = out.replace(/<br\s*\/?>/gi, () => {
    breaks.push('<br>');
    return `\u0001${breaks.length - 1}\u0001`;
  });

  out = escapeHtml(out);

  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  out = out.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__(.+?)__/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^\w*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^\w])_([^_\n]+?)_(?![\w])/g, '$1<em>$2</em>');
  out = out.replace(/~~(.+?)~~/g, '<del>$1</del>');

  out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
  out = out.replace(/\u0001(\d+)\u0001/g, (_, i) => breaks[Number(i)]);
  return out;
}

function slugify(text) {
  const plain = text.replace(/[`*_~[\]]/g, '').trim().toLowerCase();
  return plain.replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-') || 'section';
}

function splitTableRow(line) {
  let body = line.trim();
  if (body.startsWith('|')) body = body.slice(1);
  if (body.endsWith('|') && !body.endsWith('\\|')) body = body.slice(0, -1);

  const cells = [];
  let cell = '';
  let inCode = false;
  let escaped = false;

  for (const ch of body) {
    if (escaped) {
      cell += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '`') {
      inCode = !inCode;
      cell += ch;
      continue;
    }
    if (ch === '|' && !inCode) {
      cells.push(cell.trim());
      cell = '';
      continue;
    }
    cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

const isTableDelimiter = (line) => line.includes('|') && /^\s*\|?[\s:-]*-[\s:|-]*$/.test(line) && line.includes('-');

function renderTable(headerLine, delimiterLine, rowLines) {
  const header = splitTableRow(headerLine);
  const aligns = splitTableRow(delimiterLine).map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'al-c';
    if (right) return 'al-r';
    return '';
  });

  const cls = (index) => (aligns[index] ? ` class="${aligns[index]}"` : '');

  const head = header.map((cell, i) => `<th${cls(i)}>${renderInline(cell)}</th>`).join('');
  const body = rowLines
    .map((line) => {
      const cells = splitTableRow(line);
      const tds = header
        .map((_, i) => `<td${cls(i)}>${renderInline(cells[i] ?? '')}</td>`)
        .join('');
      return `<tr>${tds}</tr>`;
    })
    .join('\n');

  return `<div class="tablewrap"><table>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table></div>`;
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let paragraph = [];
  let i = 0;

  const flush = () => {
    if (!paragraph.length) return;
    out.push(`<p>${renderInline(paragraph.join('\n'))}</p>`);
    paragraph = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      flush();
      const lang = line.replace(/^\s*```/, '').trim();
      const buffer = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buffer.push(lines[i++]);
      i++;
      const code = escapeHtml(buffer.join('\n'));
      out.push(`<pre><code${lang ? ` class="lang-${escapeHtml(lang)}"` : ''}>${code}</code></pre>`);
      continue;
    }

    if (!line.trim()) {
      flush();
      i++;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*?)\s*#*$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      const text = heading[2];
      out.push(`<h${level} id="${escapeHtml(slugify(text))}">${renderInline(text)}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line) && !line.includes('|')) {
      flush();
      out.push('<hr>');
      i++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      flush();
      const buffer = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buffer.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${renderMarkdown(buffer.join('\n'))}</blockquote>`);
      continue;
    }

    if (i + 1 < lines.length && line.includes('|') && isTableDelimiter(lines[i + 1])) {
      flush();
      const headerLine = line;
      const delimiterLine = lines[i + 1];
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        rows.push(lines[i]);
        i++;
      }
      out.push(renderTable(headerLine, delimiterLine, rows));
      continue;
    }

    const listMatch = /^\s*([-*+]|\d+[.)])\s+/.exec(line);
    if (listMatch) {
      flush();
      const ordered = /\d/.test(listMatch[1]);
      const items = [];
      while (i < lines.length) {
        const itemMatch = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (itemMatch) {
          items.push([itemMatch[2]]);
          i++;
        } else if (lines[i].trim() && items.length && /^\s{2,}\S/.test(lines[i])) {
          items[items.length - 1].push(lines[i].trim());
          i++;
        } else {
          break;
        }
      }
      const tag = ordered ? 'ol' : 'ul';
      const body = items
        .map((parts) => `<li>${renderInline(parts.join('\n'))}</li>`)
        .join('\n');
      out.push(`<${tag}>\n${body}\n</${tag}>`);
      continue;
    }

    paragraph.push(line);
    i++;
  }

  flush();
  return out.join('\n');
}

/* ==========================================================================
 * 3. 从 font.toml 生成 CSS 变量与 @font-face
 * ========================================================================== */

const GENERIC_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math',
  'fangsong', 'inherit', 'initial',
]);

function familyList(stack) {
  return String(stack ?? '')
    .split(',')
    .map((name) => name.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function pick(value, fallback) {
  return value === undefined || value === null || value === '' ? fallback : value;
}

/**
 * 去掉字体栈里的通用族（serif / sans-serif / monospace …）。
 * 拼接「西文栈 + 中文栈」时必须先去掉西文栈末尾的通用族，
 * 否则回退链在那里就终止了，后面的中文字体永远不会被用到。
 */
function dropGenerics(stack) {
  return String(stack ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name && !GENERIC_FAMILIES.has(name.replace(/^["']|["']$/g, '').toLowerCase()))
    .join(', ');
}

function buildStyle(cfg) {
  const base = cfg.base ?? {};
  const headings = cfg.headings ?? {};
  const style = cfg.style ?? {};
  const features = cfg.features ?? {};

  const latin = pick(base.latin, "'Helvetica Neue', Arial, sans-serif");
  const cjk = pick(base.cjk, "'PingFang SC', 'Microsoft YaHei', sans-serif");
  const mono = pick(base.mono, "ui-monospace, 'SF Mono', Menlo, Consolas, monospace");
  // 统一字体：非空时中西文共用这一个字体栈，忽略 latin / cjk
  const unifiedRaw = typeof base.unified === 'string' ? base.unified.trim() : '';
  const unified = unifiedRaw ? dropGenerics(unifiedRaw) || unifiedRaw : '';

  const textStack = unified
    ? unified
    : [dropGenerics(latin), cjk].filter(Boolean).join(', ');
  const headStack = unified
    ? unified
    : [dropGenerics(pick(headings.latin, latin)), pick(headings.cjk, cjk)]
        .filter(Boolean)
        .join(', ');

  const size = pick(base.size, '18px');
  const lineHeight = pick(base['line-height'], 1.9);
  const letterSpacing = pick(base['letter-spacing'], '0.01em');
  const align = pick(base['text-align'], 'left');

  const featureParts = [];
  if (features.ligatures === false) featureParts.push('"liga" 0', '"calt" 0');
  else featureParts.push('"liga" 1', '"calt" 1');
  if (features['tabular-numbers'] === true) featureParts.push('"tnum" 1');
  featureParts.push('"kern" 1');

  const numericSize = parseFloat(size) || 18;

  const vars = `:root {
  --bg: ${pick(style.background, '#f6f4ef')};
  --card: ${pick(style.card, '#fffdf9')};
  --fg: ${pick(style.foreground, '#191919')};
  --muted: ${pick(style.muted, '#6b6660')};
  --accent: ${pick(style.accent, '#9a3412')};
  --rule: ${pick(style.rule, '#e2ddd3')};
  --code-bg: ${pick(style['code-bg'], '#eee9dd')};
  --measure: ${pick(style.measure, '46rem')};

  --font-text: ${textStack};
  --font-head: ${headStack};
  --font-mono: ${mono};

  --fs: ${size};
  --lh: ${lineHeight};
  --ls: ${letterSpacing};
  --align: ${align};
  --fw-bold: ${pick(base['bold-weight'], 700)};
  --fw-head: ${pick(headings.weight, 600)};
  --features: ${featureParts.join(', ')};
}`;

  const faces = [].concat(cfg.face ?? [], cfg.faces ?? []);
  const faceCss = faces
    .filter((face) => face && face.family && (face.file || face.path))
    .map((face) => {
      const src = face.file ?? face.path;
      return `@font-face {\n  font-family: "${face.family}";\n  src: url("${src}");\n  font-weight: ${pick(face.weight, 400)};\n  font-style: ${pick(face.style, 'normal')};\n  font-display: swap;\n}`;
    })
    .join('\n');

  const families = [
    ...new Set([
      ...familyList(unified || latin),
      ...familyList(cjk),
      ...familyList(mono),
    ]),
  ].filter((name) => !GENERIC_FAMILIES.has(name.toLowerCase()) && !name.startsWith('-'));

  return {
    css: `${faceCss}\n\n${vars}`,
    latin,
    cjk,
    mono,
    unified,
    families,
    size,
    sizePx: numericSize,
    lineHeight,
    lineHeightNum: Number(lineHeight) || 1.9,
  };
}

/* ==========================================================================
 * 4. 组装 HTML
 * ========================================================================== */


function buildHtml({ cfg, markdown, styleCss, style, appJs }) {
  const title = (cfg.meta && cfg.meta.title) || '字体测试样张';
  const body = renderMarkdown(markdown);
  const defaults = {
    latin: style.latin,
    cjk: style.cjk,
    mono: style.mono,
    unified: style.unified,
    families: style.families,
    size: style.size,
    lineHeight: style.lineHeightNum,
    tabularNumbers: Boolean(cfg.features && cfg.features['tabular-numbers']),
  };
  const shownLatin = style.unified || style.latin;
  const shownCjk = style.unified || style.cjk;

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="icon" href="data:,">
<style>
${style.css}

${styleCss}
</style>
</head>
<body>
<header class="topbar">
  <span class="brand">${escapeHtml(title)}</span>
  <div class="controls">
    <label><span>字号</span><input id="ctl-size" type="range" min="13" max="32" step="0.5" value="${style.sizePx}"><b id="ctl-size-val">${style.size}</b></label>
    <label><span>行高</span><input id="ctl-lh" type="range" min="1.2" max="2.6" step="0.05" value="${style.lineHeightNum}"><b id="ctl-lh-val">${style.lineHeightNum.toFixed(2)}</b></label>
    <label><input id="ctl-tnum" type="checkbox"${cfg.features && cfg.features['tabular-numbers'] ? ' checked' : ''}> 等宽数字</label>
    <button id="ctl-reset" type="button">重置</button>
    <button id="btn-font-panel" type="button" class="primary">字体…</button>
  </div>
</header>

<div class="stackline">
  <span title="${escapeHtml(shownLatin)}">西文 <code id="stack-latin">${escapeHtml(shownLatin)}</code></span>
  <span title="${escapeHtml(shownCjk)}">中文 <code id="stack-cjk">${escapeHtml(shownCjk)}</code></span>
</div>

<dialog class="panel" id="font-panel">
  <div class="panel-head">
    <strong>字体控制</strong>
    <form method="dialog"><button class="panel-close" aria-label="关闭">×</button></form>
  </div>
  <div class="panel-slots">
    <span class="panel-label">正在设置</span>
    <button type="button" class="slot" data-slot="latin" aria-pressed="true">西文</button>
    <button type="button" class="slot" data-slot="cjk" aria-pressed="false">中文</button>
    <button type="button" class="slot" data-slot="both" aria-pressed="false">中西统一</button>
    <span class="slot-current" id="slot-current"></span>
  </div>
  <div class="panel-tools">
    <input id="font-search" type="search" placeholder="搜索字体名…" spellcheck="false">
    <button type="button" id="btn-detect">检测系统字体</button>
    <button type="button" id="btn-file">载入字体文件…</button>
    <button type="button" id="btn-reveal" hidden>打开字体文件夹</button>
    <button type="button" id="btn-reset">恢复 font.toml</button>
  </div>
  <p class="panel-source" id="panel-source">点击「检测系统字体」枚举本机字体；也可直接拖拽字体文件到页面。</p>
  <ul class="flist" id="font-list"></ul>
  <div class="panel-foot">
    <span id="panel-count"></span>
    <span id="panel-status"></span>
  </div>
  <input type="file" id="file-input" accept=".woff2,.woff,.ttf,.otf,.ttc" multiple hidden>
</dialog>

<main class="sheet">
${body}
</main>

<footer class="foot">
  <div class="foot-title">字体族可用性（浏览器实测，绿=本机已安装，红=回退到后继字体）</div>
  <ul class="fontlist" id="fontlist"></ul>
  <div class="foot-note">内容 content.md ／ 配置 font.toml ／ 生成 node build.mjs</div>
</footer>

<script>
const DEFAULTS = ${JSON.stringify(defaults)};
${appJs}
</script>
</body>
</html>
`;
}

/* ==========================================================================
 * 5. 构建 / 监听 / 静态服务
 * ========================================================================== */

function build({ quiet = false } = {}) {
  const started = Date.now();
  const cfg = parseToml(fs.readFileSync(FILE.config, 'utf8'));
  const markdown = fs.readFileSync(FILE.source, 'utf8');
  const styleCss = fs.readFileSync(FILE.style, 'utf8');
  const appJs = fs.readFileSync(FILE.app, 'utf8');

  const style = buildStyle(cfg);
  const html = buildHtml({ cfg, markdown, styleCss, style, appJs });
  fs.writeFileSync(FILE.output, html, 'utf8');

  if (!quiet) {
    const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
    console.log(`✓ index.html  ${kb} KB  ${Date.now() - started}ms`);
    console.log(`  西文 ${style.latin}`);
    console.log(`  中文 ${style.cjk}`);
  }
  return style;
}

function watch() {
  build();
  console.log('👀 监听 content.md / font.toml / style.css / app.js …（Ctrl+C 退出）');
  let timer = null;
  const watched = [FILE.config, FILE.source, FILE.style, FILE.app];
  for (const file of watched) {
    fs.watch(file, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          build();
        } catch (error) {
          console.error(`✗ 构建失败：${error.message}`);
        }
      }, 80);
    });
  }
}

/* ------------------------------------------------- 本机字体目录 / 资源管理器 */

function fontDirs() {
  const exists = (dir) => {
    try {
      return fs.statSync(dir).isDirectory();
    } catch {
      return false;
    }
  };

  const candidates =
    process.platform === 'win32'
      ? [
          path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts'),
          process.env.LOCALAPPDATA
            ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts')
            : '',
        ]
      : process.platform === 'darwin'
        ? [
            '/System/Library/Fonts',
            '/Library/Fonts',
            path.join(os.homedir(), 'Library', 'Fonts'),
          ]
        : [
            path.join(os.homedir(), '.local', 'share', 'fonts'),
            path.join(os.homedir(), '.fonts'),
            '/usr/share/fonts',
            '/usr/local/share/fonts',
          ];

  return candidates.filter((dir) => dir && exists(dir));
}

function revealInFileManager(dir) {
  const allowed = fontDirs();
  if (!allowed.includes(dir)) {
    return { ok: false, error: '只允许打开本机字体目录' };
  }
  const command =
    process.platform === 'win32'
      ? ['explorer.exe', [dir]]
      : process.platform === 'darwin'
        ? ['open', [dir]]
        : ['xdg-open', [dir]];
  const child = spawn(command[0], command[1], { detached: true, stdio: 'ignore' });
  child.on('error', () => {});
  child.unref();
  return { ok: true, dir };
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function handleApi(req, res) {
  const route = (req.url || '').split('?')[0];

  if (route === '/api/health') {
    json(res, 200, { ok: true, platform: process.platform, fontDirs: fontDirs() });
    return true;
  }

  if (route === '/api/reveal') {
    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: '请使用 POST' });
      return true;
    }
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 4096) req.destroy();
    });
    req.on('end', () => {
      let dir = fontDirs()[0];
      try {
        const parsed = JSON.parse(body || '{}');
        if (typeof parsed.dir === 'string' && parsed.dir) dir = parsed.dir;
      } catch {
        /* 用默认字体目录 */
      }
      json(res, 200, revealInFileManager(dir));
    });
    return true;
  }

  return false;
}

function serve(port) {
  build({ quiet: true });
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.ttc': 'font/collection',
    '.md': 'text/plain; charset=utf-8',
    '.toml': 'text/plain; charset=utf-8',
  };

  http
    .createServer((req, res) => {
      if ((req.url || '').startsWith('/api/') && handleApi(req, res)) return;

      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
      if (!path.resolve(file).startsWith(ROOT)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      fs.readFile(file, (error, buffer) => {
        if (error) {
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
          return;
        }
        res.writeHead(200, {
          'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'cache-control': 'no-store',
        });
        res.end(buffer);
      });
    })
    .listen(port, '127.0.0.1', () => {
      console.log(`🌐 http://localhost:${port}/`);
      const dirs = fontDirs();
      if (dirs.length) console.log(`   字体目录 ${dirs.join(' ／ ')}`);
    });
}

const args = new Set(process.argv.slice(2));

if (args.has('--watch')) {
  watch();
} else {
  build();
  if (args.has('--open')) {
    const target = path.relative(process.cwd(), FILE.output) || FILE.output;
    const command =
      process.platform === 'win32'
        ? `start "" "${FILE.output}"`
        : process.platform === 'darwin'
          ? `open "${target}"`
          : `xdg-open "${target}"`;
    exec(command, () => {});
  }
  if (args.has('--serve')) {
    const portIndex = [...args].findIndex((arg) => arg === '--serve');
    const next = [...args][portIndex + 1];
    serve(Number(next) > 0 ? Number(next) : 4173);
  }
}
