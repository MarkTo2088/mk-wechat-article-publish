// scripts/lib/dry-preview.mjs — dry-run 完整预览页（顶栏选色盘）
import { SETTINGS_PORT } from './local-config.mjs';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {string} articleHtml - 渲染后的正文 HTML
 * @param {{ brandPrimary?: string|null, brandSecondary?: string|null, palette: object, title?: string }} opts
 */
export function wrapDryPreview(articleHtml, opts = {}) {
  const primary = opts.brandPrimary || '#222222';
  const secondary = opts.brandSecondary || primary;
  const title = opts.title || 'dry-run 预览';
  const pal = opts.palette || {};

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} · dry-run</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; }
  #toolbar {
    position: sticky; top: 0; z-index: 50;
    display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center;
    padding: 10px 14px; background: #1a1a1a; color: #eee; font-size: 13px;
    box-shadow: 0 2px 8px rgba(0,0,0,.25);
  }
  #toolbar label { display: inline-flex; align-items: center; gap: 6px; }
  #toolbar input[type="color"] { width: 36px; height: 28px; border: none; padding: 0; cursor: pointer; background: transparent; }
  #toolbar input[type="text"] { width: 88px; padding: 4px 6px; border-radius: 4px; border: 1px solid #555; background: #2a2a2a; color: #fff; font-family: ui-monospace, monospace; }
  #toolbar button {
    padding: 6px 12px; border-radius: 4px; border: none; cursor: pointer;
    background: #00ff88; color: #111; font-weight: 600; font-size: 13px;
  }
  #toolbar button.secondary { background: #444; color: #eee; }
  #toolbar .hint { opacity: .7; font-size: 12px; }
  #status { margin-left: auto; font-size: 12px; opacity: .85; max-width: 42%; text-align: right; }
  #preview { padding: 16px 0 40px; }
</style>
</head>
<body>
<div id="toolbar">
  <strong>品牌色预览</strong>
  <label>主色 <input type="color" id="cPrimary" value="${escapeHtml(normalizeHex(primary))}" />
    <input type="text" id="tPrimary" value="${escapeHtml(normalizeHex(primary))}" /></label>
  <label>次色 <input type="color" id="cSecondary" value="${escapeHtml(normalizeHex(secondary))}" />
    <input type="text" id="tSecondary" value="${escapeHtml(normalizeHex(secondary))}" /></label>
  <button type="button" id="btnCopy">复制 frontmatter</button>
  <button type="button" id="btnSave" class="secondary">保存为默认品牌色</button>
  <span class="hint">仅本地预览，不会写入公众号</span>
  <span id="status"></span>
</div>
<div id="preview" data-old-primary="${escapeHtml(pal.primary || '')}"
     data-old-secondary="${escapeHtml(pal.secondary || '')}"
     data-old-border="${escapeHtml(pal.border || '')}"
     data-old-bg="${escapeHtml(pal.bg || '')}"
     data-old-grad="${escapeHtml(pal.grad || '')}">
