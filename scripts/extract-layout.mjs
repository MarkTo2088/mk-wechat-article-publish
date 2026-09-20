// scripts/extract-layout.mjs — 从对标公众号链接提炼排版（不保存正文）
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { findWorkspaceRoot, patchLocalConfig } from './lib/local-config.mjs';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function decodeBasic(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function rgbToHex(r, g, b) {
  const h = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function normalizeColor(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s || s === 'transparent' || s === 'inherit' || s === 'initial') return null;
  const hex = s.match(/#([0-9a-f]{3,8})/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (h.length >= 6) return `#${h.slice(0, 6)}`;
  }
  const rgb = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) return rgbToHex(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
  return null;
}

function chroma(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (max - min) / 255;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function isBrandColor(hex) {
  if (!hex) return false;
  const c = chroma(hex);
  const l = luminance(hex);
  return c >= 0.12 && l > 0.08 && l < 0.92;
}

function topKey(map) {
  let best = '';
  let n = 0;
  for (const [k, v] of map) {
    if (v > n) {
      best = k;
      n = v;
    }
  }
  return best;
}

function add(map, key, n = 1) {
  if (!key || !n) return;
  map.set(key, (map.get(key) || 0) + n);
}

/** 取出 id 对应元素的内部 HTML（按 div 深度） */
export function extractDivInner(html, id) {
  const re = new RegExp(`id=["']${id}["']`, 'i');
  const m = re.exec(html);
  if (!m) return '';
  const gt = html.indexOf('>', m.index);
  if (gt < 0) return '';
  let i = gt + 1;
  let depth = 1;
  const lower = html.toLowerCase();
  while (i < html.length && depth > 0) {
    const nextOpen = lower.indexOf('<div', i);
    const nextClose = lower.indexOf('</div', i);
    if (nextClose < 0) break;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
    } else {
      depth -= 1;
      if (depth === 0) return html.slice(gt + 1, nextClose);
      i = nextClose + 5;
    }
  }
  return '';
}

function metaContent(html, key) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
    'i'
  );
  const m = html.match(re) || html.match(re2);
  return m ? decodeBasic(m[1]) : '';
}

function jsVar(html, name) {
  const re = new RegExp(
    `var\\s+${name}\\s*=\\s*(?:htmlDecode\\()?["']([^"']*)["']`,
    'i'
  );
  const m = html.match(re);
  return m ? decodeBasic(m[1]) : '';
}

function parseStyle(attr) {
  const sm = String(attr || '').match(/style=["']([^"']*)["']/i);
  if (!sm) return {};
  const out = {};
  for (const part of sm[1].split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).trim().toLowerCase();
    const v = part.slice(i + 1).trim().toLowerCase();
    if (k) out[k] = v;
  }
  return out;
}

/**
 * @param {string} html 完整页面或正文 HTML
 * @param {{ sourceUrl?: string }} [meta]
 */
