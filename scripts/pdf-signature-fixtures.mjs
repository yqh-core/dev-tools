// 开发期一次性脚本：为 PDF 签名检查器生成「真实 PDF 测试样本」，产物提交进
//   src/tools/pdf-signature-checker/__fixtures__/
// 不新增依赖：node-forge 与 pdf-signature-reader 都随仓库可解析（后者是本工具既有依赖，
// 前者是其传递依赖）。产物是静态 PDF 文件，产品运行代码不 import 本脚本，也不会被打进包。
// 用法：node scripts/pdf-signature-fixtures.mjs
// 幂等 + 自检：生成后立刻用真实的 pdf-signature-reader 跑一遍并打印归一化后的判定，
// 任何样本达不到预期形态就非零退出，避免把「看着像其实读不出」的假样本提交进仓库。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const forge = require('node-forge');
const verifyPDF = require('pdf-signature-reader');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../src/tools/pdf-signature-checker/__fixtures__');
const HEX_PLACEHOLDER_LEN = 8192;

fs.mkdirSync(OUT, { recursive: true });

function latin1Bytes(s) {
  return Buffer.from(s, 'latin1');
}

function makeUnsignedPdf() {
  let pdf = '%PDF-1.7\n';
  pdf += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  pdf += '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  pdf += '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n';
  const xref = pdf.length;
  pdf += 'xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n';
  pdf += 'trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return latin1Bytes(pdf);
}

function makeUnsupportedPdf() {
  // 一份声明了「本工具不支持的签名子类型」的 PDF 味道文件：checkForSubFilter 会在解析前先抛出 UNSUPPORTED_SUBFILTER。
  let pdf = '%PDF-1.7\n';
  pdf += '1 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.sha1 /ByteRange [0 10 20 10] /Contents <DEADBEEF> >>\nendobj\n';
  const xref = pdf.length;
  pdf += 'xref\n0 2\n0000000000 65535 f \n0000000009 00000 n \n';
  pdf += 'trailer\n<< /Size 2 >>\nstartxref\n' + xref + '\n%%EOF\n';
  return latin1Bytes(pdf);
}

function makeCorruptPdf() {
  // 有 %PDF 头，但在中途被截断，且没有 %%EOF 结束标记 —— 代表损坏 / 下载不完整。
  const head = '%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R';
  return latin1Bytes(head);
}

function makeNotAPdf() {
  // 扩展名是 .pdf，但内容根本不是 PDF（PNG 魔数 + 文本）。
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([png, latin1Bytes('\nthis is not a pdf, it is a PNG pretending to be one\n')]);
}

