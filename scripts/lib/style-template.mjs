// scripts/lib/style-template.mjs — 从参考文提炼创作模板（不保存正文、不复用原图）
import { analyzeLayout, extractDivInner } from '../extract-layout.mjs';

function decodeBasic(s) {
  return String(s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

export function htmlToText(html) {
  return decodeBasic(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function count(text, re) {
  return (text.match(re) || []).length;
}

/** 只产出手法标签和数字，不返回原句 */
export function analyzeVoice(text) {
  const body = String(text || '').trim();
  const sentences = body
    .split(/[。！？!?]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  const lengths = sentences.map((s) => s.length);
  const avg =
    lengths.length > 0
      ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
      : 0;
  const questions = count(body, /[？?]/g);
  const exclaims = count(body, /[！!]/g);
  const you = count(body, /你/g);
  const we = count(body, /我们/g);
  const emoji = count(body, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu);
  const oral = count(body, /吧|啊|呢|嘛|呗/g);
  const techniques = [];

  if (avg > 0 && avg <= 18) techniques.push('短句推进，一句一层意思，少用长从句');
  else if (avg >= 36) techniques.push('句子偏长，信息铺开后再收束');
  else if (avg > 0) techniques.push('句子中等长度，读起来像说话而不是论文');

  if (sentences.length && questions / sentences.length >= 0.12) {
    techniques.push('经常向读者提问，用问句把人留在下一段');
  }
  if (sentences.length && exclaims / sentences.length >= 0.08) {
    techniques.push('关键处用感叹，把情绪说满');
  }
  if (you >= 3 && you >= we) techniques.push('对读者说「你」，像面对面聊天');
  else if (we >= 2) techniques.push('用「我们」把读者拉到同一边');
  if (oral >= 4) techniques.push('口语助词多（吧/啊/呢），不要写成公文');
  if (emoji >= 2) techniques.push('少量表情符号点缀，不要每句都加');
  if (/说白了|说到底|本质上/.test(body)) techniques.push('复杂判断先用大白话翻一遍');
  if (/如果你|要是你|假如你/.test(body)) techniques.push('用「如果你…」把读者放进具体场景');
  if (/不是[^。]{0,16}而是/.test(body)) techniques.push('用「不是…而是…」翻转读者预期');
  if (/记住|划重点|一句话/.test(body)) techniques.push('把金句单独拎出来，方便划线');

  const head = body.slice(0, 80);
  let opening = '直接进入主题';
  if (/[？?]/.test(head)) opening = '提问开场';
  else if (/昨天|有一次|那天|记得/.test(head)) opening = '小故事开场';
  else if (sentences[0] && sentences[0].length <= 14) opening = '短句砸开场';

  const tail = body.slice(-180);
  const closing = /关注|在看|点赞|转发|评论|留言/.test(tail)
    ? '结尾有行动号召（关注、在看或评论）'
    : '结尾收在观点上，不硬广';

  if (!techniques.length) techniques.push('语气平实，按参考文的分段节奏写，不要堆术语');

  return {
    avgSentenceLength: avg,
    sentenceCount: sentences.length,
    questionCount: questions,
    exclaimCount: exclaims,
    opening,
    closing,
    techniques,
  };
}

export function listImageUrls(contentHtml) {
  const urls = [];
  const seen = new Set();
  const re = /<img\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(contentHtml))) {
    const attrs = m[1];
    const dataSrc = attrs.match(/\bdata-src\s*=\s*["']([^"']+)["']/i);
    const src = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    const url = (dataSrc && dataSrc[1]) || (src && src[1]) || '';
    if (!/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

export function blockRhythm(contentHtml) {
  const re = /<(p|img|h[1-6]|blockquote|ul|ol)\b/gi;
  const name = {
    p: '文',
    img: '图',
    blockquote: '引',
    ul: '列',
    ol: '列',
    h1: '题',
    h2: '题',
    h3: '题',
    h4: '题',
    h5: '题',
    h6: '题',
  };
  const seq = [];
  let m;
  while ((m = re.exec(contentHtml)) && seq.length < 40) {
    const tag = m[1].toLowerCase();
    seq.push(name[tag] || '文');
  }
  const compact = [];
  for (const item of seq) {
    const last = compact[compact.length - 1];
    if (last && last.k === item) last.n += 1;
    else compact.push({ k: item, n: 1 });
  }
  return compact
    .map((x) => (x.n > 1 ? `${x.k}×${x.n}` : x.k))
    .join(' → ');
}

export function buildStyleTemplate(html, meta = {}) {
  const layout = analyzeLayout(html, meta);
  const content = extractDivInner(html, 'js_content') || html;
  const voice = analyzeVoice(htmlToText(content));
  const imageUrls = listImageUrls(content).slice(0, 8);
  const rhythm = blockRhythm(content);

  const lines = [
    layout.title ? `来源标题只作识别，不要照抄：${layout.title}` : '',
    layout.accountName ? `来源账号：${layout.accountName}` : '',
    '',
    '【说话方式】',
    `开场：${voice.opening}`,
    `结尾：${voice.closing}`,
    voice.avgSentenceLength
      ? `句子平均约 ${voice.avgSentenceLength} 字`
      : '',
    ...voice.techniques.map((t) => `- ${t}`),
    '',
    '【视觉排版】',
    layout.brand.primary
      ? `主色 ${layout.brand.primary}${layout.brand.secondary ? `，次色 ${layout.brand.secondary}` : ''}`
      : '',
    `标题样式：heading_style=${layout.headingStyle || 'accent'}（品牌色≠色块；无色块对标用 accent）`,
    rhythm ? `图文节奏：${rhythm}` : '',
    ...layout.patterns.map((p) => `- ${p}`),
    '',
    '【图片】',
    imageUrls.length
      ? `文中约 ${imageUrls.length} 张可观察的图。只学风格，写自己的稿时重新生图，不要用这些原图。`
      : '没有抓到正文图片。',
    '图片风格待看图后补全：摄影或插画、色调、构图、有没有人物、字是否压在图上。',
    '',
    '用这套模板写用户自己的选题。不要复制参考文的句子、标题或图片。',
  ].filter((line) => line !== '');

  return {
    ...layout,
    voice,
    rhythm,
    imageUrls,
    imageStyle: '',
    templateBrief: lines.join('\n'),
    agentBrief: lines.join('\n'),
  };
}

export function renderTemplateMarkdown(report, imageFiles = []) {
  const imgs = imageFiles.length
    ? imageFiles.map((f, i) => `${i + 1}. \`${f}\``).join('\n')
    : '（没有下载到参考图）';
  return `# 创作模板

学说话方式、排版和图片风格，用来写自己的选题。不要复制参考文的句子、标题，也不要把参考图放进稿子。

## 说话方式

- 开场：${report.voice.opening}
- 结尾：${report.voice.closing}
- 句长：约 ${report.voice.avgSentenceLength || '—'} 字
${report.voice.techniques.map((t) => `- ${t}`).join('\n')}

## 视觉排版

${report.brand.primary ? `- 主色 ${report.brand.primary}${report.brand.secondary ? `，次色 ${report.brand.secondary}` : ''}` : '- 未识别到品牌色'}
- 标题样式：\`heading_style=${report.headingStyle || 'accent'}\`（品牌色不等于大色块；对标无色块时用 accent）
${report.rhythm ? `- 图文节奏：${report.rhythm}` : ''}
${report.patterns.map((p) => `- ${p}`).join('\n')}

## 参考图（只观察，不使用）

${imgs}

## 图片风格

待补。打开上面的图后，用自己的话写清：摄影还是插画、主色调、构图、有没有人物、字是否压在图上。写稿生图时把这段写进提示词，并要求无水印、无角标、无 logo。
`;
}
