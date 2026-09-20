// scripts/lib/render.mjs — Markdown → 公众号可用的内联 HTML
import MarkdownIt from 'markdown-it';

function hexToRgb(hex) {
  let h = String(hex).replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const mix = (a, b, t) => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});
const rgbStr = (c) => `rgb(${c.r},${c.g},${c.b})`;

/** @returns {{ primary, secondary, border, bg, text, muted, codeBg, grad }} */
export function buildPalette(brandPrimary, brandSecondary) {
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  const defaultPrimary = { r: 34, g: 34, b: 34 }; // 中性深色，非蓝
  const p = (brandPrimary && hexToRgb(brandPrimary)) || defaultPrimary;
  const s =
    (brandSecondary && hexToRgb(brandSecondary)) || mix(p, black, 0.18);
  return {
    primary: rgbStr(p),
    secondary: rgbStr(s),
    border: rgbStr(mix(white, p, 0.22)),
    bg: rgbStr(mix(white, p, 0.06)),
    text: 'rgb(51,51,51)',
    muted: 'rgb(102,102,102)',
    codeBg: 'rgb(247,247,247)',
    grad: `linear-gradient(135deg, ${rgbStr(p)}, ${rgbStr(s)})`,
  };
}

function styleAttrs(style) {
  return ` style="${style}"`;
}

export function normalizeHeadingStyle(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === 'block' || v === 'plain' || v === 'accent') return v;
  return 'accent';
}

/** 按 heading_style 生成标题内联样式 */
export function headingStylesFor(pal, headingStyle) {
  const style = normalizeHeadingStyle(headingStyle);
  if (style === 'block') {
    return {
      h1: `margin:1.4em 0 0.6em;padding:0.35em 0.5em;font-size:1.35em;font-weight:700;color:#fff;background:${pal.grad};border-radius:4px;line-height:1.4;`,
      h2: `margin:1.3em 0 0.55em;padding:0.3em 0.45em;font-size:1.2em;font-weight:700;color:#fff;background:${pal.primary};border-radius:4px;line-height:1.4;`,
      h3: `margin:1.2em 0 0.5em;padding:0.2em 0;font-size:1.08em;font-weight:700;color:${pal.primary};border-bottom:2px solid ${pal.border};line-height:1.4;`,
      h4: `margin:1em 0 0.4em;font-size:1em;font-weight:700;color:${pal.primary};`,
    };
  }
  if (style === 'plain') {
    return {
      h1: `margin:1.4em 0 0.6em;padding:0;font-size:1.35em;font-weight:700;color:${pal.text};line-height:1.4;`,
      h2: `margin:1.3em 0 0.55em;padding:0;font-size:1.2em;font-weight:700;color:${pal.text};line-height:1.4;`,
      h3: `margin:1.2em 0 0.5em;padding:0;font-size:1.08em;font-weight:700;color:${pal.text};line-height:1.4;`,
      h4: `margin:1em 0 0.4em;font-size:1em;font-weight:700;color:${pal.text};`,
    };
  }
  // accent：品牌色字 + 底线，无实心底
  return {
    h1: `margin:1.4em 0 0.6em;padding:0.15em 0;font-size:1.35em;font-weight:700;color:${pal.primary};border-bottom:2px solid ${pal.border};line-height:1.4;`,
    h2: `margin:1.3em 0 0.55em;padding:0.1em 0;font-size:1.2em;font-weight:700;color:${pal.primary};border-bottom:2px solid ${pal.border};line-height:1.4;`,
    h3: `margin:1.2em 0 0.5em;padding:0.1em 0;font-size:1.08em;font-weight:700;color:${pal.primary};border-bottom:1px solid ${pal.border};line-height:1.4;`,
    h4: `margin:1em 0 0.4em;font-size:1em;font-weight:700;color:${pal.primary};`,
  };
}

/**
 * @param {string} markdownBody - 已去掉 frontmatter 的正文
 * @param {{ brandPrimary?: string|null, brandSecondary?: string|null, galleryWidth?: number|string, headingStyle?: string }} opts
 */
