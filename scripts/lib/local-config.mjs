// scripts/lib/local-config.mjs — 多公众号：配置跟工作空间走，工作空间优先
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** skill 安装/源码根目录 */
export const SKILL_ROOT = path.resolve(__dirname, '../..');

/** skill 级兜底配置（跨工作空间默认） */
export const SKILL_CONFIG_PATH = path.join(SKILL_ROOT, 'config.local.json');

/** @deprecated 兼容旧名，等同 SKILL_CONFIG_PATH */
export const LOCAL_CONFIG_PATH = SKILL_CONFIG_PATH;

export const WORKSPACE_CONFIG_DIRNAME = '.mk-wechat-publish';
export const WORKSPACE_CONFIG_FILENAME = 'config.json';

export const SETTINGS_PORT = 18765;

export const EMPTY_CONFIG = {
  brand: { primary: '', secondary: '' },
  gallery: { image_width: 62 },
  wechat: { name: '', appId: '', appSecret: '' },
  mini: { appId: '', appSecret: '' },
};

function normalizeConfig(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      brand: { ...EMPTY_CONFIG.brand },
      gallery: { ...EMPTY_CONFIG.gallery },
      wechat: { ...EMPTY_CONFIG.wechat },
      mini: { ...EMPTY_CONFIG.mini },
    };
  }
  return {
    brand: {
      primary: raw?.brand?.primary || '',
      secondary: raw?.brand?.secondary || '',
    },
    gallery: {
      image_width: Number(raw?.gallery?.image_width) || 62,
    },
    wechat: {
      name: raw?.wechat?.name || '',
      appId: raw?.wechat?.appId || '',
      appSecret: raw?.wechat?.appSecret || '',
    },
    mini: {
      appId: raw?.mini?.appId || '',
      appSecret: raw?.mini?.appSecret || '',
    },
  };
}

function readConfigFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return normalizeConfig(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    return null;
  }
}

/**
 * 从 startDir 向上找工作空间根：
 * 1) 已有 .mk-wechat-publish/ 的目录
 * 2) 含 .git 的目录
 * 3) 回退为 startDir 本身
 */
export function findWorkspaceRoot(startDir = process.cwd()) {
  let dir = path.resolve(startDir || process.cwd());
  const { root } = path.parse(dir);
  let gitRoot = null;
  while (true) {
    if (fs.existsSync(path.join(dir, WORKSPACE_CONFIG_DIRNAME))) {
      return dir;
    }
    if (!gitRoot && fs.existsSync(path.join(dir, '.git'))) {
      gitRoot = dir;
    }
    if (dir === root) break;
    dir = path.dirname(dir);
  }
  return gitRoot || path.resolve(startDir || process.cwd());
}

export function workspaceConfigPath(workspaceRoot) {
  return path.join(
    workspaceRoot,
    WORKSPACE_CONFIG_DIRNAME,
    WORKSPACE_CONFIG_FILENAME
  );
}

function nonEmpty(v) {
  return v != null && String(v).trim() !== '';
}

/** 字段级：workspace 有值则覆盖 skill */
function mergeLayer(base, over) {
  const b = normalizeConfig(base);
  const o = normalizeConfig(over);
  return {
    brand: {
      primary: nonEmpty(o.brand.primary) ? o.brand.primary : b.brand.primary,
      secondary: nonEmpty(o.brand.secondary)
        ? o.brand.secondary
        : b.brand.secondary,
    },
    gallery: {
      image_width: o.gallery.image_width || b.gallery.image_width || 62,
    },
    wechat: {
      name: nonEmpty(o.wechat.name) ? o.wechat.name : b.wechat.name,
      appId: nonEmpty(o.wechat.appId) ? o.wechat.appId : b.wechat.appId,
      appSecret: nonEmpty(o.wechat.appSecret)
        ? o.wechat.appSecret
        : b.wechat.appSecret,
    },
    mini: {
      appId: nonEmpty(o.mini.appId) ? o.mini.appId : b.mini.appId,
      appSecret: nonEmpty(o.mini.appSecret)
        ? o.mini.appSecret
        : b.mini.appSecret,
    },
  };
}

function envCredentials() {
  return {
    brand: { primary: '', secondary: '' },
    gallery: { image_width: 62 },
    wechat: {
      name: process.env.WECHAT_ACCOUNT_NAME || '',
      appId: process.env.WECHAT_APP_ID || '',
      appSecret: process.env.WECHAT_APP_SECRET || '',
    },
    mini: {
      appId: process.env.WECHAT_MINI_APP_ID || '',
      appSecret: process.env.WECHAT_MINI_APP_SECRET || '',
    },
  };
}

