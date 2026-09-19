// scripts/lib/asset-check.mjs — 文章本地配图清单与水印核验台账
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { findWorkspaceRoot } from './local-config.mjs';

function unquote(v) {
  return String(v || '').replace(/^(['"])(.*)\1$/, '$2').trim();
}

function sha256File(filePath) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(filePath));
  return h.digest('hex');
}

function isRemote(ref) {
  return /^https?:\/\//i.test(ref) || ref.startsWith('data:');
}

/**
 * 封面 + 正文里的本地图片（远程链接单独列出，不计入必须核验）
 */
export function listArticleImages(mdPath) {
  const absMd = path.resolve(mdPath);
  const dir = path.dirname(absMd);
  const raw = fs.readFileSync(absMd, 'utf8');
  const { data, content } = matter(raw);
  const local = [];
  const remote = [];
  const seen = new Set();

  function add(ref, role) {
    const src = unquote(ref).split(/\s+/)[0];
    if (!src) return;
    if (isRemote(src)) {
      remote.push({ ref: src, role });
      return;
    }
    const abs = path.resolve(dir, src);
    if (seen.has(abs)) return;
    seen.add(abs);
    local.push({
      ref: src,
      abs,
      role,
      rel: path.relative(dir, abs),
    });
  }

  if (data.cover) add(data.cover, 'cover');
  for (const m of content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) add(m[1], 'body');
  for (const m of content.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    add(m[1], 'body');
  }
  return { mdPath: absMd, dir, local, remote };
}

export function ledgerFile(mdPath) {
  const absMd = path.resolve(mdPath);
  const root = findWorkspaceRoot(path.dirname(absMd));
  const id = crypto.createHash('sha256').update(absMd).digest('hex').slice(0, 10);
  const base = path.basename(absMd, path.extname(absMd));
  return path.join(root, '.mk-wechat-publish', 'asset-checks', `${base}-${id}.json`);
}

function readLedger(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data.files || typeof data.files !== 'object') return { files: {} };
    return data;
  } catch {
    return { files: {} };
  }
}

export function inspectAssets(mdPath) {
  const listed = listArticleImages(mdPath);
  const file = ledgerFile(mdPath);
  const ledger = readLedger(file);
  const pending = [];
  const passed = [];
  const missing = [];

  for (const img of listed.local) {
    if (!fs.existsSync(img.abs)) {
      missing.push(img);
      continue;
    }
    const sha256 = sha256File(img.abs);
    const rec = ledger.files[img.rel];
    if (rec?.ok && rec.sha256 === sha256) passed.push({ ...img, sha256 });
    else pending.push({ ...img, sha256, stale: Boolean(rec?.ok) });
  }

  return {
    ...listed,
    ledgerFile: file,
    pending,
    passed,
    missing,
    ok: pending.length === 0 && missing.length === 0,
  };
}

export function markAssetsOk(mdPath, rels) {
  const listed = listArticleImages(mdPath);
  const file = ledgerFile(mdPath);
  const ledger = readLedger(file);
  const byRel = new Map(listed.local.map((img) => [img.rel, img]));
  const byBase = new Map(listed.local.map((img) => [path.basename(img.abs), img]));
  const marked = [];

  for (const raw of rels) {
    const key = unquote(raw);
    const img =
      byRel.get(key) ||
      byRel.get(path.normalize(key)) ||
      listed.local.find((item) => item.abs === path.resolve(listed.dir, key)) ||
      byBase.get(path.basename(key));
    if (!img) throw new Error(`文章里没有这张图: ${key}`);
    if (!fs.existsSync(img.abs)) throw new Error(`文件不存在: ${img.abs}`);
    ledger.files[img.rel] = {
      ok: true,
      sha256: sha256File(img.abs),
      checkedAt: new Date().toISOString(),
    };
    marked.push(img.rel);
  }

  ledger.article = listed.mdPath;
  ledger.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
  return { file, marked, report: inspectAssets(mdPath) };
}

export function formatAssetReport(report) {
  const lines = ['=== 素材水印核验 ==='];
  if (!report.local.length && !report.remote.length) {
    lines.push('这篇没有本地配图。');
    lines.push(report.ok ? 'STATUS=OK' : 'STATUS=NEED_CHECK');
    return lines.join('\n');
  }
  for (const img of report.passed) lines.push(`通过  ${img.rel}  (${img.role})`);
  for (const img of report.pending) {
    lines.push(
      `${img.stale ? '已变更需重核' : '未核验'}  ${img.rel}  (${img.role})`
    );
  }
  for (const img of report.missing) lines.push(`缺失  ${img.rel}  (${img.role})`);
  for (const img of report.remote) lines.push(`外链（不自动上传，请自行确认无水印）  ${img.ref}`);
  lines.push('');
  if (report.ok) {
    lines.push('本地配图均已核验且文件未改动。');
    lines.push('STATUS=OK');
  } else {
    lines.push('请逐张打开图片查看水印（角标、logo、「AI生成」、平台名）。');
    lines.push('有水印：优先按原描述重新生成无水印图并替换；边角小标且不影响主体时可用 crop-badge.sh。');
    lines.push('确认无水印后再标记：bash scripts/verify-assets.sh <文章.md> --ok <图片相对路径>');
    lines.push('只处理本流程生成或用户要求清理的配图，不要去掉他人作品上的版权水印。');
    lines.push('STATUS=NEED_CHECK');
  }
  return lines.join('\n');
}
