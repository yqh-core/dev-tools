// Cloudflare Pages Function: /api/today
// 「历史上的今天」——使用内置精选数据集（均为公认史料），自包含、无外部依赖、无 CORS 问题。
// 数据集会持续补充；未收录日期返回友好提示。

const DATA = {
  '01-01': [{ year: 1912, title: '中华民国临时政府成立，孙中山就任临时大总统' }],
  '01-08': [{ year: 1976, title: '周恩来逝世' }],
  '01-21': [{ year: 1924, title: '列宁逝世' }],
  '02-12': [{ year: 1912, title: '清帝溥仪退位，清朝灭亡' }],
  '03-12': [{ year: 1925, title: '孙中山在北京逝世' }],
  '04-05': [{ year: 1976, title: '四五运动（天安门悼念周恩来）' }],
  '05-01': [{ year: 1886, title: '芝加哥大罢工，后确立国际劳动节' }],
  '05-04': [{ year: 1919, title: '五四运动爆发' }],
  '05-12': [{ year: 2008, title: '汶川大地震发生' }],
  '06-01': [{ year: 1950, title: '国际儿童节确立' }],
  '06-28': [{ year: 1919, title: '《凡尔赛和约》签署，第一次世界大战结束' }],
  '07-01': [
    { year: 1921, title: '中国共产党第一次全国代表大会召开' },
    { year: 1997, title: '香港回归祖国' },
  ],
  '07-07': [{ year: 1937, title: '卢沟桥事变，全面抗日战争爆发' }],
  '07-20': [{ year: 1969, title: '阿波罗11号宇航员登陆月球' }],
  '08-01': [{ year: 1927, title: '南昌起义爆发' }],
  '08-08': [{ year: 2008, title: '北京奥运会开幕' }],
  '08-15': [{ year: 1945, title: '日本宣布无条件投降' }],
  '09-02': [{ year: 1945, title: '日本正式签署投降书，第二次世界大战结束' }],
  '09-03': [{ year: 1945, title: '中国抗日战争胜利纪念日' }],
  '09-09': [{ year: 1976, title: '毛泽东逝世' }],
  '09-18': [{ year: 1931, title: '九一八事变' }],
  '10-01': [{ year: 1949, title: '中华人民共和国成立' }],
  '10-10': [{ year: 1911, title: '武昌起义，辛亥革命爆发' }],
  '10-25': [{ year: 1971, title: '中华人民共和国恢复联合国合法席位' }],
  '11-09': [{ year: 1989, title: '柏林墙倒塌' }],
  '11-11': [{ year: 1918, title: '第一次世界大战停战' }],
  '12-12': [{ year: 1936, title: '西安事变' }],
  '12-20': [{ year: 1999, title: '澳门回归祖国' }],
  '12-25': [{ year: 1991, title: '苏联解体' }],
}

export async function onRequestGet() {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const key = `${mm}-${dd}`
  const events = (DATA[key] || []).map((e) => ({ date: String(e.year), title: e.title }))
  return Response.json({
    date: key,
    events,
    note: events.length ? undefined : '今日暂无收录事件，数据集持续完善中',
  })
}
