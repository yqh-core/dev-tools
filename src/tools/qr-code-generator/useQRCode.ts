import { type MaybeRef, get } from '@vueuse/core';
import QRCode, { type QRCodeErrorCorrectionLevel, type QRCodeToDataURLOptions } from 'qrcode';
import { isRef, ref, watch } from 'vue';

export function useQRCode({
  text,
  color: { background, foreground },
  errorCorrectionLevel,
  options,
}: {
  text: MaybeRef<string>
  color: { foreground: MaybeRef<string>; background: MaybeRef<string> }
  errorCorrectionLevel?: MaybeRef<QRCodeErrorCorrectionLevel>
  options?: QRCodeToDataURLOptions
}) {
  const qrcode = ref('');
  let requestId = 0;

  watch(
    [text, background, foreground, errorCorrectionLevel].filter(isRef),
    async () => {
      const currentRequest = ++requestId;
      const value = get(text).trim();
      if (!value) {
        qrcode.value = '';
        return;
      }
      const generated = await QRCode.toDataURL(value, {
        color: {
          dark: get(foreground),
          light: get(background),
          ...options?.color,
        },
        errorCorrectionLevel: get(errorCorrectionLevel) ?? 'M',
        ...options,
      });
      if (currentRequest === requestId) {
        qrcode.value = generated;
      }
    },
    { immediate: true },
  );

  return { qrcode };
}
