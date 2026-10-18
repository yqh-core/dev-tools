import type { SignatureInfo } from './pdf-signature-checker.types';

/**
 * PDF signature checker —— 分类层（纯函数，无框架依赖）
 *
 * 为什么单独抽这一层：底层库 `pdf-signature-reader` 的返回契约是「三态混合」的——
 *   1) 解析成功：返回 { verified, authenticity, integrity, expired, signatures: [...] }
 *   2) 解析中途失败（签名结构 / 字节范围 / PKCS7 属性签名）：返回 { verified:false, message, error }，**没有 signatures 字段**
 *   3) 签名子类型检查（checkForSubFilter / preparePDF 在 try 之外）**直接抛出** VerifyPDFError
 * 老实现把这三态一律折叠成「抛异常=没有签名」，于是「篡改后的 PDF」「加密/损坏的 PDF」「签名格式不支持」
 * 全被说成同一句 "No signatures found"，还会在返回第 2 态时把 `undefined` 塞进模板读 `.length` 直接渲染崩溃。
 * 这里把三态归一成一个可判别的联合类型，UI 只消费这个结果，语义与展示彻底解耦。
 */

/** 库的 VerifyPDFError.type 常量（与 node_modules/pdf-signature-reader/VerifyPDFError.js 对齐）。 */
const ERR = {
  unknown: 'TYPE_UNKNOWN',
  input: 'TYPE_INPUT',
  parse: 'TYPE_PARSE',
  byteRange: 'TYPE_BYTE_RANGE',
  verifySignature: 'VERIFY_SIGNATURE',
  unsupportedSubFilter: 'UNSUPPORTED_SUBFILTER',
} as const;

export type CheckKind =
  /** 文件头就不是 %PDF-，压根不是 PDF（或不是可读文件）。 */
  | 'not-a-pdf'
  /** 是 PDF，但找不到任何数字签名（没有 /SubFilter）。 */
  | 'unsigned'
  /** 有签名，但其 /SubFilter 类型不在本工具支持的验证范围内。 */
  | 'unsupported-signature'
  /** 能读到 PDF 头部，但签名结构 / 文件本身无法解析（加密、截断、损坏）。 */
  | 'unreadable'
  /** 有可解析的签名，但其 PKCS#7 属性签名对不上证书公钥——签名本身无效或被伪造/破坏。 */
  | 'signature-invalid'
  /** 签名可解析，但字节范围之外还有内容——签名之后文档被追加过内容（可能改动，也可能只是非最后一枚签名）。 */
  | 'byte-range-mismatch'
  /** 成功提取到至少一枚可解析签名，逐枚给出完整性 / 证书链信任 / 有效期。 */
  | 'signed'
  /** 兜底：库返回了无法归类的形态，绝不臆造结论。 */
  | 'unknown';

export interface NormalizedError {
  type?: string
  message?: string
}

/** 允许传入 verifyPDF() 的真实返回值（宽松结构化，便于把 throw / return 两路都喂进来）。 */
export interface VerifyResultLike {
  verified?: boolean
  authenticity?: boolean
  integrity?: boolean
  expired?: boolean
  signatures?: SignatureInfo[]
  message?: string
  error?: NormalizedError
}

export interface RawCheckInput {
  /** 文件头是否匹配 %PDF-（在调用库之前由组件算好传入）。 */
  hasPdfHeader: boolean
  /** 文件尾部（最后 1KB）是否含 %%EOF 结束标记。缺它通常意味着文件被截断 / 损坏 —— 用于把「有 PDF 头但读不出内容」与「正常但未签名」区分开。 */
  hasEofMarker?: boolean
  /** 若库在 try 之外抛出，则把它归一化后放这里。 */
  thrown?: NormalizedError
  /** 若库正常返回（含内部 catch 的错误对象），则放这里。 */
  result?: VerifyResultLike
}

