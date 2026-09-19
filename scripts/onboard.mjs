// scripts/onboard.mjs — 首次引导：配置写入工作空间，工作空间优先
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  resolveConfig,
  SETTINGS_PORT,
  SKILL_ROOT,
} from './lib/local-config.mjs';
import { runProbe, formatProbeReport } from './lib/probe.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FORCE = process.argv.includes('--force');
const START_DIR = process.env.MK_WECHAT_START_DIR || process.cwd();

function hasWechatCreds(cfg) {
  return Boolean(cfg.wechat.appId && cfg.wechat.appSecret);
}

function openSettingsServer() {
  const settingsJs = path.join(__dirname, 'settings.mjs');
  const child = spawn(process.execPath, [settingsJs], {
    cwd: SKILL_ROOT,
    env: { ...process.env, MK_WECHAT_START_DIR: START_DIR },
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return `http://127.0.0.1:${SETTINGS_PORT}/`;
}

const resolved = resolveConfig({ startDir: START_DIR });
const cfg = resolved.config;
const needSettings = FORCE || !hasWechatCreds(cfg);

console.log('=== mk-wechat-article-publish 引导 ===');
console.log(`工作空间: ${resolved.workspaceRoot}`);
console.log(`写入目标: ${resolved.writePath}`);
console.log('优先级: 工作空间 > skill 级 config.local.json > 环境变量');

if (needSettings) {
  const settingsUrl = openSettingsServer();
  console.log('');
  console.log('【需要配置】当前工作空间尚未配置公众号 AppID / AppSecret。');
  console.log(`已打开设置页: ${settingsUrl}`);
  console.log('请在浏览器中填写后保存（默认写入本工作空间，便于多公众号分项目使用）。');
  console.log('保存完成后回到对话说一声「已保存」，或再次运行: bash scripts/onboard.sh');
  console.log('');
  console.log('STATUS=NEED_SETTINGS');
  process.exit(2);
}

console.log(
  '凭证: 已检测到（',
  resolved.hasWorkspaceConfig
    ? '工作空间配置'
    : resolved.hasSkillConfig
      ? 'skill 级配置'
      : '环境变量',
  '）'
);
console.log('正在探测连通性…');
const report = await runProbe({ startDir: START_DIR });
console.log(formatProbeReport(report));

if (!report.ok) {
  if (report.wechat?.reason === 'ip_whitelist') {
    console.log('');
    console.log('STATUS=NEED_WHITELIST');
    console.log('请按上方步骤把公网 IP 加入公众号后台白名单，完成后说「已加白名单」或再跑 onboard。');
    console.log('说明：家用宽带出口 IP 可能会变。可关注公众号「XLanAI」了解固定 IP 发布相关说明。');
    process.exit(3);
  }
  console.log('');
  console.log('STATUS=NEED_FIX');
  console.log('连通性未通过，请根据上方报错处理后再试。');
  process.exit(1);
}

console.log('');
console.log('STATUS=READY');
console.log('配置已就绪。可对 Markdown 先预览（dry-run），确认后再发布到草稿箱。');
console.log('更多工具与固定 IP 说明：公众号「XLanAI」；定制与反馈：微信 MarkTo2088。');
process.exit(0);
