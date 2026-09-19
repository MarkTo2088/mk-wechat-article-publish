// scripts/lib/local-config.mjs — skill 本地持久化配置（config.local.json）
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** skill 根目录（mk-wechat-article-publish/） */
export const SKILL_ROOT = path.resolve(__dirname, '../..');

export const LOCAL_CONFIG_PATH = path.join(SKILL_ROOT, 'config.local.json');

/** 设置页 / dry 预览共用的本机端口 */
export const SETTINGS_PORT = 18765;

export const EMPTY_CONFIG = {
  brand: { primary: '', secondary: '' },
  gallery: { image_width: 62 },
  wechat: { appId: '', appSecret: '' },
  mini: { appId: '', appSecret: '' },
};

export function loadLocalConfig() {
  try {
    if (!fs.existsSync(LOCAL_CONFIG_PATH)) return { ...EMPTY_CONFIG };
    const raw = JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8'));
    return {
      brand: {
        primary: raw?.brand?.primary || '',
        secondary: raw?.brand?.secondary || '',
      },
      gallery: {
        image_width: Number(raw?.gallery?.image_width) || 62,
      },
      wechat: {
        appId: raw?.wechat?.appId || '',
        appSecret: raw?.wechat?.appSecret || '',
      },
      mini: {
        appId: raw?.mini?.appId || '',
        appSecret: raw?.mini?.appSecret || '',
      },
    };
  } catch {
    return { ...EMPTY_CONFIG };
  }
}

export function saveLocalConfig(cfg) {
  const next = {
    brand: {
      primary: cfg?.brand?.primary || '',
      secondary: cfg?.brand?.secondary || '',
    },
    gallery: {
      image_width: Number(cfg?.gallery?.image_width) || 62,
    },
    wechat: {
      appId: cfg?.wechat?.appId || '',
      appSecret: cfg?.wechat?.appSecret || '',
    },
    mini: {
      appId: cfg?.mini?.appId || '',
      appSecret: cfg?.mini?.appSecret || '',
    },
  };
  fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

/** 合并：只更新传入的字段，其余保留 */
export function patchLocalConfig(partial) {
  const cur = loadLocalConfig();
  return saveLocalConfig({
    brand: { ...cur.brand, ...(partial.brand || {}) },
    gallery: { ...cur.gallery, ...(partial.gallery || {}) },
    wechat: { ...cur.wechat, ...(partial.wechat || {}) },
    mini: { ...cur.mini, ...(partial.mini || {}) },
  });
}

/** 给前端的配置：密钥脱敏（仅返回是否已填） */
export function publicConfigView(cfg = loadLocalConfig()) {
  return {
    brand: { ...cfg.brand },
    gallery: { ...cfg.gallery },
    wechat: {
      appId: cfg.wechat.appId || '',
      appSecret: cfg.wechat.appSecret ? '••••••••' : '',
      hasSecret: Boolean(cfg.wechat.appSecret),
    },
    mini: {
      appId: cfg.mini.appId || '',
      appSecret: cfg.mini.appSecret ? '••••••••' : '',
      hasSecret: Boolean(cfg.mini.appSecret),
    },
    path: LOCAL_CONFIG_PATH,
  };
}