export interface CheckOutcome {
  kind: CheckKind
  /** 仅 'signed' 时非空：逐枚签名明细。 */
  signatures?: SignatureInfo[]
  /** 面向用户的补充说明（原始 reason 或子类型）。 */
  detail?: string
  /** 'unsupported-signature' 时尽量解析出的子类型名。 */
  subFilter?: string
  /** 计数：'signed' 时签名枚数。 */
  signatureCount?: number
}

/**
 * 从 ArrayBuffer / TypedArray 判断 PDF 魔数 `%PDF-`。
 * 规范允许头部前有最多 1024 字节二进制注释，故在前 1KB 内查找，而不是只看第 0 字节。
 */
export function hasPdfMagicBytes(source: ArrayBuffer | Uint8Array): boolean {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  const window = bytes.subarray(0, Math.min(bytes.length, 1024));
  return toLatin1(window).includes('%PDF-');
}

/**
 * 判断 PDF 结束标记 `%%EOF` 是否存在于文件尾部（最后 1KB）。
 * 只做有界字符串扫描，不解析 PDF 结构 —— 用来把「有 %PDF 头但被截断 / 损坏」的文件从「未签名」里挑出来。
 */
export function hasPdfEofMarker(source: ArrayBuffer | Uint8Array): boolean {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  const start = Math.max(0, bytes.length - 1024);
  return toLatin1(bytes.subarray(start)).includes('%%EOF');
}

// 把 ≤1KB 字节按 latin1 逐字节映射成字符串：ASCII 序列（如 %PDF-、%%EOF）会原样命中，省掉手写带标签的扫描循环。
function toLatin1(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i]);
  }
  return s;
}

function messageIs(input: string | undefined, needle: RegExp): boolean {
  return typeof input === 'string' && needle.test(input);
}

function extractSubFilter(message: string | undefined): string | undefined {
  // 库的抛出文案形如：`subFilter adbe.pkcs7.sha1 not supported`
  const m = typeof message === 'string' ? message.match(/subFilter\s+(\S+)\s+not supported/i) : null;
  return m ? m[1] : undefined;
}

/** 处理 checkForSubFilter / preparePDF 在 try 之外抛出的错误。 */
function classifyThrown(thrown: NormalizedError, hasPdfHeader: boolean, hasEofMarker: boolean): CheckOutcome {
  const type = thrown.type;
  const msg = thrown.message;

  if (type === ERR.unsupportedSubFilter) {
    return { kind: 'unsupported-signature', subFilter: extractSubFilter(msg), detail: msg };
  }
  // "cannot find subfilter" 是库对「没有 /SubFilter」的固定措辞 —— 通常意味着这是一份没签名的 PDF。
  if (type === ERR.parse && messageIs(msg, /cannot find subfilter/i)) {
    // 但有 %PDF 头却没有 %%EOF 结束标记，更可能是文件被截断 / 损坏，而非「干净的未签名 PDF」；如实降级为不可读。
    return hasEofMarker ? { kind: 'unsigned' } : { kind: 'unreadable', detail: 'PDF header present but no %%EOF trailer — the file looks truncated or damaged.' };
  }
  if (type === ERR.input) {
    // 库连 Buffer 都拿不到；若头部也不像 PDF，判 not-a-pdf，否则按不可读处理。
    return { kind: hasPdfHeader ? 'unreadable' : 'not-a-pdf', detail: msg };
  }
  return { kind: 'unreadable', detail: msg };
}

/** 处理 verifyPDF() 内部 catch 后返回的 { verified:false, message, error } 形态。 */
function classifyReturnedError(error: NormalizedError): CheckOutcome {
  const type = error.type;
  const msg = error.message;

  // 库对「字节范围校验失败」用的是 VERIFY_BYTE_RANGE 常量，但该常量并未在 VerifyPDFError 上定义，
  // 所以实际 type 为 undefined，只能靠 message 兜住 —— 这是本层必须防的一个「判据绑死常量」陷阱。
  if (type === ERR.verifySignature || messageIs(msg, /wrong authenticated attributes/i)) {
    return { kind: 'signature-invalid', detail: msg };
  }
  if (type === ERR.byteRange || messageIs(msg, /byte\s*range\s*verification/i)) {
    return { kind: 'byte-range-mismatch', detail: msg };
  }
  if (type === ERR.parse || messageIs(msg, /locate ByteRange/i)) {
    // 找不到 /ByteRange：多为签名被剥离、结构损坏或整份 PDF 被加密。
    return { kind: 'unreadable', detail: msg };
  }
  return { kind: 'unreadable', detail: msg };
}