export function analyzeLayout(html, meta = {}) {
  const content = extractDivInner(html, 'js_content') || html;
  const title =
    jsVar(html, 'msg_title') ||
    metaContent(html, 'og:title') ||
    '';
  const accountName = jsVar(html, 'nickname') || '';

  const colorCount = new Map();
  const bgCount = new Map();
  const fontSize = new Map();
  const lineHeight = new Map();
  const align = new Map();
  const counts = {
    headings: 0,
    headingBlocks: 0,
    sections: 0,
    quotes: 0,
    images: 0,
    galleries: 0,
    lists: 0,
    paragraphs: 0,
  };
  const styleSamples = [];

  const tagRe = /<(h[1-6]|p|section|blockquote|img|ul|ol)\b([^>]*)>/gi;
  let tm;
  while ((tm = tagRe.exec(content))) {
    const tag = tm[1].toLowerCase();
    const style = parseStyle(tm[2]);
    if (tag === 'section') counts.sections += 1;
    if (tag === 'blockquote') counts.quotes += 1;
    if (tag === 'img') counts.images += 1;
    if (tag === 'ul' || tag === 'ol') counts.lists += 1;
    if (tag === 'p') counts.paragraphs += 1;
    if (/^h[1-6]$/.test(tag)) counts.headings += 1;

    const color = normalizeColor(style.color);
    const bg = normalizeColor(style.background || style['background-color']);
    if (color) add(colorCount, color);
    if (bg) add(bgCount, bg);
    if (tag === 'p' && style['font-size']) add(fontSize, style['font-size']);
    if (tag === 'p' && style['line-height']) add(lineHeight, style['line-height']);
    if (style['text-align']) add(align, style['text-align']);

    const borderLeft = style['border-left'] || '';
    if (borderLeft && /solid|px/.test(borderLeft)) counts.quotes += 1;

    const overflow = `${style.overflow || ''} ${style['overflow-x'] || ''} ${style['white-space'] || ''}`;
    if (/auto|scroll/.test(overflow) && /nowrap/.test(overflow)) counts.galleries += 1;

    const bold =
      style['font-weight'] === 'bold' ||
      Number(style['font-weight']) >= 600 ||
      /^h[1-6]$/.test(tag);
    if (bg && isBrandColor(bg) && (bold || tag === 'section')) {
      counts.headingBlocks += 1;
      const sample = Object.entries(style)
        .filter(([k]) =>
          /font|color|background|border|padding|text-align|line-height/.test(k)
        )
        .map(([k, v]) => `${k}:${v}`)
        .join(';')
        .slice(0, 180);
      if (sample && styleSamples.length < 4 && !styleSamples.includes(sample)) {
        styleSamples.push(sample);
      }
    }
  }

  const brandPool = new Map();
  for (const [c, n] of bgCount) if (isBrandColor(c)) add(brandPool, c, n * 2);
  for (const [c, n] of colorCount) if (isBrandColor(c)) add(brandPool, c, n);

  const ranked = [...brandPool.entries()].sort((a, b) => b[1] - a[1]);
  const primary = ranked[0]?.[0] || '';
  const secondary = ranked.find(([c]) => c !== primary)?.[0] || '';

  const patterns = [];
  const headingStyle = counts.headingBlocks >= 1 ? 'block' : 'accent';
  if (counts.headingBlocks >= 1) {
    patterns.push(
      '对标有品牌色标题色块：可用 heading_style=block；短标题分段，避免一大段到底'
    );
  } else if (counts.headings >= 2) {
    patterns.push(
      '用短标题把正文切成几段；标题用品牌色字与底线，不要大面积实心色块（heading_style=accent）'
    );
  } else if (counts.headings >= 1) {
    patterns.push('标题用品牌色字即可，不要做成大色块');
  }
  if (counts.quotes >= 1) {
    patterns.push('关键句用引用块（左边框）单独拎出来');
  }
  if (counts.galleries >= 1) {
    patterns.push('多图用横向滑动区块，不要竖着堆满屏');
  } else if (counts.images >= 2) {
    patterns.push('图文穿插，段落之间配图，不要纯文字墙');
  }
  if (counts.lists >= 1) {
    patterns.push('并列信息用列表，不要写成一长句');
  }
  const fs = topKey(fontSize);
  const lh = topKey(lineHeight);
  if (fs || lh) {
    patterns.push(
      `正文节奏接近 ${fs || '15px'} / 行高 ${lh || '1.75'}，句子短、段与段之间留空`
    );
  }
  const ta = topKey(align);
  if (ta === 'justify' || ta === 'center') {
    patterns.push(ta === 'center' ? '标题或强调句可居中' : '正文两端对齐');
  }
  if (!patterns.length) {
    patterns.push('未识别到明显组件，按清晰小标题 + 短段落来写');
  }

  const agentBrief = [
    title ? `对标标题（仅识别来源，勿照抄）：${title}` : '',
    accountName ? `对标账号：${accountName}` : '',
    primary ? `可参考主色 ${primary}${secondary ? `，次色 ${secondary}` : ''}` : '',
    `标题样式 heading_style=${headingStyle}（${
      headingStyle === 'block' ? '对标有色块' : '对标无大色块，用文字品牌色'
    }）`,
    ...patterns.map((p) => `- ${p}`),
    '只借鉴排版和节奏，不要复制对标文的句子、标题或图片。',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    sourceUrl: meta.sourceUrl || '',
    fetchedAt: new Date().toISOString(),
    title,
    accountName,
    brand: { primary, secondary },
    headingStyle,
    typography: {
      bodyFontSize: topKey(fontSize),
      lineHeight: topKey(lineHeight),
      textAlign: topKey(align),
    },
    counts,
    styleSamples,
    patterns,
    agentBrief,
  };
}

