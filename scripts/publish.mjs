// publish.mjs - 公众号图文增强发布（Markdown 渲染 + 草稿 API）
// 用法: node scripts/publish.mjs <文章.md> [--dry] [--config <config.json>]
// 推荐入口: bash scripts/publish.sh <文章.md> [...]

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import matter from 'gray-matter';
import { renderMarkdown } from './lib/render.mjs';
import { publishToWechatDraft } from './lib/wechat-draft.mjs';
import { resolveConfig } from './lib/local-config.mjs';
import { wrapDryPreview } from './lib/dry-preview.mjs';
import { runProbe, formatProbeReport } from './lib/probe.mjs';
import { formatAssetReport, inspectAssets } from './lib/asset-check.mjs';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const cfgIdx = argv.indexOf('--config');
const cfgArg = cfgIdx >= 0 ? argv[cfgIdx + 1] : null;
const mdArg = argv.find((a, i) => {
  if (a.startsWith('--')) return false;
  if (i > 0 && argv[i - 1] === '--config') return false;
  return true;
});

if (!mdArg || mdArg.startsWith('--')) {
  console.error('用法: node scripts/publish.mjs <文章.md> [--dry] [--config <config.json>]');
  process.exit(1);
}

const MD_PATH = path.resolve(mdArg);
if (!fs.existsSync(MD_PATH)) {
  console.error(`找不到文章文件: ${MD_PATH}`);
  process.exit(1);
}
const MD_DIR = path.dirname(MD_PATH);
const BASE = path.basename(MD_PATH, path.extname(MD_PATH));

const raw = fs.readFileSync(MD_PATH, 'utf8');
const { data: fm, content: body } = matter(raw);

function loadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

const resolved = resolveConfig({ startDir: MD_DIR });
const local = resolved.config;
console.log('工作空间:', resolved.workspaceRoot);
console.log('公众号:', local.wechat.name || '（未填写名称）');
console.log(
  '配置来源:',
  resolved.hasWorkspaceConfig
    ? '工作空间'
    : resolved.hasSkillConfig
      ? 'skill 级'
      : '环境变量/默认'
);

let cfg = null;
if (cfgArg) {
  const cfgPath = path.isAbsolute(cfgArg) ? cfgArg : path.resolve(process.cwd(), cfgArg);
  cfg = loadJson(cfgPath);
}

const unquote = (v) => {
  if (typeof v !== 'string') return v;
  return v.replace(/^(['"])(.*)\1$/, '$2');
};

const title = unquote(fm.title) || BASE;
const coverRaw = unquote(fm.cover) || '';
const cover = coverRaw ? path.resolve(MD_DIR, coverRaw) : '';

// frontmatter > --config > 工作空间 > skill 级 > 默认
const brandPrimary =
  unquote(fm.brand_primary) ||
  cfg?.brand?.primary ||
  local.brand.primary ||
  null;
const brandSecondary =
  unquote(fm.brand_secondary) ||
  cfg?.brand?.secondary ||
  local.brand.secondary ||
  null;
const galleryWidth =
  unquote(fm.gallery_width) ||
  cfg?.gallery?.image_width ||
  local.gallery.image_width ||
  62;
const headingStyle =
  unquote(fm.heading_style) ||
  cfg?.layout?.heading_style ||
  cfg?.heading_style ||
  local.layout?.heading_style ||
  'accent';

console.log('标题:', title);
console.log('封面:', cover || '(无)');
console.log('标题样式:', headingStyle);
if (brandPrimary) {
  console.log(
    '品牌色:',
    brandPrimary,
    brandSecondary ? `→ 渐变 ${brandSecondary}` : ''
  );
}

const { html, galleryCount, palette } = renderMarkdown(body, {
  brandPrimary,
  brandSecondary,
  galleryWidth,
  headingStyle,
});

if (DRY) {
  const outPath = '/tmp/debug_publish.html';
  const page = wrapDryPreview(html, {
    brandPrimary: brandPrimary || '#222222',
    brandSecondary: brandSecondary || brandPrimary || '#222222',
    palette,
    title,
  });
  fs.writeFileSync(outPath, page);
  console.log('[DRY] 已写', outPath);
  console.log('[DRY] 画廊区块:', galleryCount, '| 主色:', palette.primary);
  console.log('[DRY] 顶栏可选色；保存默认色需先运行: bash scripts/settings.sh');
  const assetPreview = inspectAssets(MD_PATH);
  if (!assetPreview.ok && assetPreview.local.length) {
    console.log('[DRY] 配图还没完成水印核验，正式发布会被拦住。');
    console.log(formatAssetReport(assetPreview));
  }
  const openCmd =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open';
  try {
    spawn(openCmd, [outPath], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    /* ignore */
  }
  process.exit(0);
}

const APP_ID = local.wechat.appId;
const APP_SECRET = local.wechat.appSecret;
if (!APP_ID || !APP_SECRET) {
  console.error('缺少公众号凭证：请在本工作空间运行 bash scripts/settings.sh 或 onboard.sh，');
  console.error(`将写入 ${resolved.workspaceConfigPath}`);
  process.exit(1);
}

console.log('发布前连通性探测...');
const probe = await runProbe({ startDir: MD_DIR });
console.log(formatProbeReport(probe));
if (!probe.ok) {
  console.error('\n发布已中止。请按上方步骤配置 IP 白名单后重试，或单独运行: bash scripts/probe.sh');
  process.exit(1);
}

const assets = inspectAssets(MD_PATH);
console.log(formatAssetReport(assets));
if (!assets.ok) {
  console.error('\n发布已中止：本地配图未通过水印核验（或文件在核验后被替换）。');
  process.exit(1);
}

console.log('发布到草稿箱...');
try {
  const res = await publishToWechatDraft(
    { title, content: html, cover },
    { appId: APP_ID, appSecret: APP_SECRET, baseDir: MD_DIR }
  );
  console.log('发布结果:', JSON.stringify(res));
} catch (err) {
  console.error('发布失败:', err.message || err);
  process.exit(1);
}
