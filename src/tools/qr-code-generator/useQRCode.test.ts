import { nextTick, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useQRCode } from './useQRCode';

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(async (value: string) => `data:${value}`),
  },
}));

async function flushWatch() {
  await nextTick();
  await Promise.resolve();
  await Promise.resolve();
}

describe('useQRCode', () => {
  it('clears the previous QR when the text becomes empty', async () => {
    const text = ref('https://example.com');
    const { qrcode } = useQRCode({
      text,
      color: {
        background: ref('#ffffffff'),
        foreground: ref('#000000ff'),
      },
    });

    await flushWatch();
    expect(qrcode.value).toBe('data:https://example.com');

    text.value = '';
    await flushWatch();
    expect(qrcode.value).toBe('');
  });
});