export async function loadHtml(input) {
  if (input.file) {
    return { html: fs.readFileSync(input.file, 'utf8'), sourceUrl: input.file };
  }
  const url = input.url;
  if (!url) throw new Error('缺少链接或 --file');
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`不是合法链接: ${url}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('只支持 http(s) 链接');
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`拉取失败 HTTP ${res.status}`);
  const html = await res.text();
  if (/环境异常|请在微信客户端打开/.test(html) && !html.includes('js_content')) {
    throw new Error('微信返回了拦截页。请在浏览器打开该文，另存为 HTML 后用 --file 再提炼');
  }
  return { html, sourceUrl: url };
}

export function layoutRefPath(startDir) {
  const root = findWorkspaceRoot(startDir || process.env.MK_WECHAT_START_DIR || process.cwd());
  return {
    root,
    file: path.join(root, '.mk-wechat-publish', 'layout-ref.json'),
  };
}

export function saveLayoutRef(report, startDir) {
  const { root, file } = layoutRefPath(startDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n', 'utf8');
  return { root, file };
}

/** 把对标识别的标题样式写入工作空间配置，发布时直接生效 */
export function applyHeadingStyleToWorkspace(headingStyle, startDir) {
  const style =
    headingStyle === 'block' || headingStyle === 'plain' || headingStyle === 'accent'
      ? headingStyle
      : 'accent';
  return patchLocalConfig(
    { layout: { heading_style: style } },
    { startDir }
  );
}

function parseArgs(argv) {
  const out = { url: '', file: '', startDir: process.env.MK_WECHAT_START_DIR || process.cwd() };
  const rest = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--file' || a === '-f') && argv[i + 1]) out.file = argv[++i];
    else if ((a === '--dir' || a === '-C') && argv[i + 1]) out.startDir = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
    else rest.push(a);
  }
  out.url = rest[0] || '';
  return out;
}

function printReport(report, saved) {
  console.log('=== 对标排版参考（未保存正文） ===');
  if (report.sourceUrl) console.log('来源:', report.sourceUrl);
  if (report.title) console.log('识别标题:', report.title);
  if (report.accountName) console.log('账号:', report.accountName);
  console.log(
    '参考色:',
    report.brand.primary || '（未识别到品牌色）',
    report.brand.secondary ? `/ ${report.brand.secondary}` : ''
  );
  const t = report.typography;
  if (t.bodyFontSize || t.lineHeight) {
    console.log('正文字号:', t.bodyFontSize || '-', '| 行高:', t.lineHeight || '-');
  }
  console.log('结构计数:', JSON.stringify(report.counts));
  console.log('');
  console.log(report.agentBrief);
  console.log('');
  console.log('已写入:', saved.file);
  console.log('写稿时读这份参考；不要复制对标正文。若要用这套主色，再跑 set-brand.sh。');
}

const isCli =
  import.meta.url === pathToFileURL(path.resolve(process.argv[1] || '')).href;
if (isCli) {
  const args = parseArgs(process.argv);
  if (args.help || (!args.url && !args.file)) {
    console.log(`用法: node scripts/extract-layout.mjs <公众号文章链接>
       node scripts/extract-layout.mjs --file 保存的页面.html

只提炼排版（配色、标题节奏、引用、画廊），不保存正文。
结果写入当前工作空间 .mk-wechat-publish/layout-ref.json`);
    process.exit(args.help ? 0 : 1);
  }
  const { html, sourceUrl } = await loadHtml(args);
  const report = analyzeLayout(html, { sourceUrl });
  if (!report.patterns.length && report.counts.paragraphs === 0 && report.counts.sections === 0) {
    console.error('没有解析到正文排版。确认链接是已发布的公众号图文，或改用 --file。');
    process.exit(1);
  }
  const saved = saveLayoutRef(report, args.startDir);
  applyHeadingStyleToWorkspace(report.headingStyle, args.startDir);
  printReport(report, saved);
  console.log(
    '已写入工作空间 layout.heading_style =',
    report.headingStyle,
    '（下次发布生效）'
  );
}
