/**
 * 中文使用说明（zh locale 专用）。
 *
 * 与 `guides.en.ts` 的 key 集合必须完全一致：只补一种语言会让另一种语言的
 * 工具页缺说明。该一致性由 `scripts/check-guides-i18n.mjs` 在构建期强制校验。
 *
 * 共 101 条。
 */

import type { ToolGuide } from './guides.types';

export const GUIDES: Record<string, ToolGuide> = {
  '/ascii-text-drawer': {
    intro: '把普通文字变成用字符拼成的「艺术字」，适合放在代码注释、终端横幅或 README 顶部。',
    steps: ['在输入框里填要转换的文字（建议 10 个字符以内，太长会折行）', '在下方挑选喜欢的字体样式', '点复制按钮把结果带走'],
    notes: ['中文字符一般没有对应的艺术字体，建议用英文或数字'],
    example: { label: '填入示例文字', text: 'DevBox' },
  },

  '/base-converter': {
    intro: '在十进制、十六进制、二进制、八进制乃至 base64 之间换算同一个数字，调试位运算和协议字段时很常用。',
    steps: ['在任意一个进制的输入框里填数字', '其余进制会自动同步换算结果', '需要哪种结果就从对应框里复制'],
    notes: ['转换的是「数字」而不是「文本」：想转文本请先用「文本到 ASCII 二进制」'],
    example: { label: '填入示例数字', text: '255' },
  },

  '/base64-file-converter': {
    intro: '把文件（图片、PDF 等）编码成 Base64 字符串，用于内联到 HTML/CSS 或接口报文里。',
    steps: ['点上传区选择文件，或直接把文件拖进来', '右侧会生成对应的 Base64 串', '点复制按钮复制；需要 data URI 形式时勾选对应选项'],
    notes: ['Base64 会让体积膨胀约三分之一，大文件请谨慎内联'],
  },

  '/base64-string-converter': {
    intro: '把文本编码成 Base64，或把 Base64 还原成原文。传参、塞 Authorization 头、临时隐藏明文时用得多。',
    steps: ['在左侧输入文本', '右侧即时给出编码结果', '要解码时点方向切换按钮，把 Base64 粘到左侧即可'],
    notes: ['Base64 是编码不是加密，任何人都能解回来，别用它存密码'],
    about: 'Base64 是一种用 64 个可打印 ASCII 字符表示数据的编码，让二进制内容能走纯文本通道：邮件（MIME）、data URL、HTTP Basic 凭证、JSON 字段都靠它。它把每 3 个字节映射成 4 个字符，输入不是 3 的倍数时用 = 补齐结尾。',
    faqs: [
      { q: 'Base64 是加密吗？', a: '不是。它是可逆编码，没有密钥可言，任何人都能解回来。密码、令牌的保护请用真正的加密或哈希，Base64 只解决「能传输」不解决「防偷看」。' },
      { q: '为什么结果结尾有一两个 = 号？', a: 'Base64 按 3 字节一组处理，最后一组不满时用 = 把输出补到 4 的倍数。补位符不携带数据，原样保留即可。' },
      { q: '为什么我的 Base64 放进 URL 就坏了？', a: '标准字母表里的 + 和 / 在 URL 里有特殊含义。解码这类值时打开本工具的 URL-safe 开关；要放进查询参数，先做一次百分号编码。' },
    ],
    example: { label: '填入示例文本', text: 'Hello DigDevBox' },
  },

  '/basic-auth-generator': {
    intro: '根据用户名和密码生成 HTTP Basic 认证的 Authorization 头，调试接口时直接粘走。',
    steps: ['填用户名', '填密码', '复制生成的 Authorization 头'],
    notes: ['Basic 认证只是把账号密码做 Base64，必须配合 HTTPS 使用'],
    example: { label: '填入示例用户名', text: 'admin' },
  },

  '/bcrypt': {
    intro: '用 bcrypt 对密码做哈希，或校验一段明文是否匹配某个哈希。注册登录的密码存储标准做法。',
    steps: ['在输入框里填明文密码', '点生成得到哈希串', '校验时把哈希填到对应框，再填明文，点比较'],
    notes: [
      'bcrypt 是哈希不是加密，过程不可逆，没有「解密」这一说',
      '强度（cost）越大越慢也越安全，线上常用 10～12',
      '同样的明文每次生成的哈希都不同，这是正常的（盐随机）',
    ],
    example: { label: '填入示例密码', text: 'MyP@ssw0rd' },
  },

  '/benchmark-builder': {
    intro: '给多段代码计时并横向对比，用来快速判断哪种写法更快。',
    steps: ['在代码区填入要对比的若干实现', '点运行', '看各段的耗时与相对倍率'],
    notes: ['浏览器端的计时受机器负载影响，差异在 10% 以内时不建议下结论'],
  },

  '/bip39-generator': {
    intro: '生成或校验 BIP39 助记词，也能从助记词推出种子。玩钱包、做密钥管理时用。',
    steps: ['选择助记词长度（常见 12 词）', '点生成得到助记词', '已有助记词时粘进去可以校验并推导种子'],
    notes: ['助记词等于私钥，生成后请离线保存，不要粘到任何在线工具里长期留存'],
  },

  '/camera-recorder': {
    intro: '调用摄像头拍照或录一段视频，用来快速验证设备是否正常、或拍个临时素材。',
    steps: ['点开启，浏览器弹出授权时选择允许', '拍照或开始录制', '结束后可直接下载'],
    notes: ['浏览器要求 HTTPS 才允许调用摄像头', '画面只在本机处理，不会上传'],
  },

  '/case-converter': {
    intro: '批量改大小写并在 camelCase、snake_case、kebab-case 等命名风格之间互转，写接口字段和常量时很省事。',
    steps: ['粘贴原始文本', '在下方点选目标风格', '复制结果'],
    example: { label: '填入示例文本', text: 'hello world example' },
  },

  '/chmod-calculator': {
    intro: '用勾选的方式算 chmod 权限值和命令，不用再背 rwx 对应几。',
    steps: ['勾选所有者、群组、其他人各自的读/写/执行', '上方实时显示数字形式（如 755）和符号形式', '复制生成的 chmod 命令'],
    notes: ['给文件加执行权限要谨慎，尤其是 777'],
    about: 'chmod 控制 Linux/macOS 上谁能读、写、执行一个文件。权限按所有者、群组、其他人分三组，每组是读（4）、写（2）、执行（1）的和——所以 755 读出来就是 rwxr-xr-x。',
    faqs: [
      { q: '755 到底是什么意思？', a: '所有者有读、写、执行（7 = 4+2+1），群组和其他人只有读和执行（5 = 4+1）。这是目录和「别人可以运行但不该改」的脚本最常用的权限。' },
      { q: '什么时候可以用 777？', a: '几乎永远不要。它让机器上任何用户都能改和执行这个文件，是网页脚本被篡改、目录被清空的最快方式。永远用能工作的最小权限。' },
      { q: '数字形式和符号形式该用哪个？', a: '两者描述的是同一件事。数字形式（644）紧凑、适合写进脚本；符号形式（u=rw,go=r）只改你提到的位，对共享文件做小调整时更安全。' },
    ],
  },

  '/chronometer': {
    intro: '一个干净的秒表/计时器，用来测耗时或当番茄钟用。',
    steps: ['点开始计时', '需要分段时点计次', '点停止查看总时长'],
  },

  '/color-converter': {
    intro: '在 HEX、RGB、HSL 和 CSS 颜色名之间换算，改设计稿或调主题时常用。',
    steps: ['在任意一种格式里输入或取色', '其余格式会自动同步', '复制需要的那一种'],
    example: { label: '填入示例色值', text: '#ff6600' },
  },

  '/crontab-generator': {
    intro: '校验 cron 表达式并翻译成人话，同时能反向下次执行时间。配置定时任务前先来这里验证。',
    steps: ['在表达式框里填 cron（如 */5 * * * *）', '看下方的人类可读说明，确认是不是你想要的频率', '按给出的时间预览核对'],
    notes: [
      '五段式是「分 时 日 月 周」，顺序记错是最常见的错误',
      '注意服务器时区， cron 按机器本地时区跑',
    ],
    about: 'cron 是类 Unix 系统的定时任务调度器，它把整个排期压缩进五个字段：分、时、日、月、周。一个字符写错，任务就会在错误的时间静默执行——先在这里校验表达式、预览接下来的执行时间，再提交到服务器，能省掉真实的排查时间。',
    faqs: [
      { q: '为什么我的任务总在错的钟点跑？', a: '多数是时区问题：cron 按服务器本地时间执行，服务器可能和你不在一个时区，也可能设的是 UTC。先在机器上用 date 命令确认，再换算你的排期。' },
      { q: '* 和 */5 有什么区别？', a: '* 表示该字段的每个取值；*/5 表示每隔 5 个取一次。所以 * * * * * 每分钟跑一次，而 */5 * * * * 从第 0 分开始每 5 分钟跑一次。' },
      { q: '「日」和「周」两个字段为什么不能叠加？', a: '当两个字段都被限定（不是 *）时，cron 的规则是命中任意一个就执行，不是同时满足。这个 OR 语义坑过很多人——除非你明确要这个行为，否则只限定其中一个。' },
    ],
    example: { label: '填入示例表达式', text: '*/5 * * * *' },
  },

  '/date-converter': {
    intro: '把时间换算成时间戳，或反过来把时间戳变回可读时间，还能看各种格式。',
    steps: ['选择用当前时间，或手动填一个时间', '读对应的 Unix 时间戳与各种格式化结果', '需要秒级还是毫秒级注意区分'],
    notes: ['Unix 时间戳通常是秒（10 位），JavaScript 的 Date.now() 是毫秒（13 位）'],
  },

  '/device-information': {
    intro: '显示当前设备的屏幕、像素比、User-Agent 等信息，排查兼容性问题时用来取证。',
    steps: ['打开页面即可看到全部信息', '点复制把关键字段带走'],
  },

  '/docker-run-to-docker-compose-converter': {
    intro: '把一长串 docker run 命令转成 docker-compose.yml，迁移到 compose 管理时省去手写。',
    steps: ['把 docker run 命令粘贴进输入框', '右侧自动生成 compose 片段', '检查端口映射和卷挂载后再复制使用'],
    notes: ['自动转换只覆盖常见参数，健康检查、网络别名等复杂配置需要手工补'],
    example: { label: '填入示例命令', text: 'docker run -d --name web -p 8080:80 -v /data:/usr/share/nginx/html nginx:latest' },
  },

  '/email-normalizer': {
    intro: '把邮箱地址统一成标准形式，做去重、清洗数据或比对账号时有用。',
    steps: ['粘贴一个或多个邮箱地址', '看归一化后的结果', '按需要处理 + 后缀、大小写、点号等规则'],
    notes: ['Gmail 的点和 + 后缀规则各服务商并不一致，去重前先确认业务口径'],
    example: { label: '填入示例邮箱', text: 'John.Doe+news@Gmail.com' },
  },

  '/emoji-picker': {
    intro: '搜索并复制 Emoji，同时能查到它的 Unicode 码点。',
    steps: ['在搜索框输入关键词（如 smile）', '点选需要的 Emoji', '复制字符或它的 Unicode 编码'],
  },

  '/encryption': {
    intro: '用 AES、TripleDES、Rabbit、RC4 等算法对文本做对称加密和解密。',
    steps: ['填要加密的文本', '设置一个密钥', '选算法后点加密；解密时把密文和同一密钥填进去点解密'],
    notes: [
      '密钥忘了就解不回来，务必先保存好',
      '不同算法/模式不通用，解密时要用和加密时完全一样的配置',
    ],
    example: { label: '填入示例文本', text: '这是一段需要加密的内容' },
  },

  '/eta-calculator': {
    intro: '按当前进度估算任务完成时刻，看下载或批处理还剩多久时很直观。',
    steps: ['填已完成的量', '填总量', '看预计完成时间'],
  },

  '/git-memo': {
    intro: '常用 Git 命令速查表，忘了具体参数时来这里翻。',
    steps: ['按分类找到需要的场景', '复制命令', '把占位符替换成自己的分支或文件名'],
  },

  '/hash-text': {
    intro: '对文本做 MD5、SHA1、SHA256 等哈希校验，验证文件完整性和生成摘要时常用。',
    steps: ['粘贴文本', '在结果区选择需要的算法', '复制对应摘要'],
    notes: ['MD5、SHA1 已不抗碰撞，别再用于密码或签名场景'],
    example: { label: '填入示例文本', text: 'hello world' },
  },

  '/hmac-generator': {
    intro: '用密钥加哈希函数算 HMAC，做接口签名、校验消息来源时用。',
    steps: ['填消息内容', '填密钥', '选哈希算法后得到 HMAC'],
    notes: ['HMAC 依赖密钥，密钥不同结果完全不同，双方必须约定一致'],
    example: { label: '填入示例消息', text: 'hello world' },
  },

  '/html-entities': {
    intro: '把 <、>、& 等字符转成 HTML 实体，或反过来还原。往页面里安全插入文本时用。',
    steps: ['粘贴原始文本', '点转义或反转义', '复制结果'],
    example: { label: '填入示例文本', text: '<div class="box">Hello & "World"</div>' },
  },

  '/html-wysiwyg-editor': {
    intro: '一个所见即所得的富文本编辑器，编辑完可以直接取 HTML 源码。',
    steps: ['在编辑区输入或粘贴内容', '用工具栏调整格式', '切到源码视图复制 HTML'],
    example: { label: '填入示例内容', text: '<h2>标题</h2><p>这里是正文，<strong>加粗</strong>试试。</p>' },
  },

  '/http-status-codes': {
    intro: '所有 HTTP 状态码的含义速查，遇到陌生状态码来这里查。',
    steps: ['按分类或搜索找到状态码', '看官方名称和常见场景'],
  },

  '/iban-validator-and-parser': {
    intro: '校验 IBAN 银行账号是否合法，并拆出国家、校验位和 BBAN 等信息。',
    steps: ['填 IBAN（可以带空格）', '看校验结果', '读下方解析出的国家代码和账户部分'],
    notes: ['IBAN 自带校验位，格式不对会直接判无效，先确认有没有抄错'],
    example: { label: '填入示例 IBAN', text: 'DE89 3704 0044 0532 0130 00' },
  },

  '/ipv4-address-converter': {
    intro: '把 IPv4 地址换成十进制、二进制、十六进制形式，写脚本或看报文时有用。',
    steps: ['填 IPv4 地址', '读各种进制的结果', '复制需要的格式'],
    example: { label: '填入示例地址', text: '192.168.1.1' },
  },

  '/ipv4-range-expander': {
    intro: '给定起止 IP，算出覆盖这段范围的最简 CIDR 列表，整理防火墙规则时很实用。',
    steps: ['填起始 IP', '填结束 IP', '看生成的 CIDR 列表'],
    notes: ['起止 IP 不构成连续块时会拆成多个 CIDR，这是正常的'],
  },

  '/ipv4-subnet-calculator': {
    intro: '解析 CIDR 网段，算出可用主机数、起止地址、掩码等全套信息。',
    steps: ['填 CIDR（如 192.168.1.0/24）', '读下方各类结果', '需要哪个字段就复制哪个'],
    notes: ['网络地址和广播地址通常不能分配给主机'],
    example: { label: '填入示例网段', text: '192.168.1.0/24' },
  },

  '/ipv6-ula-generator': {
    intro: '按 RFC 4193 生成局域网用的 IPv6 唯一本地地址（ULA），给内网设备编址时用。',
    steps: ['点生成得到前缀', '按需要拼上子网和接口 ID', '复制使用'],
    notes: ['ULA 类似 IPv4 私网地址，不能在公网路由'],
  },

  '/json-diff': {
    intro: '对比两份 JSON 的差异，排查配置变更或接口返回变化时一目了然。',
    steps: ['左边粘原始 JSON', '右边粘新的 JSON', '看高亮出的增删改'],
    notes: ['键的顺序不影响比较，但数组顺序会影响'],
    example: { label: '填入示例 JSON', text: '{ "name": "DevBox", "version": 1, "tags": ["a", "b"] }' },
  },

  '/json-minify': {
    intro: '去掉 JSON 里的空格和换行，压缩成一行，省传输体积。',
    steps: ['粘贴格式化过的 JSON', '得到压缩结果', '复制使用'],
    example: { label: '填入示例 JSON', text: '{\n  "name": "DevBox",\n  "list": [1, 2, 3]\n}' },
  },

  '/json-prettify': {
    intro: '把挤成一团的 JSON 格式化成可读的缩进结构，看日志和接口返回时必备。',
    steps: ['粘贴压缩的 JSON', '得到格式化结果', '可按需调整缩进'],
    notes: ['JSON 只允许双引号，单引号会解析失败'],
    about: 'JSON（JavaScript Object Notation）是接口和配置文件的事实标准数据格式。工具和日志通常输出压缩形态——一整行不带空白，传输紧凑但人没法读。这个工具把那一行重新缩进成能读的结构，并且遇到非法 JSON 会直接报错，语法问题一眼可见。',
    faqs: [
      { q: '格式化会改动我的数据吗？', a: '不会。记号之间的空白不属于 JSON 数据模型，解析结果前后完全一致——变的只是排版。' },
      { q: '为什么我的 JSON 解析失败？', a: '最常见的三个原因：用了单引号而不是双引号、最后一个元素后面带逗号、字符串里有未转义的换行。JSON 比 JavaScript 对象字面量严格得多。' },
      { q: '这和 JSON 校验器是一回事吗？', a: '格式化必须先解析输入，所以非法 JSON 无论如何都会报错。专门的校验器还会给出精确的错误位置，文档很大时更实用。' },
    ],
    example: { label: '填入示例 JSON', text: '{"name":"DigDevBox","tools":["toolbox","devtools"],"count":2}' },
  },

  '/json-to-csv': {
    intro: '把 JSON 数组转成 CSV 表格，导给 Excel 或数据分析工具时用。',
    steps: ['粘贴 JSON 数组', '确认自动识别出的表头', '复制或下载 CSV'],
    notes: ['嵌套对象会被展平或转成字符串，结构复杂的 JSON 建议先整理'],
    example: { label: '填入示例 JSON', text: '[\n  { "id": 1, "name": "Alice", "score": 92 },\n  { "id": 2, "name": "Bob", "score": 88 }\n]' },
  },

  '/json-to-toml': {
    intro: '把 JSON 转换成 TOML 格式，写配置文件时常用。',
    steps: ['粘贴 JSON', '得到 TOML 结果', '复制使用'],
    example: { label: '填入示例 JSON', text: '{ "title": "demo", "server": { "port": 8080 } }' },
  },

  '/json-to-xml': {
    intro: '把 JSON 转成 XML，对接只接受 XML 的老系统时用。',
    steps: ['粘贴 JSON', '得到 XML 结果', '复制使用'],
    notes: ['XML 没有数组概念，列表会转成重复的标签'],
    example: { label: '填入示例 JSON', text: '{ "user": { "id": 1, "name": "Alice" } }' },
  },

  '/json-to-yaml-converter': {
    intro: '把 JSON 转成 YAML，写 K8s 清单或各类配置文件时很常用。',
    steps: ['粘贴 JSON', '得到 YAML 结果', '复制使用'],
    example: { label: '填入示例 JSON', text: '{ "name": "devbox", "services": ["web", "api"] }' },
  },

  '/jwt-parser': {
    intro: '解析 JWT，直接看清 header、payload 和签名三部分内容。',
    steps: ['粘贴 token', '看解码出的三段内容', '核对过期时间等声明'],
    notes: [
      '这里只做解码不做校验，看不出 token 是不是被篡改过',
      'payload 是明文 Base64，别在里面放敏感信息',
    ],
    example: { label: '填入示例 Token', text: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IllRSCIsImlhdCI6MTUxNjIzOTAyMn0.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ' },
  },

  '/keycode-info': {
    intro: '按下任意键，显示它的 keyCode、code、位置等细节，写键盘快捷键时用来确认。',
    steps: ['把焦点放到页面里', '按下要查的键', '读下方显示的各项信息'],
    notes: ['keyCode 已废弃，新代码建议用 event.code 或 event.key'],
  },

  '/list-converter': {
    intro: '对多行文本做排序、去重、加前后缀、反转等批量处理，整理数据时很省事。',
    steps: ['每行一条地粘贴数据', '按需勾选或选择处理方式', '复制处理后的结果'],
    example: { label: '填入示例列表', text: 'banana\napple\ncherry\napple' },
  },

  '/lorem-ipsum-generator': {
    intro: '生成占位文本，做页面排版和视觉稿时用来填充内容。',
    steps: ['选择段落或字数', '点生成', '复制文本'],
  },

  '/mac-address-generator': {
    intro: '批量生成 MAC 地址，测试网络设备或造数据时用。',
    steps: ['填需要生成的数量', '需要时填前缀', '点生成并复制'],
  },

  '/mac-address-lookup': {
    intro: '根据 MAC 地址查厂商信息，排查内网设备时用来判断这是什么设备。',
    steps: ['填 MAC 地址', '点查询', '看厂商信息'],
    notes: ['MAC 前 24 位是厂商标识，后 24 位可能被改写，只能定位厂商不能定位设备'],
    example: { label: '填入示例 MAC', text: '00:1A:2B:3C:4D:5E' },
  },

  '/markdown-to-html': {
    intro: '把 Markdown 转成 HTML，写文档或生成页面内容时用。',
    steps: ['左侧写或粘 Markdown', '右侧实时预览并给出 HTML', '复制 HTML，需要时点打印存成 PDF'],
    example: { label: '填入示例 Markdown', text: '# 标题\n\n这是一段 **加粗** 文本。\n\n- 列表项一\n- 列表项二\n\n[链接](https://digdevbox.com)' },
  },

  '/math-evaluator': {
    intro: '计算数学表达式，支持 sqrt、sin、cos、abs 等函数，比系统计算器顺手。',
    steps: ['在输入框写表达式', '结果实时或点计算后给出', '复杂算式建议分步验证'],
    example: { label: '填入示例表达式', text: 'sqrt(16) + 3 * (2 + 4)' },
  },

  '/mime-types': {
    intro: 'MIME 类型与文件扩展名互查，配置服务器或写上传校验时用。',
    steps: ['输入 MIME 类型或扩展名', '看对应的另一种形式', '复制使用'],
    example: { label: '填入示例类型', text: 'application/json' },
  },

  '/numeronym-generator': {
    intro: '生成 i18n、k8s 这类「首字母 + 字母数 + 尾字母」的缩写。',
    steps: ['填一个长单词', '得到缩写形式', '复制使用'],
    example: { label: '填入示例单词', text: 'internationalization' },
  },

  '/og-meta-generator': {
    intro: '生成 Open Graph 和社交平台的 meta 标签，做分享卡片时用。',
    steps: ['填标题、描述、图片地址和链接', '点生成', '把给出的 meta 标签粘到页面 head 里'],
    notes: ['分享平台会缓存卡片，改完可能需要用平台工具刷新缓存'],
  },

  '/otp-generator': {
    intro: '生成并校验基于时间的一次性密码（TOTP），对接两步验证时用。',
    steps: ['填入密钥（Base32 形式）', '点生成得到当前验证码', '校验时把对方给的码填进去比对'],
    notes: ['TOTP 依赖设备时间，时间差太大会导致验证码一直不匹配'],
  },

  '/password-strength-analyser': {
    intro: '评估密码强度和大致破解耗时，用来判断一条密码是否够用。',
    steps: ['输入要评估的密码', '看强度条和估算的破解时间', '按建议加长或增加字符种类'],
    notes: ['本工具纯本地计算，输入的密码不会被发送出去'],
    example: { label: '填入示例密码', text: 'MyP@ssw0rd2024' },
  },

  '/pdf-signature-checker': {
    intro: '检查 PDF 是否带数字签名，以及签名是否有效。',
    steps: ['选择或拖入 PDF 文件', '等待解析', '看签名数量与校验结果'],
    notes: ['显示有签名只说明存在签名字段，是否可信还要看证书链'],
  },

  '/percentage-calculator': {
    intro: '算两个数之间的百分比、增减比例，或由百分比反推数值。',
    steps: ['根据要算的问题选择对应模式', '填入已知数值', '读结果'],
  },

  '/phone-parser-and-formatter': {
    intro: '解析电话号码，识别国家码、区号、号码类型并转成标准格式。',
    steps: ['填电话号码（带国家码更准）', '看解析出的各项信息', '复制格式化后的号码'],
    notes: ['不带国家码的号码只能按默认地区解析，容易判错'],
    example: { label: '填入示例号码', text: '+86 138 0013 8000' },
  },

  '/qrcode-generator': {
    intro: '把文本或链接生成二维码，可自定义颜色和尺寸后下载。',
    steps: ['填要编码的内容（网址、文本都行）', '按需调整前景色、背景色和尺寸', '点下载保存图片'],
    notes: ['内容越长二维码越密，扫不出来就减少内容或调大尺寸'],
    example: { label: '填入示例链接', text: 'https://digdevbox.com' },
  },

  '/random-port-generator': {
    intro: '生成一个 1024 以上的随机端口号，起本地服务或写测试时用。',
    steps: ['点生成得到端口', '复制使用', '需要多个就多点几次'],
  },

  '/regex-memo': {
    intro: '常用正则表达式速查表，忘了语法时来这里翻。',
    steps: ['按分类找到需要的语法', '复制片段', '到「正则表达式测试器」里验证效果'],
  },

  '/regex-tester': {
    intro: '实时测试正则表达式的匹配结果，写正则时边写边验证。',
    steps: ['在上框写正则（不含两侧斜杠）', '在下框填待匹配的文本', '看高亮的匹配结果和捕获组'],
    notes: ['需要全局匹配时记得加 g 标志，否则只匹配第一处'],
    example: { label: '填入示例正则', text: '\\d{3}-\\d{4}' },
  },

  '/roman-numeral-converter': {
    intro: '罗马数字与阿拉伯数字互转，写序号、看版权年份时用。',
    steps: ['在任一侧填数字或罗马数字', '另一侧自动给出换算结果', '复制使用'],
    example: { label: '填入示例数字', text: '2024' },
  },

  '/rsa-key-pair-generator': {
    intro: '生成 RSA 公私钥对（PEM 格式），做加密传输或签名验证时用。',
    steps: ['选择密钥长度（2048 位起步）', '点生成', '分别保存私钥和公钥'],
    notes: ['私钥一旦丢失无法恢复，请妥善保存；也不要把私钥提交到代码仓库'],
  },

  '/safelink-decoder': {
    intro: '还原 Outlook 邮件里被 SafeLink 包装过的真实链接。',
    steps: ['复制邮件里那条超长的 SafeLink 地址', '粘贴到输入框', '点解码得到原始 URL'],
    notes: ['解码只是还原地址，点开前仍要自己判断是否可信'],
  },

  '/slugify-string': {
    intro: '把标题或文件名转成只含小写字母、数字和连字符的 slug，用于 URL 和文件命名。',
    steps: ['填原始字符串', '看生成的 slug', '复制使用'],
    notes: ['中文会被转成拼音或按规则处理，建议 slug 优先用英文'],
    example: { label: '填入示例文本', text: 'Hello World! 你好 2026' },
  },

  '/sql-prettify': {
    intro: '把挤成一行的 SQL 格式化成缩进清晰的结构，读慢查询日志时很有用。',
    steps: ['粘贴 SQL', '选择方言（可选）', '复制格式化结果'],
    example: { label: '填入示例 SQL', text: 'select id,name,created_at from users where status=1 order by created_at desc limit 10' },
  },

  '/string-obfuscator': {
    intro: '按规则把字符串部分字符打码，需要展示订单号、令牌又要保护内容时用。',
    steps: ['填原始字符串', '设置保留的头尾长度', '复制打码后的结果'],
    notes: ['这只是展示层遮蔽，不是加密，别用它保护真实敏感数据'],
    example: { label: '填入示例字符串', text: 'my-secret-token-123456' },
  },

  '/svg-placeholder-generator': {
    intro: '生成指定尺寸的 SVG 占位图，做页面骨架时用，比外部图床快也稳。',
    steps: ['填宽度和高度', '按需设置文字和颜色', '复制 SVG 或 data URI'],
  },

  '/temperature-converter': {
    intro: '摄氏度、华氏度、开尔文等温标互转。',
    steps: ['在任意一个温标里填数值', '其余温标自动换算', '复制需要的结果'],
  },

  '/text-diff': {
    intro: '逐行对比两段文本的差异，看改了哪些地方。',
    steps: ['左边粘原文', '右边粘新文本', '看增删高亮'],
    example: { label: '填入示例文本', text: '第一行内容\n第二行内容\n第三行内容' },
  },

  '/text-statistics': {
    intro: '统计文本的字符数、词数、字节大小等信息，写文案或校验接口限制时用。',
    steps: ['粘贴文本', '看各项统计', '需要时按字节数核对限制'],
    notes: ['中文按 UTF-8 一个字约 3 字节，和字符数不一样'],
    example: { label: '填入示例文本', text: 'DigDevBox，好用就多用。' },
  },

  '/text-to-binary': {
    intro: '文本与 ASCII 二进制互转，看底层表示或做教学演示时用。',
    steps: ['填文本或二进制', '另一侧自动给出转换结果', '复制使用'],
    notes: ['二进制串按 8 位一组，中间有空格也能识别'],
    example: { label: '填入示例文本', text: 'Hi' },
  },

  '/text-to-nato-alphabet': {
    intro: '把文本转成北约音标字母，电话里核对拼写时避免听错。',
    steps: ['填文本', '看对应的音标单词', '复制或直接照着念'],
    example: { label: '填入示例文本', text: 'SOS' },
  },

  '/text-to-unicode': {
    intro: '文本与 Unicode 码点互转，排查乱码或写转义字符时用。',
    steps: ['填文本或码点序列', '另一侧给出转换结果', '复制使用'],
    example: { label: '填入示例文本', text: 'Hello 你好' },
  },

  '/token-generator': {
    intro: '按字符集合生成随机字符串，造临时口令、邀请码时用。',
    steps: ['设置长度', '勾选需要的字符种类', '点生成并复制'],
    notes: ['这里用的是普通随机数，安全敏感场景请用系统的加密随机源'],
  },

  '/toml-to-json': {
    intro: '把 TOML 配置转成 JSON，便于在代码或接口里使用。',
    steps: ['粘贴 TOML', '得到 JSON 结果', '复制使用'],
    example: { label: '填入示例 TOML', text: 'title = "demo"\n\n[server]\nport = 8080' },
  },

  '/toml-to-yaml': {
    intro: '把 TOML 配置转成 YAML，在不同配置格式之间迁移时用。',
    steps: ['粘贴 TOML', '得到 YAML 结果', '复制使用'],
    example: { label: '填入示例 TOML', text: 'title = "demo"\n\n[server]\nport = 8080' },
  },

  '/ulid-generator': {
    intro: '生成 ULID：像 UUID 一样唯一，但按时间有序，做数据库主键更友好。',
    steps: ['点生成得到 ULID', '需要多个就连续生成', '复制使用'],
  },

  '/url-encoder': {
    intro: '把字符串编码成 URL 百分号形式，或反过来还原，拼参数时避免踩坑。',
    steps: ['粘贴原始串或已编码的串', '点编码或解码', '复制结果'],
    notes: ['编码整个 URL 会把 :// 也转义掉，通常只应编码参数值部分'],
    example: { label: '填入示例文本', text: 'https://example.com/search?q=你好 world&page=1' },
  },

  '/url-parser': {
    intro: '拆解 URL 的协议、域名、端口、路径、查询参数等组成部分。',
    steps: ['粘贴完整 URL', '看逐项解析结果', '查询参数会列成表格方便复制'],
    example: { label: '填入示例 URL', text: 'https://user:pass@example.com:8443/path/to/page?a=1&b=2#section' },
  },

  '/user-agent-parser': {
    intro: '从 User-Agent 串里识别浏览器、内核、操作系统和设备类型。',
    steps: ['粘贴 UA 串，或一键填入当前浏览器', '看解析出的各项信息', '复制需要的字段'],
    notes: ['UA 可以伪造，只适合做统计和展示，不能用于安全判断'],
    example: { label: '填入示例 UA', text: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' },
  },

  '/uuid-generator': {
    intro: '批量生成 UUID（默认 v4），造测试数据或生成唯一标识时用。',
    steps: ['选择需要的数量', '点生成', '复制使用'],
    notes: ['UUID v4 是随机的，不保证按时间有序；需要有序标识可以用 ULID'],
    about: 'UUID（通用唯一标识符）是一个 128 位的标签，默认的 v4 版本由随机数据生成。约 122 个随机位意味着两个 v4 碰撞的概率可以忽略不计，所以多台机器可以各自独立生成标识，完全不需要中央协调。需要基于时间或名字的标识时，本工具也能生成 v1、v3、v5。',
    faqs: [
      { q: '生成的 UUID 有可能重复吗？', a: '理论上可能，实践中不会——得每秒生成几十亿个、持续很多年才有五五开的碰撞概率。数据库的唯一约束是兜底，不是你真会撞上。' },
      { q: 'UUID v4 还是 ULID？', a: 'v4 完全随机，按 UUID 排序得不到任何创建顺序信息。如果标识会进数据库索引、而插入顺序很重要，用 ULID 或 UUID v7 这类按时间有序的格式表现更好。' },
      { q: '生成的 UUID 会被上传吗？', a: '不会。全部在你浏览器本地生成，不会离开这个页面。' },
    ],
  },

  '/wifi-qrcode-generator': {
    intro: '生成 WiFi 二维码，别人扫码就能连网，不用手输密码。',
    steps: ['填 WiFi 名称（SSID）', '填密码并选择加密方式', '点生成后扫码或下载'],
    notes: ['二维码里含明文密码，贴在公共区域要谨慎'],
  },

  '/xml-formatter': {
    intro: '把压缩成一行的 XML 格式化成缩进结构，读接口报文时很有用。',
    steps: ['粘贴 XML', '点格式化', '复制结果'],
    example: { label: '填入示例 XML', text: '<root><user id="1"><name>Alice</name></user></root>' },
  },

  '/xml-to-json': {
    intro: '把 XML 转换成 JSON，对接现代接口时用。',
    steps: ['粘贴 XML', '得到 JSON 结果', '复制使用'],
    notes: ['XML 的属性和文本节点在 JSON 里会用不同字段表示，转换后注意核对'],
    example: { label: '填入示例 XML', text: '<user id="1"><name>Alice</name></user>' },
  },

  '/yaml-prettify': {
    intro: '格式化 YAML，让它缩进规整、便于阅读和排错。',
    steps: ['粘贴 YAML', '点格式化', '复制结果'],
    notes: ['YAML 靠缩进表达层级，只能用空格不能用 Tab'],
    example: { label: '填入示例 YAML', text: 'name: devbox\nservices:\n- web\n- api' },
  },

  '/yaml-to-json-converter': {
    intro: '把 YAML 转成 JSON，处理配置文件或接口数据时常用。',
    steps: ['粘贴 YAML', '得到 JSON 结果', '复制使用'],
    example: { label: '填入示例 YAML', text: 'name: devbox\nservices:\n  - web\n  - api' },
  },

  '/yaml-to-toml': {
    intro: '把 YAML 转成 TOML 格式，配置迁移时用。',
    steps: ['粘贴 YAML', '得到 TOML 结果', '复制使用'],
    example: { label: '填入示例 YAML', text: 'title: demo\nserver:\n  port: 8080' },
  },

  // —— 第二批（2026-09-19 补）：新增工具的使用说明 ——
  // 以上 86 条按路径字母序排列；这 15 条按补写顺序追加在末尾，不重排以免产生
  // 数百行纯位移的 diff。内容一律取自该工具的界面与源码实际行为，
  // 界面里没有的参数、没有实测过的兼容性都不写（见方案 STEP 3 的工程红线）。

  '/htpasswd-generator': {
    intro: '生成 .htpasswd 文件里「用户名:哈希」那一行，给 Apache / Nginx 加 Basic 认证；也能反向校验已有条目是否匹配某个密码。',
    steps: [
      '填「用户名」和「密码」',
      '选「格式」：bcrypt（Apache 2.4 起推荐）、Apache MD5（$apr1$，兼容性最好）、SHA1、明文（仅调试）',
      '选 apr1 时可自己填「盐」（最多 8 字符）或点「随机盐」；选 bcrypt 时用「成本」控制强度',
      '点「生成」，把结果整行写进 .htpasswd，再用 auth_basic_user_file 指向它',
      '要核对时：把已有那行粘进「一行内容」，填「待验证密码」，看比较结果',
    ],
    notes: [
      '生成与校验都在浏览器本地完成，密码不会离开页面',
      'bcrypt 的「成本」越高越慢、越难暴力破解，调高后点「生成」会有可感知的等待',
      'SHA1（{SHA}）只比明文强一点，Apache 官方文档明确标注不安全',
      '明文格式仅 Windows / Netware 支持，不要用于生产',
    ],
    example: { label: '填入示例用户名', text: 'admin' },
  },

  '/rmb-uppercase': {
    intro: '把金额数字转成发票、报销单上要求的中文大写，省得手写时数错位。',
    steps: ['在「金额」里填数字', '按需勾选「加人民币前缀」「用元 / 用圆」', '复制「中文大写」结果'],
    notes: ['分组单位到「万亿」为止，位数特别多时请核对结果'],
    example: { label: '填入示例金额', text: '1409.05' },
  },

  '/fullwidth-converter': {
    intro: '在 全角 ↔ 半角 之间转换字符，清理中英混排里混进来的全角字母数字或标点。',
    steps: ['把要处理的文本粘进「输入文本」', '在「转换方式」里选 半角→全角 / 全角→半角 / 只转标点', '复制「转换结果」'],
    notes: [
      '「只转标点」不动字母数字，只按对照表替换标点符号',
      '半角空格与全角空格（U+3000）也在转换范围内',
    ],
    example: { label: '填入示例文本', text: 'ＡＢＣ１２３，全角标点。' },
  },

  '/morse-code-converter': {
    intro: '在文本与摩斯电码（. -）之间双向转换。',
    steps: ['把文本或电码粘进「输入内容」', '选「转换方向」', '复制「转换结果」'],
    notes: [
      '支持 A–Z、0–9 与常用标点；中文等没有对应电码的字符在编码时会被忽略',
      '编码结果里字母之间用空格分隔、单词之间用 / 分隔',
      '解码时词间隔也可以写成 | 或 ｜',
      '解码遇到不认识的码点会输出 ?',
    ],
    example: { label: '填入示例文本', text: 'SOS' },
  },

  '/px-rem-converter': {
    intro: '按根字号在 px 与 rem 之间批量换算，调响应式字号和间距时用。',
    steps: [
      '设「根字号」——即页面 html 的 font-size，默认 16px；按需改「小数位」',
      '选「转换方向」：px → rem 或 rem → px',
      '在「数值」里填多个值（空格 / 逗号 / 换行分隔，可带 px、rem 单位）',
      '复制结果，换算关系是 rem = px ÷ 根字号',
    ],
    notes: ['根字号填错会让所有结果整体偏移，改动设计基准时记得同步'],
  },

  '/text-replacer': {
    intro: '批量查找替换文本，支持正则与忽略大小写，处理日志、SQL、配置片段时省事。',
    steps: [
      '把原文粘进「原文」',
      '「查找」里填要找的内容，「替换为」里填新内容（留空即删除）',
      '需要正则时勾「使用正则表达式」；勾「忽略大小写」可不区分大小写',
      '先看「替换次数」确认命中数符合预期，再复制结果',
    ],
    notes: [
      '正则写得不对时页面会提示「正则表达式无效」，不会给出错误结果',
      '不勾正则时，「查找」里的 . * ( ) 等符号按普通字符处理',
      '替换文本里的 $1、$& 不会被当成捕获组引用，会按原样写入',
    ],
    example: { label: '填入示例文本', text: 'name=Alice; name=Bob; name=Carol' },
  },

  '/json-to-get-params': {
    intro: '在 JSON 与 GET 查询参数之间互转：把嵌套对象拍平成 a[b][0]=c 这种查询串，或反过来还原成 JSON。',
    steps: ['选「转换方向」：JSON → GET 参数 / GET 参数 → JSON', '把 JSON 或查询串粘进「输入内容」', '复制「转换结果」'],
    notes: [
      '嵌套层级与数组下标都用方括号表示，如 items[0][name]',
      '值为 null、空数组或空对象的字段会输出空值',
    ],
    example: { label: '填入示例 JSON', text: '{"a":1,"b":{"c":2},"list":[1,2]}' },
  },

  '/json-to-code': {
    intro: '把 JSON 样本转成 TypeScript / C# / Java / Go 的实体类定义，省掉照着接口返回手写字段。',
    steps: ['填「根类名」——生成的顶层类型名', '选「目标语言」', '把 JSON 对象或对象数组粘进「JSON」', '复制生成的代码'],
    notes: [
      '字段类型是按样本值推断的，不是从 schema 读的',
      '样本里值为 null 的字段判断不出类型，会退化成该语言的通用类型',
      '多给几条真实数据（尤其数组里多放几个元素）能得到更完整的字段集合',
      '生成结果只是起点，字段命名与可空性请按业务再核对',
    ],
  },

  '/unit-converter': {
    intro: '在 11 类单位之间换算，也包含市斤、两、亩、市尺、市里这类中式单位。',
    steps: ['选「类别」', '填数值并从右侧下拉里选原单位', '复制「换算结果」——一次列出该类别下全部单位的值'],
    notes: [
      '时间按月按 30 天、按年按 365 天计算',
      '数据存储按 1024 进制（KB = 1024 字节）',
      '温度走换算公式，不与其他单位共用一套系数',
    ],
  },

  '/ascii-table': {
    intro: '标准 ASCII 码表速查（0–127），同时给出字符与十进制、十六进制、八进制、二进制表示，并附中文说明。',
    steps: ['在搜索框里输入字符（如 A）或码值（如 65、0x41）', '列表实时过滤', '按需对照各行给出的几种进制'],
    notes: ['搜索匹配字符、中文说明、十进制与十六进制'],
    example: { label: '填入示例查询', text: 'A' },
  },

  '/http-headers': {
    intro: '常见 HTTP 请求头 / 响应头速查，写接口、排查缓存与 CORS 问题时对照着看。',
    steps: ['在搜索框里输入字段名（如 Cookie）或用途关键词（如 缓存、CORS）', '列表实时过滤', '每条给出字段名、方向（请求 / 响应）与中文说明'],
    notes: ['搜索匹配字段名、中文说明与方向'],
    example: { label: '填入示例查询', text: 'cache' },
  },

  '/linux-commands': {
    intro: 'Linux 常用命令速查，覆盖文件、文本处理、进程、网络等场景，每条都带可直接改用的示例。',
    steps: ['在搜索框里输入命令（如 grep）或场景关键词（如 端口、磁盘）', '列表实时过滤', '照着每条给出的示例改成自己的路径或参数'],
    notes: ['搜索匹配命令名、中文说明与示例命令'],
    example: { label: '填入示例查询', text: 'grep' },
  },

  '/whois-lookup': {
    intro: '查域名的注册信息：注册商、注册与到期时间、域名状态。数据来自 RDAP，即 WHOIS 的官方继任协议。',
    steps: ['填「域名」（粘整条 URL 也行，会自动只取主机名）', '点「查询 WHOIS」或按回车', '复制「注册信息」'],
    notes: [
      '查询由本站服务端接口发起，需要站点已部署；本地开发环境会请求失败',
      '返回的是接口原样给出的注册数据，不同后缀（.com / .cn / .io…）字段详略不同，未必都有到期时间',
    ],
    example: { label: '填入示例域名', text: 'example.com' },
  },

  '/http-status-checker': {
    intro: '从服务端检测一个网址真正返回的 HTTP 状态码与响应头，用来确认线上到底返回了什么。',
    steps: ['填「网址」（不写协议时按 https 处理）', '点「检测状态码」或按回车', '看状态码配色与响应头列表，响应头可整段复制'],
    notes: [
      '检测由本站服务端发起，看到的是服务端网络环境的结果，可能与本机 curl 不同（DNS 缓存、代理、地区差异）',
      '需要站点已部署；本地开发环境会请求失败',
      '状态码按 2xx 绿 / 3xx 橙 / 4xx、5xx 红着色',
    ],
    example: { label: '填入示例网址', text: 'example.com' },
  },

  '/today-in-history': {
    intro: '列出「历史上的今天」发生过的事件，进页面即自动加载当天内容。',
    steps: ['打开页面会自动加载', '点「重新加载」可再拉一次'],
    notes: ['数据由本站服务端接口提供，需要站点已部署；本地开发环境会加载失败'],
  },
}