${articleHtml}
</div>
<script>
(function () {
  const PORT = ${SETTINGS_PORT};
  const preview = document.getElementById('preview');
  const status = document.getElementById('status');
  const cPrimary = document.getElementById('cPrimary');
  const cSecondary = document.getElementById('cSecondary');
  const tPrimary = document.getElementById('tPrimary');
  const tSecondary = document.getElementById('tSecondary');

  function setStatus(msg, ok) {
    status.textContent = msg || '';
    status.style.color = ok === false ? '#ff8080' : ok ? '#00ff88' : '#ccc';
  }

  function normalizeHex(h) {
    h = String(h || '').trim();
    if (!h) return '#222222';
    if (h[0] !== '#') h = '#' + h;
    if (h.length === 4) h = '#' + h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
    return h.slice(0, 7).toLowerCase();
  }

  function hexToRgb(hex) {
    let h = normalizeHex(hex).slice(1);
    const n = parseInt(h, 16);
    if (Number.isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const mix = (a, b, t) => ({
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  });
  const rgbStr = (c) => 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';

  function buildPalette(primary, secondary) {
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };
    const p = hexToRgb(primary) || { r: 34, g: 34, b: 34 };
    const s = hexToRgb(secondary) || mix(p, black, 0.18);
    return {
      primary: rgbStr(p),
      secondary: rgbStr(s),
      border: rgbStr(mix(white, p, 0.22)),
      bg: rgbStr(mix(white, p, 0.06)),
      grad: 'linear-gradient(135deg, ' + rgbStr(p) + ', ' + rgbStr(s) + ')',
    };
  }

  function escapeReg(s) {
    return String(s).replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
  }

  function applyColors() {
    const primary = normalizeHex(tPrimary.value);
    const secondary = normalizeHex(tSecondary.value);
    tPrimary.value = primary;
    tSecondary.value = secondary;
    cPrimary.value = primary;
    cSecondary.value = secondary;

    const old = {
      primary: preview.dataset.oldPrimary,
      secondary: preview.dataset.oldSecondary,
      border: preview.dataset.oldBorder,
      bg: preview.dataset.oldBg,
      grad: preview.dataset.oldGrad,
    };
    const neu = buildPalette(primary, secondary);
    let html = preview.innerHTML;
    const pairs = [
      [old.grad, neu.grad],
      [old.primary, neu.primary],
      [old.secondary, neu.secondary],
      [old.border, neu.border],
      [old.bg, neu.bg],
    ];
    for (const [from, to] of pairs) {
      if (!from || !to) continue;
      html = html.split(from).join(to);
      // 兼容空格差异的 rgb
      const loose = from.replace(/rgb\\((\\d+),(\\d+),(\\d+)\\)/, 'rgb($1, $2, $3)');
      if (loose !== from) html = html.split(loose).join(to);
    }
    preview.innerHTML = html;
    preview.dataset.oldPrimary = neu.primary;
    preview.dataset.oldSecondary = neu.secondary;
    preview.dataset.oldBorder = neu.border;
    preview.dataset.oldBg = neu.bg;
    preview.dataset.oldGrad = neu.grad;
  }

  function syncFromColor(which) {
    if (which === 'p') tPrimary.value = cPrimary.value;
    else tSecondary.value = cSecondary.value;
    applyColors();
  }
  function syncFromText(which) {
    if (which === 'p') cPrimary.value = normalizeHex(tPrimary.value);
    else cSecondary.value = normalizeHex(tSecondary.value);
    applyColors();
  }

  cPrimary.addEventListener('input', () => syncFromColor('p'));
  cSecondary.addEventListener('input', () => syncFromColor('s'));
  tPrimary.addEventListener('change', () => syncFromText('p'));
  tSecondary.addEventListener('change', () => syncFromText('s'));

  document.getElementById('btnCopy').addEventListener('click', async () => {
    const text = [
      'brand_primary: "' + normalizeHex(tPrimary.value) + '"',
      'brand_secondary: "' + normalizeHex(tSecondary.value) + '"',
    ].join('\\n');
    try {
      await navigator.clipboard.writeText(text);
      setStatus('已复制 frontmatter 两行', true);
    } catch {
      setStatus('复制失败，请手动选中: ' + text, false);
    }
  });

  document.getElementById('btnSave').addEventListener('click', async () => {
    const body = {
      brand: {
        primary: normalizeHex(tPrimary.value),
        secondary: normalizeHex(tSecondary.value),
      },
    };
    try {
      const res = await fetch('http://127.0.0.1:' + PORT + '/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setStatus('已保存默认品牌色 → config.local.json', true);
    } catch (e) {
      setStatus('保存失败：请先运行 bash scripts/settings.sh（本机设置服务）', false);
    }
  });
})();
</script>
</body>
</html>`;
}

function normalizeHex(h) {
  h = String(h || '').trim();
  if (!h) return '#222222';
  if (h[0] !== '#') h = '#' + h;
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) return '#222222';
  return h.toLowerCase();
}
