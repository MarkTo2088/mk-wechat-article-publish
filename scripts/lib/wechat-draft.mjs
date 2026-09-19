// scripts/lib/wechat-draft.mjs — 微信公众号草稿箱 API
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const API = 'https://api.weixin.qq.com';

async function wxGet(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`微信 API 错误 ${data.errcode}: ${data.errmsg}`);
  }
  return data;
}

async function wxPostJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`微信 API 错误 ${data.errcode}: ${data.errmsg}`);
  }
  return data;
}

/** multipart 上传（form-data + Node fetch） */
async function wxUpload(url, filePath, fieldName = 'media') {
  if (!fs.existsSync(filePath)) {
    throw new Error(`找不到文件: ${filePath}`);
  }
  const form = new FormData();
  form.append(fieldName, fs.createReadStream(filePath), {
    filename: path.basename(filePath),
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: form.getHeaders(),
    body: form,
  });
  const data = await res.json();
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`微信上传错误 ${data.errcode}: ${data.errmsg} (${path.basename(filePath)})`);
  }
  return data;
}

export async function getAccessToken(appId, appSecret) {
  const url = `${API}/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`;
  const data = await wxGet(url);
  if (!data.access_token) {
    throw new Error(`获取 access_token 失败: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

/** 正文图片 → mmbiz URL（不占素材库配额） */
export async function uploadContentImage(accessToken, filePath) {
  const url = `${API}/cgi-bin/media/uploadimg?access_token=${accessToken}`;
  const data = await wxUpload(url, filePath);
  if (!data.url) throw new Error(`uploadimg 未返回 url: ${JSON.stringify(data)}`);
  return data.url;
}

/** 封面 → 永久素材 media_id */
export async function uploadCoverMaterial(accessToken, filePath) {
  const url = `${API}/cgi-bin/material/add_material?access_token=${accessToken}&type=image`;
  const data = await wxUpload(url, filePath);
  if (!data.media_id) {
    throw new Error(`add_material 未返回 media_id: ${JSON.stringify(data)}`);
  }
  return data.media_id;
}

/**
 * 把 HTML 中本地相对/绝对路径的 <img src> 上传并替换为微信 URL。
 * 跳过已是 http(s) 的地址。
 * @returns {{ html: string, uploaded: number }}
 */
export async function rewriteLocalImages(html, accessToken, baseDir) {
  const imgRe = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)\2/gi;
  const matches = [...html.matchAll(imgRe)];
  let uploaded = 0;
  const cache = new Map(); // absPath -> wxUrl
  const srcToUrl = new Map(); // original src string -> wxUrl

  for (const m of matches) {
    const src = m[3];
    if (/^https?:\/\//i.test(src) || src.startsWith('data:')) continue;
    if (srcToUrl.has(src)) continue;

    const abs = path.isAbsolute(src) ? src : path.resolve(baseDir, src);
    let wxUrl = cache.get(abs);
    if (!wxUrl) {
      if (!fs.existsSync(abs)) {
        console.warn(`跳过不存在的图片: ${src}`);
        continue;
      }
      console.log('上传正文图:', path.basename(abs));
      wxUrl = await uploadContentImage(accessToken, abs);
      cache.set(abs, wxUrl);
      uploaded++;
    }
    srcToUrl.set(src, wxUrl);
  }

  let out = html;
  for (const [src, wxUrl] of srcToUrl) {
    // 转义 src 中的正则特殊字符
    const esc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(
      new RegExp(`(<img\\b[^>]*?\\bsrc\\s*=\\s*)(["'])${esc}\\2`, 'gi'),
      `$1$2${wxUrl}$2`
    );
  }
  return { html: out, uploaded };
}

/**
 * 发布到草稿箱（不群发）
 * @param {{ title: string, content: string, cover?: string, author?: string, digest?: string }} article
 * @param {{ appId: string, appSecret: string, baseDir: string }} creds
 */
export async function publishToWechatDraft(article, creds) {
  const { appId, appSecret, baseDir } = creds;
  const token = await getAccessToken(appId, appSecret);

  let content = article.content;
  const { html, uploaded } = await rewriteLocalImages(content, token, baseDir);
  content = html;
  console.log(`正文图片已上传: ${uploaded} 张`);

  if (!article.cover) {
    throw new Error('缺少封面 cover（frontmatter 必填，用于 thumb_media_id）');
  }
  const coverPath = path.isAbsolute(article.cover)
    ? article.cover
    : path.resolve(baseDir, article.cover);
  console.log('上传封面:', path.basename(coverPath));
  const thumbMediaId = await uploadCoverMaterial(token, coverPath);

  const body = {
    articles: [
      {
        article_type: 'news',
        title: article.title,
        author: article.author || '',
        digest: article.digest || '',
        content,
        thumb_media_id: thumbMediaId,
        need_open_comment: 0,
        only_fans_can_comment: 0,
      },
    ],
  };

  const res = await wxPostJson(
    `${API}/cgi-bin/draft/add?access_token=${token}`,
    body
  );
  return { media_id: res.media_id, thumb_media_id: thumbMediaId, uploaded };
}
