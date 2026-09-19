// scripts/verify-assets.mjs — 发布前核验配图是否已确认无水印
import path from 'path';
import { pathToFileURL } from 'url';
import {
  formatAssetReport,
  inspectAssets,
  markAssetsOk,
} from './lib/asset-check.mjs';

function parseArgs(argv) {
  const out = { md: '', ok: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--ok' || a === '-o') && argv[i + 1]) out.ok.push(argv[++i]);
    else if (a === '--help' || a === '-h') out.help = true;
    else if (!a.startsWith('--') && !out.md) out.md = a;
    else throw new Error(`未知参数: ${a}`);
  }
  return out;
}

const isCli =
  import.meta.url === pathToFileURL(path.resolve(process.argv[1] || '')).href;

if (isCli) {
  const args = parseArgs(process.argv);
  if (args.help || !args.md) {
    console.log(`用法:
  node scripts/verify-assets.mjs <文章.md>
  node scripts/verify-assets.mjs <文章.md> --ok images/cover.png

打开每张本地配图确认无水印后，用 --ok 写入核验记录。
图片一旦替换，哈希变化，必须重新核验。正式发布会检查这份记录。`);
    process.exit(args.help ? 0 : 1);
  }
  const md = path.resolve(args.md);
  if (args.ok.length) {
    const saved = markAssetsOk(md, args.ok);
    console.log('已标记无水印:', saved.marked.join(', '));
    console.log(formatAssetReport(saved.report));
    process.exit(saved.report.ok ? 0 : 2);
  }
  const report = inspectAssets(md);
  console.log(formatAssetReport(report));
  process.exit(report.ok ? 0 : 2);
}