export function renderMarkdown(markdownBody, opts = {}) {
  const galleryWidth = Number(opts.galleryWidth) || 62;
  const pal = buildPalette(opts.brandPrimary, opts.brandSecondary);
  const headingStyle = normalizeHeadingStyle(opts.headingStyle);
  const headingCss = headingStylesFor(pal, headingStyle);

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: false,
    typographer: false,
  });

  // --- 自定义 token 渲染：全部内联 style（公众号会剥外链 CSS） ---
  const defaultLinkOpen =
    md.renderer.rules.link_open ||
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.heading_open = (tokens, idx) => {
    const level = tokens[idx].tag; // h1/h2/h3...
    const s = headingCss[level] || headingCss.h4;
    return `<${level}${styleAttrs(s)}>`;
  };

  md.renderer.rules.paragraph_open = () =>
    `<p${styleAttrs(`margin:0.85em 0;line-height:1.75;color:${pal.text};font-size:15px;`)}>`;

  md.renderer.rules.strong_open = () =>
    `<strong${styleAttrs(`color:${pal.primary};font-weight:700;`)}>`;

  md.renderer.rules.em_open = () =>
    `<em${styleAttrs(`font-style:italic;color:${pal.muted};`)}>`;

  md.renderer.rules.blockquote_open = () =>
    `<blockquote${styleAttrs(
      `margin:1em 0;padding:0.6em 1em;border-left:4px solid ${pal.primary};background:${pal.bg};color:${pal.muted};line-height:1.7;`
    )}>`;

  // 列表不用 <ul>/<li>：微信编辑器对原生列表标签支持差，圆点会与内容分离、单独成行。
  // 改为带品牌色圆点的 <p>（悬挂缩进），点永远和文字在同一行。
  md.renderer.rules.bullet_list_open = (tokens, idx, options, env) => {
    env.listDepth = (env.listDepth || 0) + 1;
    env.inOrdered = false;
    return env.listDepth > 1 ? '' : `<section${styleAttrs(`margin:0.8em 0;`)}>`;
  };
  md.renderer.rules.bullet_list_close = (tokens, idx, options, env) => {
    env.listDepth = (env.listDepth || 1) - 1;
    return env.listDepth > 0 ? '' : `</section>\n`;
  };
  md.renderer.rules.ordered_list_open = (tokens, idx, options, env) => {
    env.listDepth = (env.listDepth || 0) + 1;
    env.inOrdered = true;
    env.orderCounter = 0;
    return env.listDepth > 1 ? '' : `<section${styleAttrs(`margin:0.8em 0;`)}>`;
  };
  md.renderer.rules.ordered_list_close = (tokens, idx, options, env) => {
    env.listDepth = (env.listDepth || 1) - 1;
    return env.listDepth > 0 ? '' : `</section>\n`;
  };
  md.renderer.rules.list_item_open = (tokens, idx, options, env) => {
    env.inListItem = (env.inListItem || 0) + 1;
    const base = `margin:0.35em 0;line-height:1.75;color:${pal.text};padding-left:1.15em;text-indent:-1.15em;`;
    if (env.listDepth > 1) {
      // 嵌套列表：缩进一层，不用悬挂缩进
      return `<p${styleAttrs(`margin:0.3em 0 0.3em 1.2em;line-height:1.75;color:${pal.text};`)}>`;
    }
    const marker = env.inOrdered ? `${++env.orderCounter}.` : `•`;
    return `<p${styleAttrs(base)}><span${styleAttrs(
      `color:${pal.primary};font-weight:700;margin-right:0.4em;`
    )}>${marker}</span>`;
  };
  md.renderer.rules.list_item_close = (tokens, idx, options, env) => {
    env.inListItem = (env.inListItem || 1) - 1;
    return `</p>`;
  };
  // li 内部的段落标签会破坏上面的 <p> 结构，抑制掉
  md.renderer.rules.paragraph_open = (tokens, idx, options, env) => {
    if (env.inListItem) return '';
    return `<p${styleAttrs(`margin:0.85em 0;line-height:1.75;color:${pal.text};font-size:15px;`)}>`;
  };
  md.renderer.rules.paragraph_close = (tokens, idx, options, env) =>
    env.inListItem ? '' : `</p>`;

  md.renderer.rules.table_open = () =>
    `<table${styleAttrs(
      `border-collapse:collapse;width:100%;margin:1em 0;font-size:14px;color:${pal.text};`
    )}>`;

  md.renderer.rules.thead_open = () => `<thead>`;
  md.renderer.rules.tr_open = () => `<tr>`;

  md.renderer.rules.th_open = () =>
    `<th${styleAttrs(
      `border:1px solid ${pal.border};padding:8px 10px;background:${pal.primary};color:#fff;font-weight:600;text-align:left;`
    )}>`;

  md.renderer.rules.td_open = () =>
    `<td${styleAttrs(
      `border:1px solid ${pal.border};padding:8px 10px;background:${pal.bg};`
    )}>`;

  md.renderer.rules.code_inline = (tokens, idx) => {
    const content = md.utils.escapeHtml(tokens[idx].content);
    return `<code${styleAttrs(
      `padding:0.15em 0.4em;background:${pal.codeBg};border-radius:3px;font-size:0.92em;color:${pal.primary};`
    )}>${content}</code>`;
  };

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const content = md.utils.escapeHtml(token.content);
    return `<pre${styleAttrs(
      `margin:1em 0;padding:12px 14px;background:${pal.codeBg};border-radius:4px;white-space:pre-wrap;word-break:break-all;overflow-x:auto;line-height:1.5;font-size:13px;`
    )}><code${styleAttrs(`color:${pal.text};`)}>${content}</code></pre>\n`;
  };

  md.renderer.rules.hr = () =>
    `<section${styleAttrs(
      `margin:1.5em 0;border-top:1px solid ${pal.border};font-size:0;line-height:0;height:0;`
    )}>&nbsp;</section>\n`;

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const aIndex = tokens[idx].attrIndex('style');
    const style = `color:${pal.primary};text-decoration:underline;`;
    if (aIndex < 0) tokens[idx].attrPush(['style', style]);
    else tokens[idx].attrs[aIndex][1] = style;
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  // 普通图片：块级居中；画廊内图片在后处理改横排
  md.renderer.rules.image = (tokens, idx) => {
    const token = tokens[idx];
    const src = token.attrGet('src') || '';
    const alt = md.utils.escapeHtml(token.content || token.attrGet('alt') || '');
    const style =
      'display:block;max-width:100%;height:auto;margin:0.8em auto;border-radius:4px;';
    return `<img src="${md.utils.escapeHtml(src)}" alt="${alt}"${styleAttrs(style)} />`;
  };

  let html = md.render(markdownBody);

  // 画廊：overflow-x:auto 的 section 内图片强制横排
  let galleryCount = 0;
  html = html.replace(
    /(<section[^>]*overflow-x\s*:\s*auto[^>]*>)([\s\S]*?)(<\/section>)/gi,
    (m, open, body, close) => {
      galleryCount++;
      // 确保 section 自身有 nowrap（若作者已写则保留）
      let openTag = open;
      if (!/white-space\s*:\s*nowrap/i.test(openTag)) {
        openTag = openTag.replace(
          /style\s*=\s*"([^"]*)"/i,
          (sm, s) => `style="${s};white-space:nowrap;"`
        );
      }
      // markdown-it 会把图片包进 <p>，块级 p 会导致竖排；先拆掉只含单图的 p
      let newBody = body.replace(
        /<p[^>]*>\s*(<img\b[^>]*>)\s*<\/p>/gi,
        '$1'
      );
      newBody = newBody.replace(/<img([^>]*)\/?>/gi, (img, attrs) => {
        const sm = attrs.match(/style\s*=\s*"([^"]*)"/i);
        let style = sm ? sm[1] : '';
        style = style
          .split(';')
          .map((d) => d.trim())
          .filter(
            (d) =>
              d &&
              !/^display\s*:/i.test(d) &&
              !/^margin\s*:/i.test(d) &&
              !/^max-width\s*:/i.test(d) &&
              !/^width\s*:/i.test(d) &&
              !/^vertical-align\s*:/i.test(d)
          )
          .join(';');
        style += `;display:inline-block;width:${galleryWidth}%;vertical-align:top;margin:0 4px;max-width:none;height:auto;border-radius:4px;`;
        if (sm) {
          return img.replace(/style\s*=\s*"[^"]*"/i, `style="${style}"`);
        }
        return `<img style="${style}"${attrs}>`;
      });
      return openTag + newBody + close;
    }
  );

  // 外层容器（阅读区最大宽度）
  const wrapped = `<section${styleAttrs(
    `max-width:677px;margin:0 auto;padding:8px 12px;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;color:${pal.text};background:#fff;`
  )}>${html}</section>`;

  return { html: wrapped, galleryCount, palette: pal };
}