function makeSignedPdf() {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  const now = new Date();
  cert.validity.notBefore = new Date(now.getTime() - 24 * 3600 * 1000);
  cert.validity.notAfter = new Date(now.getTime() + 10 * 365 * 24 * 3600 * 1000);
  const attrs = [
    { name: 'commonName', value: 'DigDevBox Test Signer' },
    { name: 'organizationName', value: 'DigDevBox' },
    { name: 'countryName', value: 'US' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const brPlaceholder = '[0000000000 0000000000 0000000000 0000000000]';
  const hexPlaceholder = '0'.repeat(HEX_PLACEHOLDER_LEN);
  const contentsPrefix = '/Contents <';
  const sigBody = '5 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /ByteRange '
    + brPlaceholder + ' ' + contentsPrefix + hexPlaceholder + '>\n>>\nendobj\n';

  let pdf = '%PDF-1.7\n';
  pdf += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [4 0 R] /SigFlags 3 >> >>\nendobj\n';
  pdf += '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  pdf += '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R >>\nendobj\n';
  pdf += '4 0 obj\n<< /Type /Annot /Subtype /Widget /FT /Sig /T (Signature1) /V 5 0 R /P 3 0 R /Rect [0 0 200 100] >>\nendobj\n';
  pdf += sigBody;
  pdf += '6 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 72 700 Td (Signed) Tj ET\nendstream\nendobj\n';
  const xrefPos = pdf.length;
  pdf += 'xref\n0 7\n0000000000 65535 f \n';
  pdf += '0000000009 00000 n \n0000000111 00000 n \n0000000172 00000 n \n0000000266 00000 n \n0000000403 00000 n \n0000009000 00000 n \n';
  pdf += 'trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF\n';

  const len = latin1Bytes(pdf).length;
  const marker = latin1Bytes('/ByteRange ' + brPlaceholder + ' ' + contentsPrefix);
  const idx = pdf.indexOf('/ByteRange ' + brPlaceholder + ' ' + contentsPrefix);
  const contentsStart = idx + marker.length - contentsPrefix.length + contentsPrefix.length; // '<' 之后
  // gap = '<' + hex + '>'
  const gapStart = idx + (('/ByteRange ' + brPlaceholder + ' ').length); // 指向 '<'
  const gapEnd = contentsStart + HEX_PLACEHOLDER_LEN + 1; // '>' 之后
  void len; void gapStart;
  const br = [0, contentsStart - 1, gapEnd, len - gapEnd];
  const realBr = '[' + br.map(n => String(n).padStart(10, '0')).join(' ') + ']';
  const patched = latin1Bytes(pdf.replace(brPlaceholder, realBr));
  if (patched.length !== len) { throw new Error('ByteRange width changed'); }

  const signed = Buffer.concat([
    patched.subarray(br[0], br[0] + br[1]),
    patched.subarray(br[2], br[2] + br[3]),
  ]);

  const md = forge.md.sha256.create();
  md.update(signed.toString('latin1'));
  const messageDigest = md.digest().getBytes();

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(signed.toString('latin1'));
  p7.addCertificate(cert);
  p7.addSigner({
    key: keys.privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest, value: messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign({ detached: true });

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  const outHex = Buffer.from(der, 'latin1').toString('hex');
  if (outHex.length > HEX_PLACEHOLDER_LEN) { throw new Error('signature too big for placeholder'); }

  const paddedHex = outHex.padEnd(HEX_PLACEHOLDER_LEN, '0');
  const hexStart = contentsStart;
  for (let i = 0; i < HEX_PLACEHOLDER_LEN; i++) {
    patched[hexStart + i] = paddedHex.charCodeAt(i);
  }
  return patched;
}

function makeTamperedSigned(signedBuf) {
  // 在被签名字节范围内改一个字节（MediaBox 612 -> 611，长度不变），模拟签名之后篡改内容。
  const buf = Buffer.from(signedBuf);
  const s = buf.toString('latin1');
  const at = s.indexOf('/MediaBox [0 0 612 792]');
  if (at === -1) { throw new Error('marker not found for tamper'); }
  buf[at + '/MediaBox [0 0 '.length + 2] = '1'.charCodeAt(0); // 612 -> 611
  return buf;
}

const samples = {
  'unsigned.pdf': makeUnsignedPdf(),
  'unsupported-signature.pdf': makeUnsupportedPdf(),
  'corrupt-truncated.pdf': makeCorruptPdf(),
  'not-a-pdf.pdf': makeNotAPdf(),
};

const signedBuf = makeSignedPdf();
samples['signed-intact-untrusted.pdf'] = signedBuf;
samples['signed-tampered.pdf'] = makeTamperedSigned(signedBuf);

// ---- 自检：用真实库跑一遍，确认形态符合预期 ----
let failed = false;
for (const [name, buf] of Object.entries(samples)) {
  fs.writeFileSync(path.join(OUT, name), buf);
  let r;
  let thrown = null;
  try { r = verifyPDF(buf); }
  catch (e) { thrown = { type: e.type, message: e.message }; }
  const summary = thrown
    ? { thrown: { type: thrown.type, message: thrown.message } }
    : {
        signatures: Array.isArray(r.signatures),
        sig0: r.signatures && r.signatures[0]
          ? { integrity: r.signatures[0].integrity, authenticity: r.signatures[0].authenticity, expired: r.signatures[0].expired }
          : null,
        errorType: r.error && r.error.type,
        errorMsg: r.error && r.error.message,
      };
  console.log(name.padEnd(30), JSON.stringify(summary));
}

// 断言：signed 样本必须真的给出 signatures 且完整性符合预期
function readBack(name) {
  const b = fs.readFileSync(path.join(OUT, name));
  try { return { r: verifyPDF(b) }; }
  catch (e) { return { thrown: e }; }
}
const intact = readBack('signed-intact-untrusted.pdf');
if (!intact.r || !Array.isArray(intact.r.signatures) || intact.r.signatures[0].integrity !== true) {
  console.error('ASSERT FAIL: signed-intact-untrusted must parse with integrity=true');
  failed = true;
}
const tampered = readBack('signed-tampered.pdf');
const tamperedIntegrityOk = tampered.r && Array.isArray(tampered.r.signatures) && tampered.r.signatures[0].integrity === false;
if (!tamperedIntegrityOk) {
  console.error('ASSERT FAIL: signed-tampered must parse with integrity=false (or be flagged)');
  failed = true;
}

if (failed) {
  process.exit(1);
}
console.log('\nAll fixtures written to', OUT);
