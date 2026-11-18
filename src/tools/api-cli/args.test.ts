/**
 * C2 参数解析单测：Newman 别名真实映射、fail-closed 校验表（不做无效别名）。
 */
import { describe, expect, it } from 'vitest';
import { parseArgs } from './args';

const run = (extra: string[]) => parseArgs(['run', '/tmp/c.json', ...extra]);

describe('parseArgs', () => {
  it('run + 位置参数 + 全标志解析', () => {
    const r = run(['-e', 'env.json', '-d', 'data.csv', '-n', '3', '--bail', '--timeout-request', '5000', '--delay-request', '200', '--reporters', 'cli,json,junit', '--report-json', 'r.json', '--report-junit', 'r.xml', '--ci', '--no-stop-on-error']);
    expect(r.ok).toBe(true);
    if (!r.ok || !('args' in r)) return; // 判别联合收窄（help/version 变体无 args）
    expect(r.args.command).toBe('run');
    expect(r.args.collectionPath).toBe('/tmp/c.json');
    expect(r.args.environmentFile).toBe('env.json');
    expect(r.args.iterationDataFile).toBe('data.csv');
    expect(r.args.iterations).toBe(3);
    expect(r.args.stopOnFailure).toBe(true); // --bail → stopOnFailure
    expect(r.args.stopOnError).toBe(false);
    expect(r.args.requestTimeoutMs).toBe(5000);
    expect(r.args.delayMs).toBe(200);
    expect(r.args.reporters).toEqual(['cli', 'json', 'junit']);
    expect(r.args.reportJsonPath).toBe('r.json');
    expect(r.args.reportJunitPath).toBe('r.xml');
    expect(r.args.ci).toBe(true);
  });

  it('长标志等价 + 默认值（timeout 30000/delay 0/stopOnError true/reporters cli）', () => {
    const r = run(['--environment', 'e.json', '--iteration-data', 'd.json', '--iteration-count', '2', '--reporters', 'cli,json', '--report-json', 'o.json']);
    expect(r.ok).toBe(true);
    if (!r.ok || !('args' in r)) return; // 判别联合收窄
    expect(r.args.environmentFile).toBe('e.json');
    expect(r.args.iterationDataFile).toBe('d.json');
    expect(r.args.iterations).toBe(2);
    expect(r.args.requestTimeoutMs).toBe(30000);
    expect(r.args.delayMs).toBe(0);
    expect(r.args.stopOnError).toBe(true);
    expect(r.args.reporters).toEqual(['cli', 'json']);
  });

  it('--help / --version 标记', () => {
    expect(parseArgs(['--help']).ok).toBe(true);
    expect(parseArgs(['-h']).ok).toBe(true);
    expect(parseArgs(['--version']).ok).toBe(true);
    expect(parseArgs(['-v']).ok).toBe(true);
  });

  it.each([
    ['未知参数', ['run', 'c.json', '--unknown']],
    ['无位置参数', []],
    ['多位置参数', ['run', 'a.json', 'b.json']],
    ['-n 非整数', ['run', 'c.json', '-n', 'abc']],
    ['-n 零', ['run', 'c.json', '-n', '0']],
    ['-n 负数', ['run', 'c.json', '-n', '-1']],
    ['reporters 非法值', ['run', 'c.json', '--reporters', 'bad']],
    ['json reporter 无路径', ['run', 'c.json', '--reporters', 'json']],
    ['report-json 无 reporter', ['run', 'c.json', '--report-json', 'r.json']],
    ['-e 缺值', ['run', 'c.json', '-e']],
    ['布尔标志后多余位置参数', ['run', 'c.json', '--bail', 'x.json']],
  ])('fail-closed：%s', (_label, argv) => {
    const r = parseArgs(argv);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.length).toBeGreaterThan(0);
  });
});
