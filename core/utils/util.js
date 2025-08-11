import axios from 'axios';
import os from 'os';
import path from 'path';
import https from 'https'
export function checkOSRules(rules) {
  // 如果没传入rules或为空数组，直接返回true
  if (!rules || rules.length === 0) {
    return true;
  }
  let osMap = {
    osx: 'darwin',
    linux: 'linux',
    windows: 'win32'
  }
  let platform = os.platform().toLowerCase()
  return rules.every(rule => {
    let pass = false
    let expectOS = osMap[rule?.os?.name]
    if (expectOS === platform || !rule?.os) {
      pass = true
    }
    if (rule.action === 'disallow') {
      pass = !pass
    }
    return pass
  })
}

export async function getJsonObjectFromUrl(url, axiosConfig = {}) {
  const res = await axios.get(url, {
    responseType: 'json',
    responseEncoding: 'utf-8',
    ...axiosConfig
  })
  return res.data
}
export function mavenToPath(mavenStr) {
  // 去掉中括号
  const cleanStr = mavenStr.replace(/^\[|\]$/g, '');
  // 分割主要部分和扩展名
  const [mainPart, extension = 'jar'] = cleanStr.split('@');
  // 分割各部分
  const parts = mainPart.split(':');
  const [groupId, artifactId, version, classifier] = parts;
  // 构建路径
  const groupPath = groupId.replace(/\./g, '\\');
  const baseFilename = `${artifactId}-${version}`;
  const classifierPart = classifier ? `-${classifier}` : '';
  const filename = `${baseFilename}${classifierPart}.${extension}`;
  return path.join(groupPath, artifactId, version, filename)
}
export function argsArrayToObject(arr) {
  const params = {};
  for (let i = 0; i < arr.length; i += 2) {
    const key = arr[i].startsWith('--') ? arr[i] : arr[i];
    params[key] = arr[i + 1];
  }
  return params;
}
export function isMavenLikePath(index) {
  if (!index) { return false }
  if (index.startsWith('[') && index.endsWith(']')) { return true }
  return false
}
export function dedupeLibs(dependencies) {
  const grouped = {};
  for (const dep of dependencies) {
    const [groupId, artifactId, version, classifier] = dep.name.split(':');
    const key = `${groupId}:${artifactId}${classifier ? ':' + classifier : ''}`;
    if (!grouped[key]) {
      grouped[key] = dep;
    } else {
      const currentVersion = version;
      const storedVersion = grouped[key].name.split(':')[2];
      if (compareVersions(currentVersion, storedVersion) > 0) {
        grouped[key] = dep;
      }
    }
  }
  return Object.values(grouped);
}
export function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 !== num2) {
      return num1 - num2;
    }
  }
  return 0;
}


export async function getDownloadFileName(url) {
  try {
    // 发送 HEAD 请求（只获取响应头，不下载文件）
    const response = await axios.head(url, {
      maxRedirects: 5, // 允许重定向
      httpsAgent: new https.Agent({ rejectUnauthorized: false }), // 忽略 SSL 错误（可选）
      headers:{
        "User-Agent":'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0'
      }
    });

    // 尝试从 `Content-Disposition` 获取文件名
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename="(.+?)"/);
      if (fileNameMatch && fileNameMatch[1]) {
        return fileNameMatch[1];
      }
    }

    // 如果 `Content-Disposition` 不存在，尝试从 URL 解析文件名
    const finalUrl = response.request.res.responseUrl || url;
    const fileNameFromUrl = finalUrl.split('/').pop();
    return fileNameFromUrl.split('?')[0]; // 去掉查询参数
  } catch (error) {
    console.error('获取文件名失败:', error.message);
    return null;
  }
}