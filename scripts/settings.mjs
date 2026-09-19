// scripts/settings.mjs — 本机设置服务（主题色 + 凭证 → config.local.json）
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import {
  SKILL_ROOT,
  SETTINGS_PORT,
  loadLocalConfig,
  patchLocalConfig,
  publicConfigView,
  LOCAL_CONFIG_PATH,
} from './lib/local-config.mjs';

const HOST = '127.0.0.1';
const SETTINGS_HTML = path.join(SKILL_ROOT, 'assets', 'settings.html');

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
  const cur = loadLocalConfig();
  const keep = body.keepSecretsIfEmpty !== false;
  const wechatSecret =
    body.wechat?.appSecret && body.wechat.appSecret !== '••••••••'
      ? body.wechat.appSecret
      : keep
        ? cur.wechat.appSecret
        : '';
  const miniSecret =
    body.mini?.appSecret && body.mini.appSecret !== '••••••••'
      ? body.mini.appSecret
      : keep
        ? cur.mini.appSecret
        : '';

  return patchLocalConfig({
    brand: {
      primary: body.brand?.primary ?? cur.brand.primary,
      secondary: body.brand?.secondary ?? cur.brand.secondary,
    },
    gallery: {
      image_width: body.gallery?.image_width ?? cur.gallery.image_width,
    },
    wechat: {
      appId: body.wechat?.appId !== undefined ? body.wechat.appId : cur.wechat.appId,
      appSecret: wechatSecret,
    },
    mini: {
      appId: body.mini?.appId !== undefined ? body.mini.appId : cur.mini.appId,
      appSecret: miniSecret,
    },
  });
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
    send(res, 200, publicConfigView());
    return;
  }

  if (url.pathname === '/api/config' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      // dry-run 可能只 POST brand
      if (body.brand && !body.wechat && !body.mini && body.keepSecretsIfEmpty === undefined) {
        patchLocalConfig({ brand: body.brand });
      } else {
        mergeSave(body);
      }
      send(res, 200, { ok: true, ...publicConfigView(), path: LOCAL_CONFIG_PATH });
    } catch (e) {
      send(res, 400, { error: e.message || String(e) });
    }
    return;
  }

  send(res, 404, { error: 'not found' });
});

server.listen(SETTINGS_PORT, HOST, () => {
  const page = `http://${HOST}:${SETTINGS_PORT}/`;
  console.log(`设置页已启动: ${page}`);
  console.log(`配置文件: ${LOCAL_CONFIG_PATH}`);
  console.log('保存后可 Ctrl+C 结束服务（配置已落盘，发布无需保持服务运行）。');
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
