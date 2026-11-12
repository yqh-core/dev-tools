/**
 * 智能入口（WP-003 阶段 A，对标 DevToys Smart Detection 的简化版）。
 *
 * 纪律（yqh 裁定）：**确定性识别，不识别就不假装识别**。无 AI、无网络。
 * 识别顺序：json → jwt → curl → docker run → cron → env → yaml → unknown。
 * chain = 可在本工作台直接开链；route = 推荐去已有独立工具（不假处理）；
 * none = 认得但本阶段不处理（如实说明，如 cURL 导入属阶段 B）。
 */

import JSON5 from 'json5';
import { parse as yamlParse } from 'yaml';
import { isValidCron } from 'cron-validator';
import { decodeBase64Url } from './workspace-link';
import type { ParseSource } from './pipeline';

export type DetectedKind = 'json' | 'jwt' | 'curl' | 'docker-run' | 'cron' | 'env' | 'yaml' | 'unknown';

export interface Detection {
  kind: DetectedKind
  label: string
  action: 'chain' | 'route' | 'none'
  source?: ParseSource
  route?: string
  note: string
}

function unknown(note: string): Detection {
  return { kind: 'unknown', label: 'Unrecognized', action: 'none', note };
}

export function detectInput(raw: string): Detection {
  const text = raw.trim();
  if (text === '') {
    return unknown('Empty input.');
  }

  // JSON：以 { 或 [ 开头且能解析
  if (/^[\[{]/.test(text)) {
    try {
      JSON5.parse(text);
      return { kind: 'json', label: 'JSON', action: 'chain', note: 'JSON detected — ready to format, query and transform.' };
    }
    catch {
      // 看起来像 JSON 但解析失败：继续往下试，最终落 unknown，不假装识别
    }
  }

  // JWT：三段 base64url，且 header 解出含 alg/typ 的 JSON
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(text)) {
    try {
      const header = JSON.parse(decodeBase64Url(text.split('.')[0])) as Record<string, unknown>;
      if (header && typeof header === 'object' && ('alg' in header || 'typ' in header)) {
        return { kind: 'jwt', label: 'JWT', action: 'route', route: '/jwt-parser', note: 'JWT detected — decode and inspect it in the JWT Parser.' };
      }
    }
    catch {
      // 不是 JWT，继续
    }
  }

  // cURL：认得，但导入/发送属阶段 B（API Debug），本阶段不假处理
  if (/^curl\b/i.test(text)) {
    return { kind: 'curl', label: 'cURL', action: 'none', note: 'cURL command detected — import and send arrives with the API Debug workspace (Phase B). This workspace does not fake-process it.' };
  }

  // docker run：推荐去已有的 compose 转换器
  if (/^docker\s+run\b/i.test(text)) {
    return { kind: 'docker-run', label: 'docker run', action: 'route', route: '/docker-run-to-docker-compose-converter', note: 'docker run command detected — convert it to Compose in the dedicated tool.' };
  }

  // cron：标准 5 字段且通过 cron-validator
  const fields = text.split(/\s+/);
  if (fields.length === 5) {
    try {
      if (isValidCron(text)) {
        return { kind: 'cron', label: 'cron', action: 'route', route: '/crontab-generator', note: 'cron expression detected — explore schedules in the Crontab Generator.' };
      }
    }
    catch {
      // 非法 cron，继续
    }
  }

  // .env：所有有效行都是 KEY=VALUE（可带 export 前缀）
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '' && !l.startsWith('#'));
  if (lines.length > 0 && lines.every(l => /^(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=/.test(l))) {
    return { kind: 'env', label: '.env', action: 'chain', source: 'env', note: '.env detected — parse it to JSON and keep working.' };
  }

  // YAML：有键值信号且能解析为对象/数组（标量不算，避免把散文当 YAML）
  if (/(^|\n)\s*[\w."'-]+\s*:(\s|$)/.test(text) || text.startsWith('---')) {
    try {
      const value = yamlParse(text, { merge: true });
      if (value !== null && typeof value === 'object') {
        return { kind: 'yaml', label: 'YAML', action: 'chain', source: 'yaml', note: 'YAML detected — parse it to JSON and keep working.' };
      }
    }
    catch {
      // 不是合法 YAML，继续
    }
  }

  return unknown('No recognized format — paste JSON to start, or add a step manually.');
}
