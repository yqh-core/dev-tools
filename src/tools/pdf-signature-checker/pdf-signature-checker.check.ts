import verifyPDF from 'pdf-signature-reader';

import type { CheckOutcome, VerifyResultLike } from './pdf-signature-checker.service';
import { classifyCheck, hasPdfEofMarker, hasPdfMagicBytes } from './pdf-signature-checker.service';

/**
 * 检查编排层：把「字节 → 头部/结束标记探测 → 调用底层库 → 归一化 → 分类」串成一条链路。
 *
 * 单独成文件的原因：
 *   - 纯分类器 (pdf-signature-checker.service.ts) 不 import 底层库，可被 jsdom 下的单元测试无副作用地覆盖；
 *   - 而组件与集成测试都只调用这个 inspectPdf，保证「线上跑的路径」和「测试跑的路径」是同一份代码，
 *     不会出现「测试全绿、线上组件里另有分支逻辑」的错配。
 */
export function inspectPdf(source: ArrayBuffer): CheckOutcome {
  const bytes = new Uint8Array(source);
  const hasPdfHeader = hasPdfMagicBytes(bytes);
  const hasEofMarker = hasPdfEofMarker(bytes);

  try {
    const result = verifyPDF(source) as VerifyResultLike;
    return classifyCheck({ hasPdfHeader, hasEofMarker, result });
  }
  catch (e) {
    const err = e as { type?: string; message?: string; name?: string };
    return classifyCheck({
      hasPdfHeader,
      hasEofMarker,
      thrown: { type: err.type, message: err.message },
    });
  }
}
