#!/usr/bin/env node
// scripts/set-brand.mjs — 写入品牌色到工作空间（供 Agent / 手动 CLI）
// 用法:
//   node scripts/set-brand.mjs --primary "#00ff88" [--secondary "#00d4ff"]
//   MK_WECHAT_START_DIR=/path/to/project node scripts/set-brand.mjs -p "#112233" -s "#445566"
import {
  resolveConfig,
  patchLocalConfig,
} from './lib/local-config.mjs';

function normalizeHex(h) {
  h = String(h || '').trim();
  if (!h) return '';
  if (h[0] !== '#') h = '#' + h;
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`无效颜色: ${h}（需要 #RRGGBB）`);
  }
  return h.toLowerCase();
}

function parseArgs(argv) {
  const out = { primary: '', secondary: '', startDir: process.env.MK_WECHAT_START_DIR || process.cwd() };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--primary' || a === '-p') && argv[i + 1]) {
      out.primary = argv[++i];
    } else if ((a === '--secondary' || a === '-s') && argv[i + 1]) {
      out.secondary = argv[++i];
    } else if ((a === '--dir' || a === '-C') && argv[i + 1]) {
      out.startDir = argv[++i];
    } else if (a === '--help' || a === '-h') {
      out.help = true;
    } else {
      throw new Error(`未知参数: ${a}`);
    }
  }
  return out;
}

const args = parseArgs(process.argv);
if (args.help || !args.primary) {
  console.log(`用法: node scripts/set-brand.mjs --primary "#00ff88" [--secondary "#00d4ff"] [--dir <工作空间>]

将品牌色写入当前工作空间 .mk-wechat-publish/config.json（多公众号分项目）。
Agent 可根据用户描述生成色值后调用本命令；也可在设置页手动改。`);
  process.exit(args.help ? 0 : 1);
}

const primary = normalizeHex(args.primary);
const secondary = args.secondary ? normalizeHex(args.secondary) : '';
const brand = { primary };
if (secondary) brand.secondary = secondary;

const before = resolveConfig({ startDir: args.startDir });
const after = patchLocalConfig({ brand }, { startDir: args.startDir });

console.log('工作空间:', after.workspaceRoot);
console.log('写入:', after.writePath);
console.log('品牌主色:', after.config.brand.primary);
console.log('品牌次色:', after.config.brand.secondary || '（未设，渲染时由主色推导）');
if (before.config.brand.primary && before.config.brand.primary !== after.config.brand.primary) {
  console.log('（已覆盖原主色', before.config.brand.primary + '）');
}
