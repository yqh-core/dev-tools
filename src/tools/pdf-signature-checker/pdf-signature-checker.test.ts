import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import Checker from './pdf-signature-checker.vue';
import CFileUpload from '@/ui/c-file-upload/c-file-upload.vue';

// 本仓库锁定的 jsdom 版本没有实现 File.prototype.arrayBuffer（真实浏览器早已支持，
// 线上站用的也正是这个调用）。测试环境里补一个最小实现，专门喂给组件的 onVerifyClicked。
if (typeof (File as unknown as { prototype: { arrayBuffer?: unknown } }).prototype.arrayBuffer !== 'function') {
  File.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
    const bytes = fs.readFileSync((this as unknown as { _fixturePath: string })._fixturePath);
    const out = new ArrayBuffer(bytes.length);
    new Uint8Array(out).set(bytes);
    return Promise.resolve(out);
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, '__fixtures__');

function fileOf(name: string): File {
  const buf = fs.readFileSync(path.join(fixtureDir, name));
  const file = new File([new Uint8Array(buf)], name, { type: 'application/pdf' }) as File & { _fixturePath: string };
  file._fixturePath = path.join(fixtureDir, name);
  return file;
}

async function runWith(name: string) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(Checker, {
    global: {
      plugins: [pinia],
      // 证书明细里的 PEM 弹窗 / 表格用到 naive-ui 的 useMessage（需要外层 provider）。
      // 本测试断言的是「状态映射」，把这两个叶子桩掉即可，不影响三条状态轴与顶部结论的渲染。
      stubs: { CModalValue: true, CTable: true },
    },
  });
  const uploader = wrapper.findComponent(CFileUpload);
  expect(uploader.exists(), 'c-file-upload should be registered in the tool template').toBe(true);
  uploader.vm.$emit('fileUpload', fileOf(name));
  await flushPromises();
  await flushPromises();
  return wrapper;
}

describe('pdf-signature-checker component (renders a distinct state per real fixture)', () => {
  it('unsigned PDF renders the "no signature" outcome, not a generic error', async () => {
    const wrapper = await runWith('unsigned.pdf');
    const text = wrapper.text();
    expect(text).toMatch(/No digital signature found/i);
    expect(text).toMatch(/normal for an unsigned document/i);
    expect(wrapper.find('[data-test-id="summary"]').exists()).toBe(false);
  });

  it('non-PDF file renders "not a readable PDF"', async () => {
    const wrapper = await runWith('not-a-pdf.pdf');
    expect(wrapper.text()).toMatch(/Not a readable PDF/i);
  });

  it('unsupported signature format renders its own state and names the subFilter', async () => {
    const wrapper = await runWith('unsupported-signature.pdf');
    const text = wrapper.text();
    expect(text).toMatch(/Signature format not supported/i);
    expect(text).toMatch(/adbe\.pkcs7\.sha1/);
  });

  it('truncated PDF renders the "could not read" failure, distinct from unsigned', async () => {
    const wrapper = await runWith('corrupt-truncated.pdf');
    expect(wrapper.text()).toMatch(/Couldn.t read the PDF structure/i);
  });

  it('genuinely signed PDF renders integrity=Intact alongside trust=Not trusted (never conflated)', async () => {
    const wrapper = await runWith('signed-intact-untrusted.pdf');
    const text = wrapper.text();
    // 顶部结论：完整性通过，但不被信任
    expect(text).toMatch(/cryptographically intact, but the certificate is not trusted/i);
    // 三条轴分别成行
    expect(wrapper.find('[data-test-id="axis-integrity"]').text()).toMatch(/Intact/);
    expect(wrapper.find('[data-test-id="axis-trust"]').text()).toMatch(/Not trusted/);
    expect(wrapper.find('[data-test-id="axis-validity"]').text()).toMatch(/Within validity/);
    // 明确声明：这是技术信号，不是法律效力
    expect(text).toMatch(/legal/i);
  });

  it('tampered signed PDF flips the integrity axis to Modified', async () => {
    const wrapper = await runWith('signed-tampered.pdf');
    expect(wrapper.find('[data-test-id="axis-integrity"]').text()).toMatch(/Modified/);
    expect(wrapper.text()).toMatch(/content changed after signing/i);
  });

  it('still shows the uploaded file card regardless of outcome', async () => {
    const wrapper = await runWith('unsigned.pdf');
    expect(wrapper.text()).toContain('unsigned.pdf');
  });
});
