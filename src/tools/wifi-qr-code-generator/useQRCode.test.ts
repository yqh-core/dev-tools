import { nextTick, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useWifiQRCode } from './useQRCode';

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

describe('useWifiQRCode', () => {
  it('clears the previous QR when the SSID or required fields become invalid', async () => {
    const ssid = ref('Home-WiFi');
    const password = ref('example-password');
    const { qrcode } = useWifiQRCode({
      ssid,
      password,
      eapMethod: ref('PEAP'),
      isHiddenSSID: ref(false),
      eapAnonymous: ref(false),
      eapIdentity: ref('alice'),
      eapPhase2Method: ref('MSCHAPV2'),
      color: {
        background: ref('#ffffffff'),
        foreground: ref('#000000ff'),
      },
    });

    await flushWatch();
    expect(qrcode.value).toBe('data:WIFI:S:Home-WiFi;T:WPA;P:example-password;;');

    ssid.value = '';
    await flushWatch();
    expect(qrcode.value).toBe('');
  });
});
