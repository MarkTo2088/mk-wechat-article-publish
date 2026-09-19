// scripts/settings.mjs — 设置服务：默认写入当前工作空间 .mk-wechat-publish/config.json
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import {
  SKILL_ROOT,
  SETTINGS_PORT,
  resolveConfig,
  patchLocalConfig,
  publicConfigView,
} from './lib/local-config.mjs';
import { runProbe, formatProbeReport } from './lib/probe.mjs';

const HOST = '127.0.0.1';
const SETTINGS_HTML = path.join(SKILL_ROOT, 'assets', 'settings.html');
const START_DIR = process.env.MK_WECHAT_START_DIR || process.cwd();

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(data);
}

function mergeSave(body) {
  const view = publicConfigView(START_DIR);
  const cur = resolveConfig({ startDir: START_DIR }).config;
  const keep = body.keepSecretsIfEmpty !== false;
  const scope = body.scope === 'skill' ? 'skill' : 'workspace';

  // 补丁基于「当前写入层」已有文件，密钥留空则保留该层已保存密钥
  const wechatSecret =
    body.wechat?.appSecret && body.wechat.appSecret !== '••••••••'
      ? body.wechat.appSecret
      : keep
        ? undefined
        : '';
  const miniSecret =
    body.mini?.appSecret && body.mini.appSecret !== '••••••••'
      ? body.mini.appSecret
      : keep
        ? undefined
        : '';

  const partial = {
    brand: {
      primary: body.brand?.primary ?? cur.brand.primary,
      secondary: body.brand?.secondary ?? cur.brand.secondary,
    },
    gallery: {
      image_width: body.gallery?.image_width ?? cur.gallery.image_width,
    },
    wechat: {
      appId: body.wechat?.appId !== undefined ? body.wechat.appId : cur.wechat.appId,
    },
    mini: {
      appId: body.mini?.appId !== undefined ? body.mini.appId : cur.mini.appId,
    },
  };
  if (wechatSecret !== undefined) partial.wechat.appSecret = wechatSecret;
  if (miniSecret !== undefined) partial.mini.appSecret = miniSecret;

  return patchLocalConfig(partial, { startDir: START_DIR, scope });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${SETTINGS_PORT}`);

  if (req.method === 'OPTIONS') {
    send(res, 204, '');
    return;
  }

  if (url.pathname === '/' || url.pathname === '/settings.html') {
    send(res, 200, fs.readFileSync(SETTINGS_HTML, 'utf8'), 'text/html; charset=utf-8');
    return;
  }

  if (url.pathname === '/api/config' && req.method === 'GET') {
    send(res, 200, publicConfigView(START_DIR));
    return;
  }

  if (url.pathname === '/api/config' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      if (body.brand && !body.wechat && !body.mini && body.keepSecretsIfEmpty === undefined) {
        patchLocalConfig({ brand: body.brand }, { startDir: START_DIR });
      } else {
        mergeSave(body);
      }
      send(res, 200, { ok: true, ...publicConfigView(START_DIR) });
    } catch (e) {
      send(res, 400, { error: e.message || String(e) });
    }
    return;
  }

  if (url.pathname === '/api/probe' && req.method === 'GET') {
    try {
      const report = await runProbe({ startDir: START_DIR });
      send(res, 200, { ...report, text: formatProbeReport(report) });
    } catch (e) {
      send(res, 500, { error: e.message || String(e) });
    }
    return;
  }

  send(res, 404, { error: 'not found' });
});

server.listen(SETTINGS_PORT, HOST, () => {
  const page = `http://${HOST}:${SETTINGS_PORT}/`;
  const info = resolveConfig({ startDir: START_DIR });
  console.log(`设置页已启动: ${page}`);
  console.log(`工作空间: ${info.workspaceRoot}`);
  console.log(`写入目标: ${info.writePath}（${info.writeScope}）`);
  console.log('优先级: 工作空间配置 > skill 级 config.local.json > 环境变量');
  console.log('保存后可 Ctrl+C 结束服务（配置已落盘）。');
  const openCmd =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open';
  try {
    spawn(openCmd, [page], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    /* ignore */
  }
});