/**
 * 核心：把「库的三态输出」归一为可判别结果。纯函数，不触碰 DOM / 不 import 库本身。
 */
export function classifyCheck(input: RawCheckInput): CheckOutcome {
  const { hasPdfHeader, thrown, result } = input;
  const hasEofMarker = input.hasEofMarker !== false; // 默认按「有结束标记」处理，只有显式 false 才降级

  // 最强信号优先：头部不像 PDF 就不要再往下猜「有没有签名」。
  if (!hasPdfHeader) {
    return { kind: 'not-a-pdf' };
  }
  if (thrown) {
    return classifyThrown(thrown, hasPdfHeader, hasEofMarker);
  }
  if (result) {
    if (Array.isArray(result.signatures) && result.signatures.length > 0) {
      return { kind: 'signed', signatures: result.signatures, signatureCount: result.signatures.length };
    }
    if (result.error) {
      return classifyReturnedError(result.error);
    }
    // 返回了对象但既无签名也无 error：视作没有可解析签名（保守，不臆造已验证）；同样受 EOF 缺失降级保护。
    if (Array.isArray(result.signatures)) {
      return hasEofMarker ? { kind: 'unsigned' } : { kind: 'unreadable', detail: 'PDF header present but no %%EOF trailer — the file looks truncated or damaged.' };
    }
    return { kind: 'unknown', detail: result.message };
  }
  return { kind: 'unknown' };
}

/* ------------------------------------------------------------------ *
 * 下面是「signed」结果之上的语义分层 —— 严格区分三件事，绝不等号划等号：
 *   签名存在 ≠ 密码学完整性 ≠ 证书链被本工具信任 ≠ 有法律效力
 * ------------------------------------------------------------------ */

export type AxisState = 'pass' | 'fail' | 'warn' | 'unknown';

export interface SignatureAxes {
  /** 密码学完整性：被签名字节范围的摘要与签名属性里记录的摘要是否一致（防篡改）。 */
  integrity: AxisState
  /** 证书链信任：签名者证书链能否验证到本工具内置受信根 CA 集合里的某个根（不含吊销检查）。 */
  trust: AxisState
  /** 有效期：链上任一证书「此刻」是否已过期 / 尚未生效（无安全时间戳时这是近似判断）。 */
  validity: AxisState
  /** 库给出的综合结论 = integrity && trust && !expired，仅供参考，不代表法律效力。 */
  verified: AxisState
}

export function signatureAxes(sig: SignatureInfo | undefined | null): SignatureAxes {
  if (!sig) {
    return { integrity: 'unknown', trust: 'unknown', validity: 'unknown', verified: 'unknown' };
  }
  return {
    integrity: sig.integrity ? 'pass' : 'fail',
    trust: sig.authenticity ? 'pass' : 'fail',
    validity: sig.expired ? 'warn' : 'pass',
    verified: sig.verified ? 'pass' : 'fail',
  };
}

export interface OverallSummary {
  signatureCount: number
  /** 所有签名的完整性都通过。 */
  allIntegrityPass: boolean
  /** 所有签名的证书链都被本工具信任。 */
  allTrustPass: boolean
  /** 存在已过期的证书。 */
  anyExpired: boolean
  /** 库的综合结论（全部 verified 才 true）。 */
  allVerified: boolean
}

export function summarizeSignatures(signatures: SignatureInfo[]): OverallSummary {
  const count = signatures.length;
  return {
    signatureCount: count,
    allIntegrityPass: count > 0 && signatures.every(s => s.integrity === true),
    allTrustPass: count > 0 && signatures.every(s => s.authenticity === true),
    anyExpired: signatures.some(s => s.expired === true),
    allVerified: count > 0 && signatures.every(s => s.verified === true),
  };
}