/**
 * 有效配置（多公众号）
 * 优先级（高→低）：
 * - 工作空间 .mk-wechat-publish/config.json
 * - skill 级 config.local.json
 * - 环境变量（仅凭证字段）
 *
 * @param {{ startDir?: string }} [opts] startDir 建议传文章所在目录或项目 cwd
 */
export function resolveConfig(opts = {}) {
  const startDir = opts.startDir || process.cwd();
  const workspaceRoot = findWorkspaceRoot(startDir);
  const wsPath = workspaceConfigPath(workspaceRoot);
  const skillPath = SKILL_CONFIG_PATH;

  const workspace = readConfigFile(wsPath);
  const skill = readConfigFile(skillPath);
  const env = envCredentials();

  // 工作空间 > skill > env（凭证）
  let merged = normalizeConfig(EMPTY_CONFIG);
  merged = mergeLayer(merged, env);
  if (skill) merged = mergeLayer(merged, skill);
  if (workspace) merged = mergeLayer(merged, workspace);

  const writeScope =
    process.env.MK_WECHAT_CONFIG_SCOPE === 'skill' ||
    process.env.MK_WECHAT_CONFIG_SCOPE === 'global'
      ? 'skill'
      : 'workspace';

  return {
    config: merged,
    workspaceRoot,
    workspaceConfigPath: wsPath,
    skillConfigPath: skillPath,
    hasWorkspaceConfig: Boolean(workspace),
    hasSkillConfig: Boolean(skill),
    writeScope,
    writePath: writeScope === 'skill' ? skillPath : wsPath,
  };
}

/** @deprecated 兼容：返回合并后的配置对象 */
export function loadLocalConfig(startDir) {
  return resolveConfig({ startDir }).config;
}

export function saveConfigToPath(filePath, cfg) {
  const next = normalizeConfig(cfg);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

/** 默认写入工作空间；MK_WECHAT_CONFIG_SCOPE=skill 时写 skill 级 */
export function saveLocalConfig(cfg, opts = {}) {
  const resolved = resolveConfig({ startDir: opts.startDir });
  const target =
    opts.path ||
    (opts.scope === 'skill' ? resolved.skillConfigPath : resolved.writePath);
  return saveConfigToPath(target, cfg);
}

/**
 * 合并补丁并保存到写入目标（默认工作空间）
 * partial 只含 brand 时：读当前有效配置再写回工作空间文件（不把 env/skill 密钥误写入，除非工作空间已有）
 */
export function patchLocalConfig(partial, opts = {}) {
  const resolved = resolveConfig({ startDir: opts.startDir });
  const target =
    opts.path ||
    (opts.scope === 'skill' ? resolved.skillConfigPath : resolved.writePath);

  // 写入层：若目标文件已存在则基于该文件补丁，否则从 EMPTY 开始只写入 partial（避免把 env 密钥固化进仓库旁文件除非用户已保存过）
  const existing = readConfigFile(target) || normalizeConfig(EMPTY_CONFIG);
  const next = {
    brand: { ...existing.brand, ...(partial.brand || {}) },
    gallery: { ...existing.gallery, ...(partial.gallery || {}) },
    wechat: { ...existing.wechat, ...(partial.wechat || {}) },
    mini: { ...existing.mini, ...(partial.mini || {}) },
  };
  saveConfigToPath(target, next);
  return resolveConfig({ startDir: opts.startDir });
}

export function publicConfigView(startDir) {
  const resolved = resolveConfig({ startDir });
  const cfg = resolved.config;
  return {
    brand: { ...cfg.brand },
    gallery: { ...cfg.gallery },
    wechat: {
      name: cfg.wechat.name || '',
      appId: cfg.wechat.appId || '',
      appSecret: cfg.wechat.appSecret ? '••••••••' : '',
      hasSecret: Boolean(cfg.wechat.appSecret),
    },
    mini: {
      appId: cfg.mini.appId || '',
      appSecret: cfg.mini.appSecret ? '••••••••' : '',
      hasSecret: Boolean(cfg.mini.appSecret),
    },
    path: resolved.writePath,
    scope: resolved.writeScope,
    workspaceRoot: resolved.workspaceRoot,
    workspaceConfigPath: resolved.workspaceConfigPath,
    skillConfigPath: resolved.skillConfigPath,
    hasWorkspaceConfig: resolved.hasWorkspaceConfig,
    hasSkillConfig: resolved.hasSkillConfig,
  };
}
