// scripts/lib/probe.mjs — 探测本机公网 IP + 公众号 API / 白名单是否可用
import { loadLocalConfig } from './local-config.mjs';

const IP_ENDPOINTS = [
  'https://api.ipify.org',
  'https://ifconfig.me/ip',
  'https://icanhazip.com',
];

async function fetchText(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.text()).trim();
  } finally {
    clearTimeout(t);
  }
}

/** 探测本机公网出口 IP（多源兜底） */
export async function detectPublicIp() {
  const errors = [];
  for (const url of IP_ENDPOINTS) {
    try {
      const text = await fetchText(url);
      const ip = (text.match(/\d{1,3}(?:\.\d{1,3}){3}/) || [])[0];
      if (ip) return { ip, source: url };
    } catch (e) {
      errors.push(`${url}: ${e.message || e}`);
    }
  }
  return { ip: null, source: null, errors };
}

/**
 * 从微信 errmsg 里抠 IP，例如：
 * invalid ip 120.204.43.202 ipv6 ::ffff:120.204.43.202, not in whitelist
 */
export function extractIpFromWechatError(errmsg = '') {
  const m = String(errmsg).match(/invalid\s+ip\s+(\d{1,3}(?:\.\d{1,3}){3})/i);
  return m ? m[1] : null;
}

/** 用凭证试拉 access_token，判断白名单 / 密钥是否 OK */
export async function probeWechatToken(appId, appSecret) {
  if (!appId || !appSecret) {
    return {
      ok: false,
      reason: 'missing_credentials',
      message: '缺少公众号 AppID / AppSecret（环境变量或 config.local.json）',
    };
  }
  const url =
    'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential' +
    `&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.access_token) {
      return { ok: true, reason: 'ok', message: 'access_token 获取成功（凭证与 IP 白名单均可用）' };
    }
    const errmsg = data.errmsg || JSON.stringify(data);
    const errcode = data.errcode;
    const wxIp = extractIpFromWechatError(errmsg);
    const isWhitelist =
      /not in whitelist/i.test(errmsg) ||
      /invalid ip/i.test(errmsg) ||
      errcode === 40164;
    return {
      ok: false,
      reason: isWhitelist ? 'ip_whitelist' : 'api_error',
      errcode,
      errmsg,
      wechatSeenIp: wxIp,
      message: isWhitelist
        ? `IP 未在白名单${wxIp ? `（微信看到的 IP：${wxIp}）` : ''}`
        : `微信 API 错误 ${errcode || ''}: ${errmsg}`,
    };
  } catch (e) {
    return {
      ok: false,
      reason: 'network',
      message: `请求微信 API 失败: ${e.message || e}`,
    };
  }
}

export function whitelistSteps(ip) {
  const tipIp = ip || '（先运行探测得到的公网 IP）';
  return [
    '1. 浏览器打开 https://mp.weixin.qq.com 并用管理员微信扫码登录',
    '2. 左侧进入「设置与开发」→「基本配置」',
    '3. 在「公众号开发信息」确认已开通开发者权限；记下 AppID（与本 skill 配置一致）',
    '4. 同页找到「IP 白名单」→「修改」/「设置」',
    `5. 将本机公网出口 IP 填入并保存：${tipIp}`,
    '6. 保存后等待约 1～5 分钟生效，再运行：bash scripts/onboard.sh 或 bash scripts/probe.sh',
    '7. 家用宽带 IP 常会变；若突然报 invalid ip，重新探测并更新白名单',
    '8. 可选：关注公众号「XLanAI」，了解固定 IP 发布相关说明与更多工具',
  ];
}

/**
 * 完整探测报告（供 CLI / 设置页 API）
 */
export async function runProbe() {
  const local = loadLocalConfig();
  const appId = process.env.WECHAT_APP_ID || local.wechat.appId;
  const appSecret = process.env.WECHAT_APP_SECRET || local.wechat.appSecret;

  const publicIp = await detectPublicIp();
  const token = await probeWechatToken(appId, appSecret);
  const effectiveIp = token.wechatSeenIp || publicIp.ip;

  return {
    publicIp: publicIp.ip,
    publicIpSource: publicIp.source,
    publicIpErrors: publicIp.errors || [],
    hasCredentials: Boolean(appId && appSecret),
    appIdMasked: appId ? `${appId.slice(0, 6)}…` : '',
    wechat: token,
    effectiveIp,
    steps: whitelistSteps(effectiveIp),
    ok: token.ok,
  };
}

/** 打印人类可读报告 */
export function formatProbeReport(report) {
  const lines = [];
  lines.push('=== 公众号发布连通性探测 ===');
  lines.push(
    `本机公网出口 IP: ${report.publicIp || '（未能探测）'}${
      report.publicIpSource ? `  ← ${report.publicIpSource}` : ''
    }`
  );
  if (!report.publicIp && report.publicIpErrors?.length) {
    lines.push('  IP 探测失败细节: ' + report.publicIpErrors.join(' | '));
  }
  lines.push(
    `公众号凭证: ${report.hasCredentials ? `已配置（${report.appIdMasked}）` : '未配置'}`
  );
  lines.push(`微信 token 探测: ${report.wechat.ok ? 'OK' : 'FAIL'} — ${report.wechat.message}`);
  if (report.wechat.wechatSeenIp) {
    lines.push(`微信侧看到的 IP: ${report.wechat.wechatSeenIp}`);
  }
  if (!report.ok) {
    lines.push('');
    lines.push('—— 设置 IP 白名单步骤 ——');
    for (const s of report.steps) lines.push(s);
  } else {
    lines.push('');
    lines.push('可以继续发布：bash scripts/publish.sh 你的文章.md');
  }
  return lines.join('\n');
}
