// scripts/learn-reference.mjs — 从参考文章链接提炼创作模板
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { loadHtml, applyHeadingStyleToWorkspace } from './extract-layout.mjs';
import {
  buildStyleTemplate,
  renderTemplateMarkdown,
} from './lib/style-template.mjs';
import { findWorkspaceRoot } from './lib/local-config.mjs';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function parseArgs(argv) {
  const out = {
    url: '',
    file: '',
    startDir: process.env.MK_WECHAT_START_DIR || process.cwd(),
    skipImages: false,
  };
  const rest = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--file' || a === '-f') && argv[i + 1]) out.file = argv[++i];
    else if ((a === '--dir' || a === '-C') && argv[i + 1]) out.startDir = argv[++i];
    else if (a === '--skip-images') out.skipImages = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else rest.push(a);
  }
  out.url = rest[0] || '';
  return out;
}

function extFromType(type, url) {
  if (/png/i.test(type)) return '.png';
  if (/gif/i.test(type)) return '.gif';
  if (/webp/i.test(type)) return '.webp';
  if (/jpeg|jpg/i.test(type)) return '.jpg';
  const m = String(url).match(/\.(png|jpe?g|gif|webp)(?:$|\?)/i);
  return m ? `.${m[1].toLowerCase().replace('jpeg', 'jpg')}` : '.jpg';
}

async function downloadImages(urls, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const saved = [];
  let n = 0;
  for (const url of urls) {
    if (saved.length >= 6) break;
    n += 1;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Referer: 'https://mp.weixin.qq.com/' },
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 800 || buf.length > 4_000_000) continue;
      const ext = extFromType(res.headers.get('content-type') || '', url);
      const name = `${String(saved.length + 1).padStart(2, '0')}${ext}`;
      const file = path.join(dir, name);
      fs.writeFileSync(file, buf);
      saved.push(file);
    } catch {
      /* 单张失败不影响模板 */
    }
  }
  return { saved, tried: n };
}

function printReport(report, paths, imageNote) {
  console.log('=== 参考文创作模板（未保存正文） ===');
  console.log(report.templateBrief);
  console.log('');
  console.log('模板:', paths.json);
  console.log('给助手看的说明:', paths.md);
  if (imageNote) console.log(imageNote);
  console.log('');
  console.log('下一步：打开参考图，把「图片风格」补进模板，再按这套手法写用户自己的选题。');
  console.log('不要复制原文句子或把参考图放进稿子。');
  console.log('STATUS=TEMPLATE_READY');
}

const isCli =
  import.meta.url === pathToFileURL(path.resolve(process.argv[1] || '')).href;

if (isCli) {
  const args = parseArgs(process.argv);
  if (args.help || (!args.url && !args.file)) {
    console.log(`用法: node scripts/learn-reference.mjs <参考文章链接>
       node scripts/learn-reference.mjs --file 保存的页面.html

提炼说话方式、视觉排版和图片观察素材，写入工作空间
.mk-wechat-publish/style-template.json
不保存正文。参考图只供看风格，不能直接用到新文章里。`);
    process.exit(args.help ? 0 : 1);
  }

  const { html, sourceUrl } = await loadHtml(args);
  const report = buildStyleTemplate(html, { sourceUrl });
  if (
    !report.voice.sentenceCount &&
    report.counts.paragraphs === 0 &&
    report.counts.sections === 0
  ) {
    console.error('没有解析到正文。确认是已发布的公众号图文，或改用 --file。');
    process.exit(1);
  }

  const root = findWorkspaceRoot(args.startDir);
  const base = path.join(root, '.mk-wechat-publish');
  const imgDir = path.join(base, 'style-ref', 'images');
  fs.rmSync(imgDir, { recursive: true, force: true });
  let saved = [];
  if (!args.skipImages && report.imageUrls.length) {
    const dl = await downloadImages(report.imageUrls, imgDir);
    saved = dl.saved.map((f) => path.relative(root, f));
  }

  const stored = {
    ...report,
    imageUrls: undefined,
    imageFiles: saved,
    imageStyle: '',
  };
  delete stored.imageUrls;
  const jsonPath = path.join(base, 'style-template.json');
  const mdPath = path.join(base, 'style-template.md');
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(stored, null, 2) + '\n', 'utf8');
  fs.writeFileSync(mdPath, renderTemplateMarkdown(report, saved), 'utf8');
  applyHeadingStyleToWorkspace(report.headingStyle || 'accent', args.startDir);

  const imageNote = args.skipImages
    ? '已跳过下载参考图。'
    : saved.length
      ? `已下载 ${saved.length} 张参考图到 ${imgDir}（只观察风格）`
      : report.imageUrls.length
        ? '参考图没下载成功。可改用浏览器另存 HTML 后 --file，或让助手打开原文看图。'
        : '这篇没有可下载的正文图。';
  printReport(report, { json: jsonPath, md: mdPath }, imageNote);
  console.log(
    '已写入工作空间 layout.heading_style =',
    report.headingStyle || 'accent',
    '（下次发布生效）'
  );
}
