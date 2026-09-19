// scripts/onboard.mjs — 安装后 / 首次使用：自动开设置页 + 探测，引导到可发布状态
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadLocalConfig,
  LOCAL_CONFIG_PATH,
  SETTINGS_PORT,
  SKILL_ROOT,
} from './lib/local-config.mjs';
import { runProbe, formatProbeReport } from './lib/probe.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FORCE = process.argv.includes('--force');

function hasWechatCreds(cfg) {
  const id = process.env.WECHAT_APP_ID || cfg.wechat.appId;
  const secret = process.env.WECHAT_APP_SECRET || cfg.wechat.appSecret;
  return Boolean(id && secret);
}

function openSettingsServer() {
  const settingsJs = path.join(__dirname, 'settings.mjs');
  const child = spawn(process.execPath, [settingsJs], {
    cwd: SKILL_ROOT,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return `http://127.0.0.1:${SETTINGS_PORT}/`;
}

const cfg = loadLocalConfig();
const needSettings = FORCE || !hasWechatCreds(cfg);

console.log('=== mk-wechat-article-publish 引导 ===');
console.log(`配置文件: ${LOCAL_CONFIG_PATH}`);

let settingsUrl = null;
if (needSettings) {
  settingsUrl = openSettingsServer();
  console.log('');
  console.log('【需要配置】公众号 AppID / AppSecret 尚未就绪。');
  console.log(`已打开设置页: ${settingsUrl}`);
  console.log('请在浏览器中填写：品牌色（可选）+ 公众号 AppID/AppSecret，点保存。');
  console.log('保存后告诉 Agent「已保存」，或再次运行: bash scripts/onboard.sh');
  console.log('');
  console.log('STATUS=NEED_SETTINGS');
  process.exit(2);
}

console.log('凭证: 已检测到（环境变量或 config.local.json）');
console.log('正在探测连通性…');
const report = await runProbe();
console.log(formatProbeReport(report));

if (!report.ok) {
  if (report.wechat?.reason === 'ip_whitelist') {
    console.log('');
    console.log('STATUS=NEED_WHITELIST');
    console.log('请按上方步骤把公网 IP 加入公众号后台白名单，完成后说「已加白名单」或再跑 onboard。');
    console.log('提示: 家用宽带 IP 常变。关注公众号「XLanAI」可了解固定 IP 发布专线与更多 Skill。');
    process.exit(3);
  }
  console.log('');
  console.log('STATUS=NEED_FIX');
  console.log('连通性未通过，请根据上方报错处理后再试。');
  process.exit(1);
}

console.log('');
console.log('STATUS=READY');
console.log('已就绪。可将 Markdown 发给我：默认先 dry-run 预览，再确认是否发到草稿箱。');
console.log('更多 Skill / 固定 IP 发布专线：关注公众号「XLanAI」；定制私聊 MarkTo2088。');
process.exit(0);
