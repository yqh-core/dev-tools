/**
 * English usage guides (default locale).
 *
 * Why a separate file per language
 * ------------------------------------------------------------------
 * DigDevBox defaults to English, but is also usable in Chinese. A single
 * hard-coded (Chinese) guide table made the default English pages carry
 * Chinese body text — the SEO title/description/H1 were English while the
 * guide below them was not.
 *
 * The key set here must match `guides.zh.ts` exactly; the consistency is
 * enforced at build time by `scripts/check-guides-i18n.mjs`, so adding a tool
 * cannot land with only one language covered.
 *
 * 101 entries.
 */

import type { ToolGuide } from './guides.types';

export const GUIDES: Record<string, ToolGuide> = {
  '/ascii-text-drawer': {
    intro: 'Turns plain text into "ASCII art" lettering, handy for code comments, terminal banners or the top of a README.',
    steps: ['Type the text to convert (keep it under ~10 characters, longer text wraps)', 'Pick a font style below', 'Copy the result with the copy button'],
    notes: ['Non-ASCII characters usually have no matching art font — stick to letters and digits'],
    example: { label: 'Fill in sample text', text: 'DigDevBox' },
    about: 'Turn a short piece of text into ASCII art rendered in a selection of display fonts. The result is plain text, so it survives anywhere monospace text does — source-file banners, terminal motd, README headings, CLI help output.',
    faqs: [
      { q: 'Where can I use ASCII art output?', a: 'Anywhere that keeps monospace alignment: code comments, commit banners, shell prompts, chat code blocks. In proportional fonts it will distort, so keep it in monospace contexts.' },
      { q: 'Why do different fonts produce different sizes?', a: 'Each font defines its own glyph height and width, so the same word can be one line in a compact font and five lines in a blocky one. Pick per medium — banners for headers, compact fonts for inline comments.' },
      { q: 'Why does my text look broken in one font?', a: 'Some fonts lack glyphs for certain characters and fall back to blanks or substitutes. Switch to another font or restrict the input to plain letters and digits.' },
    ],
  },

  '/base-converter': {
    intro: 'Converts the same number between decimal, hexadecimal, binary, octal and even base64 — useful when debugging bitwise logic and protocol fields.',
    steps: ['Enter the number in any of the base fields', 'The other bases update automatically', 'Copy the result you need from its field'],
    notes: ['This converts numbers, not text. To convert text, use "Text to ASCII Binary" instead'],
    example: { label: 'Fill in a sample number', text: '255' },
    about: 'Convert an integer between decimal, hexadecimal, binary, octal, base64 and more — paste once, see every base at once. Indispensable when reading flags and masks (0x1F), permission bits, colour channels or wire protocols where the same number keeps changing costume.',
    faqs: [
      { q: 'Why do programmers keep switching bases?', a: 'Because each base answers a different question: hex maps 1:1 to 4 bits (flags, memory addresses), binary shows individual bits, octal survives in Unix permissions. The number never changes — only the view.' },
      { q: 'How does base64 fit in here if it is not a number base?', a: 'Base64 encodes bytes as text; when your input is a small integer, its byte pattern can be shown as base64 characters. For full text-to-base64 you want the dedicated Base64 tools — this one is for numbers.' },
      { q: 'Are negative numbers and decimals supported?', a: 'The converter targets integers. Negative and fractional values behave differently in each base and encoding, so use the math evaluator or a language runtime when those matter.' },
    ],
  },

  '/base64-file-converter': {
    intro: 'Encodes a file (image, PDF, …) into a Base64 string so it can be inlined into HTML/CSS or an API payload.',
    steps: ['Click the upload area to pick a file, or drag one in', 'The Base64 string appears on the right', 'Copy it; enable the data-URI option if that is the form you need'],
    notes: ['Base64 inflates the size by roughly a third, so inline large files with care'],
    example: { label: 'Fill in a sample file name', text: 'quarterly-report' },
    about: 'Base64 and files meet in both directions here. Paste a Base64 string — a full data URI or a bare payload — and the tool rebuilds the original file: common types (PNG, JPEG, GIF, PDF) are recognised from their signatures, the extension field fills itself in, images can be previewed inline, and Download saves the result under the name you choose. The other way around, drop or pick a file and its Base64 string appears below, ready to copy. Both conversions run in your browser, so the practical limit is memory: comfortable for images and documents, less so for large videos.',
    faqs: [
      { q: 'Why did the Extension field fill itself in?', a: 'When your input starts with a data URI prefix or matches a known signature (PNG, JPEG, GIF, PDF), the tool infers the file type and sets the extension for you. Unknown types keep whatever you typed — edit the field manually if the guess is wrong.' },
      { q: 'How do I get the Base64 string of a file?', a: 'Use the File to Base64 card: drag a file onto the upload area or click to select one, and the string appears in the readonly box below. The Copy button puts it on your clipboard.' },
      { q: 'Is there a file size limit?', a: 'Nothing is enforced, but the conversion happens in browser memory. Images and documents are comfortable; very large files can get slow or hit memory limits — and remember the Base64 text is about a third larger than the original file.' },
    ],
    relatedNotes: [
      {
        slug: 'base64-encoding-guide',
        title: 'Base64 Encoding Guide: Padding, URLs and Binary-Safe Data',
        description: 'How Base64 works, why = padding breaks inside URLs, and what binary-safe really means — with online encoders and decoders for both strings and files.',
        url: 'https://notes.digdevbox.com/posts/base64-encoding-guide',
        tag: 'Base64',
      },
    ],

  },

  '/base64-string-converter': {
    intro: 'Encodes text to Base64, or decodes Base64 back to the original text. Common for query parameters, Authorization headers and temporarily hiding plain text.',
    steps: ['Enter the text on the left', 'The encoded result appears on the right immediately', 'To decode, flip the direction and paste the Base64 into the left side'],
    notes: ['Base64 is encoding, not encryption — anyone can reverse it, so never use it to store passwords'],
    about: 'Base64 is an encoding that represents data using 64 printable ASCII characters, so payloads can travel through text-only channels: email (MIME), data URLs, HTTP Basic credentials and JSON fields. It maps every 3 bytes to 4 characters and pads the tail with = when the input is not a multiple of 3 bytes.',
    faqs: [
      { q: 'Is Base64 encryption?', a: 'No. It is a reversible encoding with no secret key — anyone can decode it. Never use it to protect passwords or tokens; use real encryption or hashing for that.' },
      { q: 'Why does the result end with one or two = signs?', a: 'Base64 processes input in 3-byte groups. When the last group is incomplete, = characters pad the output to a multiple of 4. The padding carries no data and can stay as it is.' },
      { q: 'Why does my Base64 break inside a URL?', a: 'The standard alphabet uses + and /, which have special meanings in URLs. Switch on the URL-safe option when decoding such values, and percent-encode the string before putting it into a query parameter.' },
    ],
    example: { label: 'Fill in sample text', text: 'Hello DigDevBox' },
    relatedNotes: [
      {
        slug: 'base64-encoding-guide',
        title: 'Base64 Encoding Guide: Padding, URLs and Binary-Safe Data',
        description: 'How Base64 works, why = padding breaks inside URLs, and what binary-safe really means — with online encoders and decoders for both strings and files.',
        url: 'https://notes.digdevbox.com/posts/base64-encoding-guide',
        tag: 'Base64',
      },
    ],

  },

  '/basic-auth-generator': {
    intro: 'Builds the HTTP Basic Authorization header from a username and password, ready to paste into an API request.',
    steps: ['Enter the username', 'Enter the password', 'Copy the generated Authorization header'],
    notes: ['Basic auth only Base64-encodes the credentials, so it must always be used over HTTPS'],
    example: { label: 'Fill in a sample username', text: 'admin' },
    about: 'Build the Authorization header value for HTTP Basic auth: enter a username and password, get the base64-encoded string ready to paste into curl, an API client or a proxy config. Everything is computed in your browser — the credentials never leave the page.',
    faqs: [
      { q: 'Is Basic auth secure?', a: 'Only over HTTPS. The header is trivially reversible — base64 is an encoding, not a lock — so it protects nothing if an attacker can read the traffic. Always pair it with TLS.' },
      { q: 'What exactly goes into the header?', a: 'The literal string "Basic " followed by base64(username:password), so user "api" with password "secret" becomes "Basic YXBpOnNlY3JldA==". This tool produces that value for you.' },
      { q: 'Why does my server reject the generated header?', a: 'Common causes: an extra space or newline copied in, the wrong scheme prefix, or the server expecting a token format instead. Compare the exact bytes you send with what the server documents.' },
    ],
  },

  '/bcrypt': {
    intro: 'Hashes a password with bcrypt, or verifies that a plaintext password matches an existing hash — the standard approach for storing credentials.',
    steps: ['Enter the plaintext password', 'Click generate to get the hash', 'To verify, put the hash in its field, enter the plaintext, then compare'],
    notes: [
      'bcrypt is a hash, not encryption: it is irreversible, there is no "decrypt"',
      'A higher cost is slower and more secure; 10–12 is typical in production',
      'The same plaintext produces a different hash every time — that is expected (random salt)',
    ],
    about: 'bcrypt is a password-specific hash: unlike SHA-256 it is deliberately slow, and the cost factor lets you slow it down further as hardware improves. Every bcrypt output embeds its own random salt and the cost in the string itself ($2b$10$... means cost 10), which is why the same password hashes differently every time and why verification needs no separate salt storage — the algorithm, salt and cost are all read back from the hash. This tool hashes with bcryptjs and verifies by re-hashing the candidate and comparing, exactly how a server does at login. Typical cost is 10–12: each step doubles the work, so cost 12 is roughly four times slower than cost 10 — pick the slowest value your login latency tolerates.',
    faqs: [
      { q: 'Why does the same password produce different bcrypt hashes?', a: 'By design: a fresh random salt is generated for every hash, so identical passwords produce different outputs and rainbow tables are useless. bcrypt verification handles this automatically — it reads the salt back out of the hash before comparing.' },
      { q: 'What cost (salt rounds) should I choose?', a: 'The rule of thumb is "about 250 ms per hash on your production hardware". Cost 10 is a common floor; 11–12 is typical today. Each +1 doubles the time for both you and the attacker, so take the slowest your login path can afford.' },
      { q: 'Can I decrypt a bcrypt hash to get the password back?', a: 'No, and any service claiming to is a scam. bcrypt is one-way; the only path is guessing candidates and hashing each one — which the cost factor is specifically engineered to make slow.' },
    ],
    example: { label: 'Fill in a sample password', text: 'MyP@ssw0rd' },
  },

  '/benchmark-builder': {
    intro: 'Times several code snippets side by side to see quickly which implementation is faster.',
    steps: ['Add the implementations you want to compare', 'Click run', 'Read the per-snippet timings and relative ratios'],
    notes: ['Browser-side timing is affected by machine load — avoid drawing conclusions from differences under ~10%'],
    example: { label: 'Fill in a sample suite name', text: 'JSON parse 10k rows' },
    about: 'A simple online benchmark builder: define tasks (either a piece of code or a fixed duration), run them, and compare execution times in one table. Built for the classic "which approach is faster" question — with enough structure (labels, iterations, relative bars) that results are comparable rather than vibes.',
    faqs: [
      { q: 'How should I structure a fair comparison?', a: 'Keep one variable: same data, same machine, same tab. Run tasks repeatedly and look at steady-state times rather than the first run, which pays JIT and cache warm-up costs.' },
      { q: 'Why do my numbers differ between runs?', a: 'Browsers share CPU with the OS, other tabs and background work — a few percent of noise is normal. Trust differences that persist across multiple runs, not single victories.' },
      { q: 'Can it benchmark network calls?', a: 'It measures wall-clock duration of whatever you define as a task, including async work — but network variance will dominate. For network comparisons, run many iterations and compare medians.' },
    ],
  },

  '/bip39-generator': {
    intro: 'Generates or validates BIP39 mnemonic phrases, and derives the seed from a mnemonic. Useful for wallets and key management.',
    steps: ['Choose the mnemonic length (12 words is common)', 'Click generate to get the phrase', 'With an existing phrase, paste it in to validate and derive the seed'],
    notes: ['A mnemonic is equivalent to a private key: store it offline and never leave it in an online tool'],
    example: { label: 'Fill in a sample entropy', text: '1a2b3c4d5e6f7a8b' },
    about: 'Work with BIP39: generate a fresh mnemonic phrase, or derive the passphrase/seed from an existing mnemonic and vice versa. BIP39 is the standard that turns a 12/24-word phrase into the seed behind crypto wallets — this tool implements it locally, so nothing you paste is transmitted.',
    faqs: [
      { q: 'What is a BIP39 mnemonic?', a: 'A list of 12–24 words picked from a fixed 2048-word list. The words encode entropy plus a checksum, and the wallet derives all your keys from them — the phrase is the wallet.' },
      { q: 'Is it safe to enter my real mnemonic here?', a: 'The tool runs entirely client-side and sends nothing anywhere. Still, the security advice is absolute: a mnemonic that protects real funds should only ever be typed into a trusted, offline device.' },
      { q: 'Why does one mnemonic produce many keys?', a: 'The mnemonic seeds a hierarchy (BIP32): one seed deterministically derives an entire tree of account keys. Losing the phrase therefore loses every derived account, and anyone holding it holds them all.' },
    ],
  },

  '/camera-recorder': {
    intro: 'Takes a photo or records a short video with your camera — a quick way to check a device works or capture throwaway footage.',
    steps: ['Click start and allow the browser permission prompt', 'Take a photo or start recording', 'Download the result when you are done'],
    notes: ['Browsers only allow camera access over HTTPS', 'Everything is processed locally and never uploaded'],
    about: 'Take photos or record video straight from your browser camera — no app install, no upload. Frames and clips stay on your machine until you download them, which makes it a quick utility for profile shots, bug-report videos or checking what your webcam actually sees.',
    faqs: [
      { q: 'Why does the browser ask for camera permission?', a: ' getUserMedia requires explicit consent per site. Granting it lets this page show the video locally; recording and downloading are separate actions you control.' },
      { q: 'Which formats are the recordings?', a: 'Video comes out in the container your browser records (typically webm); photos save as images. If a platform rejects the file, convert it — the content is intact.' },
      { q: 'Nothing appears — where do I look first?', a: 'Check that the right camera is selected (many laptops have several), that no other app holds the device exclusively, and that the site runs on HTTPS, which browsers require for camera access.' },
      { q: 'Can I record video online without installing an app?', a: 'Yes — this page uses the browser camera API, so recording works with nothing installed. Clips are produced locally and only leave the machine when you download them.' },
    ],
  },

  '/case-converter': {
    intro: 'Changes case in bulk and converts between naming styles such as camelCase, snake_case and kebab-case — a time saver for API fields and constants.',
    steps: ['Paste the original text', 'Pick the target style below', 'Copy the result'],
    example: { label: 'Fill in sample text', text: 'hello world example' },
    about: 'Convert a string into every naming convention you run into day to day: camelCase, PascalCase, snake_case, CONSTANT_CASE, kebab-case and more, all from one input. Ideal when an API field becomes a database column becomes a CSS class and each layer demands its own style.',
    faqs: [
      { q: 'What is the difference between camelCase and PascalCase?', a: 'Only the first letter: camelCase starts lowercase (userName), PascalCase uppercase (UserName). Languages differ in convention — Java methods vs .NET classes, for example.' },
      { q: 'When should I use kebab-case?', a: 'URLs, file names, CSS classes and HTML data attributes. Spaces are illegal or awkward there, and search engines treat hyphens as word separators.' },
      { q: 'How are acronyms handled?', a: 'Conventions disagree: XMLHttpRequest-style acronyms may become xml-http-request or xmlh-ttp-request depending on the splitter. Check the output for acronyms and normalise your input if needed.' },
    ],
  },

  '/chmod-calculator': {
    intro: 'Works out chmod permission values and commands by ticking boxes, so you do not have to remember what rwx maps to.',
    steps: ['Tick read/write/execute for owner, group and others', 'The numeric form (e.g. 755) and symbolic form update above', 'Copy the generated chmod command'],
    notes: ['Be careful granting execute permission, and especially careful with 777'],
    about: 'chmod controls who can read, write and execute a file on Linux and macOS. Permissions are grouped for the owner, the group and everyone else, and each group is a sum of read (4), write (2) and execute (1) — which is why 755 reads as rwxr-xr-x.',
    faqs: [
      { q: 'What does 755 actually mean?', a: 'The owner gets read, write and execute (7 = 4+2+1); the group and others get read and execute (5 = 4+1). It is the typical permission for directories and for scripts that others may run but not modify.' },
      { q: 'Is 777 ever a good idea?', a: 'Almost never. It lets every user on the machine write to and execute the file — the quickest way to get a web script modified or a directory trashed. Use the narrowest permission that works.' },
      { q: 'Numeric or symbolic form — which should I use?', a: 'They describe the same thing. Numeric (644) is compact and convenient in scripts; symbolic (u=rw,go=r) changes only the bits you mention, which is safer for small tweaks on shared files.' },
    ],
    relatedNotes: [
      {
        slug: 'devops-tools-guide',
        title: 'DevOps Tools for Everyday Work: Cron, Permissions and Docker Compose',
        description: 'Everyday DevOps tasks that cost the most time — writing cron expressions, computing chmod permissions, converting docker run commands — with tools for each.',
        url: 'https://notes.digdevbox.com/posts/devops-tools-guide',
        tag: 'DevOps',
      },
    ],
  },

  '/chronometer': {
    intro: 'A clean stopwatch/timer for measuring elapsed time or running pomodoro sessions.',
    steps: ['Click start', 'Click lap to record split times', 'Click stop to see the total duration'],
    about: 'A clean stopwatch in your browser: start, pause, lap and reset, with the elapsed time always visible. Useful as a lightweight timer for coding sprints, meeting segments, brewing instructions — anything where opening your phone is a bigger context switch than a spare tab.',
    faqs: [
      { q: 'Does it keep running if I switch tabs?', a: 'Yes — it tracks elapsed wall-clock time rather than counting ticks, so background throttling does not make it lose seconds. Return to the tab and the correct total is shown.' },
      { q: 'What is the difference between pause and lap?', a: 'Pause freezes the count until you resume; lap records a timestamp while the clock keeps running. Laps give you per-segment times, pause gives you a break.' },
      { q: 'How accurate is a browser stopwatch?', a: 'It reads the system clock, so accuracy is that of your device — well within what human timing needs. For sub-millisecond engineering measurements, use the benchmark tool instead.' },
    ],
  },

  '/color-converter': {
    intro: 'Converts between HEX, RGB, HSL and CSS colour names — useful when editing a design or tuning a theme.',
    steps: ['Type a value in any format, or use the colour picker', 'The other formats update automatically', 'Copy the one you need'],
    example: { label: 'Fill in a sample colour', text: '#ff6600' },
    notes: [
      'CMYK and LCH are computed conversions, not values measured from a print proof — check a real profile before sending work to print.',
      'The colour name is the nearest CSS keyword, which can be visibly off from your actual colour.',
    ],
    about: 'Convert one colour into every format you may need it in — hex, rgb, hsl, hwb, lch, cmyk and the nearest CSS colour name — from a single picker, so a design token that arrives as #ff6600 can leave as an hsl() triple or as a print-oriented CMYK quadruple. Conversions run in the browser through Colord; nothing is sent anywhere. Useful exactly where colour formats collide: a brand spec in hex, a CSS custom property in hsl, a Figma export in lch, a print sheet in cmyk.',
    faqs: [
      { q: 'Why do hex and hsl describe the same colour differently?', a: 'They are different coordinate systems over the same perceived colour. Hex is a compact byte triple for the screen; HSL re-expresses those bytes as hue, saturation and lightness, which is how people actually reason about a colour. Neither is more correct — pick the one your consumer expects.' },
      { q: 'Which format should I use in CSS?', a: 'Any of them: modern CSS accepts hex, rgb(), hsl(), lch() and the rest. hsl() and lch() are easier to derive variants from (shift the hue or lightness), while hex is the shortest and the most portable across old tooling.' },
      { q: 'Does the tool support alpha transparency?', a: 'The formats shown are the colour itself. Where a channel is not part of a given format — CMYK and the named colours have no alpha — the transparency is simply not representable there, so carry alpha in the rgba() or hsla() form.' },
      { q: 'Which formats does it actually output?', a: 'Seven plus a picker: hex, rgb, hsl, hwb, lch, cmyk and a CSS colour name. CMYK, HWB and LCH come from Colord plugins, so they are computed conversions rather than lookups.' },
      { q: 'The colour name looks wrong for my colour — why?', a: 'It is reporting the closest named CSS colour, not an exact match. Most colours have no CSS name at all, so the name is a hint about what a colour resembles, never a specification. Use hex when the value has to be right.' },
    ],
  },

  '/crontab-generator': {
    intro: 'Validates a cron expression and translates it into plain language, and can show the coming run times. Verify here before scheduling a job.',
    steps: ['Enter the cron expression (e.g. */5 * * * *)', 'Check the human-readable description to confirm the frequency is what you intended', 'Cross-check against the time preview'],
    notes: [
      'The five fields are minute, hour, day-of-month, month, day-of-week — mixing up the order is the most common mistake',
      'Mind the server time zone: cron runs on the machine local time',
    ],
    about: 'cron is the time-based scheduler on Unix-like systems, and its expression packs the whole schedule into five fields: minute, hour, day-of-month, month and day-of-week. A single wrong character silently changes when your job runs, so validating the expression and previewing the next run times before committing it to a server saves real debugging time.',
    faqs: [
      { q: 'Why does my job run at the wrong hour?', a: 'Usually a time zone mismatch: cron runs on the server\'s local time, which may differ from yours or be set to UTC. Check the machine with the date command and convert your schedule accordingly.' },
      { q: 'What is the difference between * and */5?', a: '* means every value of the field; */5 means every 5th value. So * * * * * runs every minute, while */5 * * * * runs every 5 minutes starting from minute 0.' },
      { q: 'Why do day-of-month and day-of-week not simply add up?', a: 'When both fields are restricted (not *), cron runs the job if EITHER of them matches, not both. That OR semantics surprises most people — restrict only one of the two unless you specifically want it.' },
    ],
    example: { label: 'Fill in a sample expression', text: '*/5 * * * *' },
    relatedNotes: [
      {
        slug: 'devops-tools-guide',
        title: 'DevOps Tools for Everyday Work: Cron, Permissions and Docker Compose',
        description: 'Everyday DevOps tasks that cost the most time — writing cron expressions, computing chmod permissions, converting docker run commands — with tools for each.',
        url: 'https://notes.digdevbox.com/posts/devops-tools-guide',
        tag: 'DevOps',
      },
    ],
  },

  '/date-converter': {
    intro: 'Converts a date between many formats — Unix timestamps, ISO 8601, RFC 3339, RFC 7231, UTC, locale strings, Excel serial numbers and Mongo ObjectIDs.',
    steps: ['Use the current time or enter one manually', 'Read the Unix timestamp and the formatted results', 'Note whether you need seconds or milliseconds'],
    notes: ['Unix timestamps are usually seconds (10 digits), while JavaScript Date.now() is milliseconds (13 digits)'],
    example: { label: 'Paste a sample date', text: '2026-10-05T08:00:00Z' },
    about: 'A single moment in time wears many coats, and this tool converts between all of them: Unix timestamps (seconds or milliseconds), ISO 8601, RFC 3339 and RFC 7231 strings, UTC, your locale-formatted string, the Excel serial number (days since 1900-01-01), and the leading 4-byte timestamp embedded in a Mongo ObjectID. Where a format names no timezone, your browser local zone is applied — so "now" on this page may read a different wall-clock than a UTC log line for the same instant. Everyday uses: turning a timestamp from a log or database field into a readable local time, checking whether an expiry (a JWT exp, a cache TTL, a Mongo-created document) is already in the past, and generating values for test fixtures.',
    faqs: [
      { q: 'Is my timestamp in seconds or milliseconds?', a: 'Count the digits: 10 digits is seconds (good until the year 2286), 13 digits is milliseconds. Pasting seconds where milliseconds are expected lands you centuries in the future — the wrong scale is usually obvious as soon as you convert.' },
      { q: 'Why does the converted time shift by hours?', a: 'Timezone interpretation. ISO strings like 2026-10-05T08:00:00Z name an exact moment (Z = UTC), but "2026-10-05 08:00" without a zone is ambiguous and gets read as your local time. A +8h shift almost always means one side treated a zone-less string as UTC and the other as local.' },
      { q: 'Which timestamp format should I store in my database?', a: 'Either UTC ISO 8601 strings or integer Unix timestamps — both are unambiguous. What you must avoid is zone-less datetime strings in local time: they break the moment a server, a user or daylight saving changes the timezone.' },
    ],
    relatedNotes: [
      {
        slug: 'unix-timestamp-guide',
        title: 'Unix Timestamp Guide: UTC, Milliseconds and the 2038 Problem',
        description: 'What a Unix timestamp really is, why UTC and local time disagree, seconds versus milliseconds, and what the 2038 problem will do to 32-bit systems.',
        url: 'https://notes.digdevbox.com/posts/unix-timestamp-guide',
        tag: 'Date',
      },
    ],

  },

  '/unix-timestamp-converter': {
    intro: 'Converts a Unix epoch timestamp (seconds or milliseconds) into a readable date, or turns a date back into a timestamp.',
    steps: ['Paste a timestamp or enter a date and let the format auto-detect', 'Read the Unix timestamp in seconds and the milliseconds value', 'Switch the format if you need ISO 8601, RFC 3339, UTC or your locale'],
    notes: ['Unix timestamps in seconds are 10 digits (good until 2286); milliseconds are 13 digits'],
    example: { label: 'Paste a sample timestamp', text: '1681333824' },
    about: 'A Unix timestamp — also called epoch or POSIX time — is the number of seconds (or milliseconds) since 1970-01-01T00:00:00Z, UTC, ignoring leap seconds. Seconds are the common form (10 digits, for example 1681333824 = 2023-04-12 21:10:24 UTC), while JavaScript Date.now() and many APIs use milliseconds (13 digits). The same instant has both forms: 1681333824 seconds and 1681333824000 milliseconds are the exact same moment. This tool takes either, shows it alongside ISO 8601 / RFC 3339 / UTC / locale renderings, and can turn a date back into a timestamp — useful for reading log lines, checking whether a JWT exp or cache TTL has already passed, and generating fixtures.',
    faqs: [
      { q: 'Is my timestamp in seconds or milliseconds?', a: 'Count the digits: 10 digits is seconds (good until the year 2286), 13 digits is milliseconds. Pasting seconds where milliseconds are expected lands you centuries in the future — the wrong scale is usually obvious as soon as you convert.' },
      { q: 'Why does the converted time shift by hours?', a: 'Timezone interpretation. A bare timestamp has no timezone — it is an absolute count of seconds from the epoch — so the rendered UTC / ISO values are always the same instant; the hours only "shift" when you compare against a zone-labelled string.' },
      { q: 'What happens at the 2038 problem?', a: '32-bit systems store seconds in a signed 32-bit integer, which overflows on 2038-01-19. Modern languages and this tool use 64-bit math, so 1681333824 and far-future timestamps convert correctly; the limit only bites old 32-bit runtimes.' },
    ],
    relatedNotes: [
      {
        slug: 'unix-timestamp-guide',
        title: 'Unix Timestamp Guide: UTC, Milliseconds and the 2038 Problem',
        description: 'What a Unix timestamp really is, why UTC and local time disagree, seconds versus milliseconds, and what the 2038 problem will do to 32-bit systems.',
        url: 'https://notes.digdevbox.com/posts/unix-timestamp-guide',
        tag: 'Date',
      },
    ],

  },

  '/device-information': {
    intro: 'Shows the current device screen size, pixel ratio, User-Agent and more — useful evidence when debugging compatibility issues.',
    steps: ['Open the page to see all the information', 'Copy the fields you need'],
    about: 'See what your browser tells websites about this device: screen size and pixel ratio, user agent, platform, language, CPU cores, memory hints and more. The quick answer to "what fingerprint am I presenting" and a handy reference when debugging layout or feature-detection issues.',
    faqs: [
      { q: 'Do websites really see all of this?', a: 'Yes — every field here is readable by any site\'s JavaScript without permissions. Individually harmless, collectively they form the fingerprint that makes ad tracking possible.' },
      { q: 'Why does my screen size look smaller than my display?', a: 'The values are CSS pixels of the window, not hardware pixels; pixel ratio multiplies them for the physical panel. A 4K screen with DPR 2 reports half the width in CSS pixels.' },
      { q: 'Can I change what I reveal?', a: 'Partially — privacy extensions and some browser settings spoof or freeze fields like the user agent. Reload this page after changing them to see what the spoof looks like to sites.' },
    ],
  },

  '/docker-run-to-docker-compose-converter': {
    intro: 'Turns a long docker run command into a docker-compose.yml, saving you from writing the compose file by hand.',
    steps: ['Paste the docker run command', 'The compose snippet is generated on the right', 'Check the port mappings and volume mounts before copying'],
    notes: ['Automatic conversion covers the common flags; health checks, network aliases and similar need to be added by hand'],
    about: 'Containerising a service by hand means a docker run command on the whiteboard and a compose file in the repo — two sources that drift apart. This tool reads a docker run command and emits the equivalent docker-compose.yml service entry: the image and container name, published port mappings, volume mounts, environment variables and restart policy all carry over, so the command you tested locally becomes version-controlled infrastructure. The generated YAML is a starting point, not a substitute for review: automatic conversion covers the common flags, while health checks, network aliases, depends_on ordering and multi-service wiring still need to be added by hand — the tool makes the mechanical 80% instant so you can spend attention on the part that actually needs judgement.',
    faqs: [
      { q: 'Which docker run flags are converted automatically?', a: 'The common ones: --name, -p port mappings, -v volume mounts, -e environment variables, --restart, --network and the image tag. Each maps to the corresponding compose service field. Flags that describe orchestration (health checks, network aliases, swarm constraints) are not covered and should be added manually in the generated YAML.' },
      { q: 'Can I paste a command with line continuations or extra whitespace?', a: 'Yes. The parser tolerates backslash line continuations and irregular spacing, so a multi-line command copied from a README converts the same as a single-line one. Flags with values are matched by name, not by position.' },
      { q: 'Does the generated compose file work with docker compose v2?', a: 'Yes. The output uses the standard service fields (image, ports, volumes, environment, restart) that both docker compose v2 and Compose V2-compatible tools understand. Always run docker compose config or start the stack once before committing the file — the tool converts syntax, it cannot validate that your actual image and paths exist.' },
    ],
    example: { label: 'Fill in a sample command', text: 'docker run -d --name web -p 8080:80 -v /data:/usr/share/nginx/html nginx:latest' },
    relatedNotes: [
      {
        slug: 'devops-tools-guide',
        title: 'DevOps Tools for Everyday Work: Cron, Permissions and Docker Compose',
        description: 'Everyday DevOps tasks that cost the most time — writing cron expressions, computing chmod permissions, converting docker run commands — with tools for each.',
        url: 'https://notes.digdevbox.com/posts/devops-tools-guide',
        tag: 'DevOps',
      },
    ],
  },

  '/email-normalizer': {
    intro: 'Normalises email addresses into a standard form — useful for de-duplication, cleaning data or matching accounts.',
    steps: ['Paste one or more email addresses', 'Read the normalised results', 'Apply the rules you need for + tags, casing, dots, etc.'],
    notes: ['Gmail\'s dot and + tag rules differ between providers; confirm your own policy before de-duplicating'],
    example: { label: 'Fill in a sample email', text: 'John.Doe+news@Gmail.com' },
    about: 'Normalise a list of email addresses (one per line) so that equivalent addresses collapse into one canonical form — lower-casing and folding away provider-specific aliases such as Gmail-ignored dots and plus-addressing. Built for deduplication: merge mailing lists, clean CRM exports, compare subscriber files.',
    faqs: [
      { q: 'Why do john.doe@gmail.com and johndoe@gmail.com match?', a: 'Gmail ignores dots in the local part and treats everything after a plus sign as a label, so both belong to the same mailbox. Normalisation folds them together so your dedupe actually dedupes.' },
      { q: 'Is plus-addressing safe to strip for every provider?', a: 'It is safe for Gmail-style providers. Some mail servers treat plus tags as real distinct addresses, so keep the raw list as the source of truth and use the normalised one only for comparison.' },
      { q: 'Does normalisation fix typos?', a: 'No — it folds equivalent spellings, not wrong ones. gmial.com stays wrong; syntax and domain checks are a separate concern.' },
    ],
  },

  '/emoji-picker': {
    intro: 'Search and copy emoji, and look up their Unicode code points.',
    steps: ['Type a keyword in the search box (e.g. smile)', 'Click the emoji you need', 'Copy the character or its Unicode encoding'],
    example: { label: 'Fill in a sample query', text: 'smile' },
    about: 'Browse and search the emoji set, then copy either the emoji itself, its Unicode escape or its code points. Handy for picking the right glyph in UI copy, README badges or commit messages, and for resolving "which character is this exactly" when an emoji renders differently across platforms.',
    faqs: [
      { q: 'Why does an emoji look different on my colleague\'s phone?', a: 'Each platform draws emoji with its own font. The code point is the standard; the artwork is not. Copying the code point guarantees you mean the same character, not the same look.' },
      { q: 'What is a code point and why do some emojis show two?', a: 'Characters outside the BMP are written as surrogate pairs in JavaScript, so one emoji can span two code units. Flags and skin-tone variants also combine several code points into one glyph.' },
      { q: 'Can I search by description?', a: 'Yes — search by keyword to find emoji by meaning instead of scrolling. Searching "fire" beats hunting for the flame glyph by eye.' },
    ],
  },

  '/encryption': {
    intro: 'Encrypts and decrypts text with symmetric algorithms such as AES, TripleDES, Rabbit and RC4.',
    steps: ['Enter the text to encrypt', 'Set a key', 'Pick an algorithm and click encrypt; to decrypt, enter the ciphertext with the same key and click decrypt'],
    notes: [
      'If you lose the key you cannot recover the data — save it first',
      'Algorithms and modes are not interchangeable: decryption must use exactly the same settings as encryption',
    ],
    example: { label: 'Fill in sample text', text: 'This is a message to encrypt' },
    about: 'Encrypt and decrypt text with classic web cryptography algorithms — AES, TripleDES, Rabbit and RC4 (via crypto-js) — using a shared key. Handy for quick obfuscation of notes between machines, CTF puzzles, or interoperability checks when you need to see exactly what a given cipher+key produces.',
    faqs: [
      { q: 'Is this suitable for protecting real secrets?', a: 'Treat it as a utility, not an infrastructure: AES here is fine for a locked note, but serious key management (storage, rotation, derivation) is what real cryptography engineering is for. Never protect anything critical with RC4.' },
      { q: 'Why does the same text encrypt differently each time?', a: 'Modes like CBC use a random initialisation vector, so identical plaintext+key yields different ciphertext — by design. Decrypting still returns the original text.' },
      { q: 'Which algorithm should I pick?', a: 'AES is the modern default. TripleDES is legacy-compatible, Rabbit and RC4 are stream ciphers mostly seen in old systems — use them only to interoperate with something that already speaks them.' },
    ],
  },

  '/eta-calculator': {
    intro: 'Estimates when a task will finish based on current progress — a clear way to see how much longer a download or batch job needs.',
    steps: ['Enter the amount completed', 'Enter the total amount', 'Read the estimated completion time'],
    example: { label: 'Fill in a sample amount', text: '500' },
    about: 'ETA stands for Estimated Time of Arrival — the projected finish time of an ongoing task. This calculator answers it with two inputs: how much of the work is done and how much there is in total. From your current pace it projects the remaining duration and the clock time when your download, build, transfer or batch job will actually finish. The same maths powers the ETA you see in download managers, package trackers and CI pipelines: elapsed time ÷ completed fraction = total time, and the remainder from that gives the finish. Useful whenever a progress bar leaves you doing mental arithmetic.',
    faqs: [
      { q: 'What does ETA stand for?', a: 'Estimated Time of Arrival — the projected completion time of a task in progress. In logistics it means when a shipment arrives; in computing, when a download, build or job finishes.' },
      { q: 'How is ETA calculated?', a: 'Divide elapsed time by the completed fraction to project total duration, then subtract elapsed time to get the remainder — or simply read off the projected finish clock time. Constant pace is assumed; see the caveat below.' },
      { q: 'What inputs does it need?', a: 'Two quantities: how much is completed and the total amount, optionally with a start time so the estimate anchors to real elapsed time. From those it projects the remaining duration and the finish time.' },
      { q: 'Why does the ETA jump around during a download?', a: 'Because it extrapolates from instantaneous rate, which fluctuates. Early estimates are wildly optimistic; the number stabilises as more progress accumulates. Judge it near the middle of the job, not the start.' },
      { q: 'Does it assume the rate stays constant?', a: 'Yes — it is a linear projection. If your task accelerates or decelerates (compiling, syncing), treat the output as a running snapshot and re-check as progress advances.' },
    ],
  },

  '/git-memo': {
    intro: 'A cheat sheet of common Git commands for when you have forgotten the exact flags.',
    steps: ['Find the scenario by category', 'Copy the command', 'Replace the placeholders with your own branch or file names'],
    about: 'Git\'s model is simple; its flag surface is not. Everyone re-learns the same half-dozen situations: undoing a commit, squashing before a pull request, un-staging a file, pointing a branch at the right remote. This cheat sheet organises those recurring situations by category and gives one copy-paste command per scenario, with placeholders for the parts that vary (branch names, file names, commit ranges). It is deliberately a reference, not a tutorial: each entry assumes you know what the operation means and just need the exact syntax, so you can get back to work in seconds. For anything beyond the everyday cases — interactive rebase surgery, reflog archaeology, submodule workflows — the entries link the concept name you should search for next.',
    faqs: [
      { q: 'Do I need to change anything before pasting a command?', a: 'Usually yes — the placeholders. Commands are shown with tokens like your-branch or file-name standing in for the values that differ per situation. Replace them with your own branch, file or commit range; the surrounding flags are already correct.' },
      { q: 'Is this a Git tutorial?', a: 'No, and that is on purpose. Each entry is one command for one recognised situation, assuming you already know what the operation does. If you are unsure what a command will change, run it with --dry-run where available or check the linked concept in the official documentation first.' },
      { q: 'I ran a command from the list and want to undo it — is that covered?', a: 'The undo scenarios (un-staging, amending, resetting a commit, restoring a file) are their own category precisely because they get forgotten. For anything else, git reflog records where HEAD has been, which is the general escape hatch when a listed command did something unexpected.' },
    ],
  },

  '/hash-text': {
    intro: 'Computes MD5, SHA-1, SHA-256, SHA-512, SHA-3, RIPEMD-160 and more digests of a text, in hex or binary — for verifying content integrity or producing fingerprints.',
    steps: ['Paste the text', 'Choose the algorithm in the result area', 'Copy the corresponding digest'],
    notes: ['MD5 and SHA1 are no longer collision-resistant; do not use them for passwords or signatures'],
    about: 'A hash function turns input of any size into a fixed-length digest: the same input always gives the same digest, but you cannot get the input back from it. This tool computes all of the widely used algorithms at once — MD5, RIPEMD-160, the SHA-1/2/3 families — and shows each digest as hex plus binary, so a single paste replaces running openssl dgst per algorithm. Hashes of text are not hashes of files: an extra trailing newline silently changes every digest, which is the most common reason two "identical" texts disagree. For signatures and message authentication you need HMAC instead (see Related Tools); for passwords you need a slow, salted scheme like bcrypt — neither a plain SHA-256 nor this page\'s output is acceptable there.',
    faqs: [
      { q: 'Which hash algorithm should I use?', a: 'For integrity checks and general fingerprints today, SHA-256 or SHA-512. MD5 and SHA-1 still work for detecting accidental corruption but must not be used where an adversary can craft collisions — signatures, certificates, password storage.' },
      { q: 'Why do MD5 and SHA-1 hashes differ between tools for the same text?', a: 'Usually the input is not identical: a trailing newline, CRLF versus LF line endings, or a BOM all change the bytes and therefore every digest. Paste again without the hidden characters and they will match.' },
      { q: 'Can I recover the original text from a hash?', a: 'No. Hashing is one-way by design. A hash "database" only matches precomputed inputs — a strong, unique input such as a random password will not be found in one.' },
    ],
    example: { label: 'Fill in sample text', text: 'hello world' },
  },

  '/hmac-generator': {
    intro: 'Computes an HMAC with MD5, SHA-1, SHA-2, SHA-3 or RIPEMD-160 from a message and a shared key — for API request signing and verifying a message origin.',
    steps: ['Enter the message', 'Enter the key', 'Choose a hash algorithm to get the HMAC'],
    notes: ['HMAC depends on the key: a different key gives a completely different result, so both sides must agree on it'],
    about: 'HMAC (hash-based message authentication code) mixes a secret key into the hashing process, so the output can only be reproduced by someone who holds the same key. Where a plain hash proves "these bytes are unchanged", an HMAC proves "these bytes are unchanged AND sent by someone who knows the key" — which is why request signing for payment callbacks, webhooks and API authentication is built on it. The underlying algorithm matters less than key discipline: any member of the SHA-2 family is fine, but the key must travel to the other side over a channel you already trust, and must never appear in the request itself. This tool computes the HMAC locally in your browser, so it is safe for experimenting with real keys, but remember that anything pasted into a web page you do not control is a leak risk.',
    faqs: [
      { q: 'HMAC vs a plain hash — when do I need the key?', a: 'Whenever the receiver must know who produced the digest. A plain SHA-256 of a payload can be computed by anyone; an HMAC-SHA256 can only be computed (or verified) by holders of the key, which is what "signing" means in most API docs.' },
      { q: 'Which HMAC algorithm should I pick?', a: 'Match what the other side specifies — HMAC-SHA256 is the most common default. The algorithm is not a security dial: upgrading MD5 to SHA-512 does not compensate for a weak or reused key.' },
      { q: 'Why does my HMAC not match the server\'s value?', a: 'The usual suspects, in order: the key differs (trailing whitespace, a copied "example" key), the payload bytes differ (JSON key order, CRLF, unicode escaping), or you hashed the payload when the server signed payload plus extra headers. Compare hex outputs byte by byte.' },
    ],
    example: { label: 'Fill in a sample message', text: 'hello world' },
  },

  '/html-entities': {
    intro: 'Converts characters such as <, > and & into HTML entities (or back), and doubles as a searchable reference table of common HTML character entities.',
    steps: ['Paste the original text, then click escape or unescape and copy the result', 'Or use the reference table below: search by character, entity name or meaning', 'Each table row gives the character with its named, decimal and hex forms'],
    example: { label: 'Fill in sample text', text: '<div class="box">Hello & "World"</div>' },
    notes: [
      'Only &amp; &lt; &gt; " and \' are converted by the escape box — named and numeric entities pass through unchanged.',
      'Escaping already-escaped text produces &amp;amp;amp; — the classic double-escape bug, which this tool makes easy to spot.',
      'Escaping is not sanitising: it stops markup being broken, it does not make untrusted HTML safe to render.',
      'The reference table lists ~38 common named entities with their decimal and hex forms, so you can look up a character instead of converting a whole string.',
    ],
    about: 'Two jobs in one page. The escape/unescape boxes handle the five characters that break markup: &amp; &lt; &gt; &quot; and &#39; are what &, <, >, a double quote and an apostrophe turn into, and the reverse pass puts them back — the scope is deliberately the minimal set that stops a string breaking out of an attribute or text node, not a full conversion (named entities like &eacute; pass through untouched). Below that sits a searchable reference of common HTML character entities — quotation marks, dashes, currency and math symbols, Greek letters — each row showing the character with its named, decimal (&#NNN;) and hex (&#xNN;) forms, so when you only need "what is the entity for an em dash" you look it up rather than round-tripping a string.',
    faqs: [
      { q: 'When must I escape HTML?', a: 'Whenever untrusted text becomes part of markup — comments, form values, rich-text imports. Skipping it is how XSS happens; escaping turns a payload into visible text.' },
      { q: 'How do I write an em dash or © as an entity?', a: 'Look it up in the reference table on this page: &mdash; for the em dash, &copy; for copyright. Each entry also gives the decimal and hex numeric forms (&#8212; / &#x2014; and &#169; / &#xA9;), which you can use when a named entity is not supported.' },
      { q: 'What is the difference between named and numeric entities?', a: 'Named ones (&amp;, &lt;) are readable; numeric ones (&#38;, &#x26;) work for every character, including those without a name. Both decode to the same character, and the reference table shows the three forms side by side.' },
      { q: 'Why does &amp; appear inside URLs?', a: 'An ampersand that separates query parameters is itself a live entity, so escaping it as &amp; is the correct encoding for HTML attribute or text contexts — but the raw & is what the server parses. Escape for the document, not for the request line.' },
    ],
  },

  '/html-wysiwyg-editor': {
    intro: 'A WYSIWYG rich-text editor whose HTML source you can grab once you are done editing.',
    steps: ['Type or paste into the editing area', 'Use the toolbar to adjust formatting', 'Copy the generated HTML from the panel below'],
    notes: [
      'Tables, images and links are outside the loaded schema — they will not appear, however you paste them in.',
      'The HTML panel is read-only output: copy from it, do not type into it.',
      'The draft is stored in this browser only, so it survives a reload but not a different device.',
    ],
    about: 'A rich-text editor in the browser with the generated HTML shown beside it, run through Prettier so the source stays readable. It is Tiptap with the StarterKit bundle, which means the toolbar covers the paragraph-level building blocks: bold, italic, strikethrough, inline code, code blocks, headings 1–4, bullet and ordered lists, blockquote, horizontal rule, clear formatting and undo/redo. Your draft is kept in browser storage so a reload does not lose it, and nothing is uploaded anywhere.',
    faqs: [
      { q: 'How clean is the generated HTML?', a: 'Cleaner than most. StarterKit renders marks and nodes as plain semantic elements — <strong>, <em>, <h2>, <ul><li>, <pre><code> — without the inline style attributes that Word and page builders leave behind. Prettier then re-indents the result. Review it anyway when the HTML goes into a template with its own CSS.' },
      { q: 'Can I paste from Word or a web page?', a: 'You can, but the editor does not keep what it does not understand. Content is parsed against the loaded schema, so spans, classes and empty paragraphs from Word are dropped rather than carried over — which is usually what you want. Formatting that survives is the subset the toolbar can produce.' },
      { q: 'Does it support tables and images?', a: 'No. Only Tiptap StarterKit is loaded, and it has no table, image or link node, so there is no button for them and pasted tables or images are discarded on the way in. For those elements you need hand-written HTML in an editor whose schema includes them.' },
      { q: 'Can I edit the HTML directly?', a: 'No. The HTML panel is a formatted, copy-only view of what the editor produced — typing there does not feed back into the document. Format with the toolbar, then copy the source out.' },
      { q: 'Will my text survive a refresh?', a: 'Yes. The document is saved to this browser\'s local storage under the tool\'s own key, so it is still there when you come back. Clearing site data, or switching browser or machine, starts from the default sample text.' },
    ],
  },

  '/http-status-codes': {
    intro: 'A reference for the meaning of every HTTP status code, for when you hit an unfamiliar one.',
    steps: ['Find the code by category or search', 'Read its official name and the usual scenario'],
    example: { label: 'Fill in a sample query', text: '404' },
    about: 'The complete list of HTTP status codes with their official name and a plain-language meaning for each — from 200 OK through the redirect class (3xx), client errors (4xx) and server errors (5xx). A quick reference when reading logs, writing an API client or explaining a failure to a teammate.',
    faqs: [
      { q: '401 vs 403 — which one do I return?', a: '401 means "who are you?" — authentication is missing or invalid. 403 means "I know who you are and you still cannot do this." If re-login could fix it, use 401; otherwise 403.' },
      { q: '301, 302, 307 — what is the practical difference?', a: '301 is permanent and clients may cache it forever; 302 is temporary but legacy clients may switch method to GET; 307 is temporary with the method preserved. For a temporary POST redirect, 307 is the safe modern answer.' },
      { q: 'Is a 4xx my fault or the client\'s?', a: 'Convention: 4xx means the request was bad (bad URL, bad credentials, rate limited) and the client must change something; 5xx means the server failed despite a valid request.' },
    ],
    relatedNotes: [
      {
        slug: 'http-status-codes-guide',
        title: 'HTTP Status Codes Guide: 2xx, 3xx, 4xx, 5xx and How to Respond',
        description: 'What each HTTP status class means, why 301 and 302 behave differently, and how to handle 429 rate limiting and 503 outages on both sides of the request.',
        url: 'https://notes.digdevbox.com/posts/http-status-codes-guide',
        tag: 'HTTP',
      },
    ],

  },

  '/iban-validator-and-parser': {
    intro: 'Validates an IBAN bank account number and breaks it down into country, check digits and BBAN.',
    steps: ['Enter the IBAN (spaces are fine)', 'Read the validation result', 'Read the parsed country code and account parts below'],
    notes: ['An IBAN carries its own check digits, so a malformed one is rejected outright — first check you did not mistype it'],
    example: { label: 'Fill in a sample IBAN', text: 'DE89 3704 0044 0532 0130 00' },
    about: 'Validate an IBAN and break it into its parts: country code, check digits, BBAN and a space-grouped friendly format for display. The validator implements the ISO 13616 mod-97 check, so a mistyped digit is caught instantly — exactly what you want before wiring money or storing the number in a CRM.',
    faqs: [
      { q: 'How does IBAN validation work?', a: 'The check digits are computed over the rearranged account number with a mod-97 operation (ISO 13616). If the whole number does not satisfy the check, at least one character is wrong — though validity does not guarantee the account exists.' },
      { q: 'What is a QR-IBAN?', a: 'A Swiss variant with an alternative check-digit calculation, reserved for QR-bill invoicing. This tool flags whether an IBAN is one, which matters if you process Swiss payments.' },
      { q: 'Why is the friendly format grouped in fours?', a: 'IBANs are officially printed in four-character blocks because grouped digits are dramatically easier to read aloud and transcribe. The grouping is presentation only — systems store it without spaces.' },
    ],
  },

  '/ipv4-address-converter': {
    intro: 'Converts an IPv4 address into decimal, binary and hexadecimal forms — useful when writing scripts or reading packet dumps.',
    steps: ['Enter the IPv4 address', 'Read the results in each base', 'Copy the format you need'],
    example: { label: 'Fill in a sample address', text: '192.168.1.1' },
    notes: [
      'Validation is strict dotted-quad: partial forms like 10.1 or leading-zero octets are rejected rather than silently reinterpreted.',
      'The decimal form is the 32-bit integer, so 192.168.0.1 and 3232235521 are the same address written differently — some resolvers and browsers accept the numeric form.',
      'The IPv6 output is the IPv4-mapped representation, not a real IPv6 allocation.',
    ],
    about: 'An IPv4 address is really just a 32-bit number, and the dotted form you know (192.168.1.1) is only one way to write it. This tool converts an address into its decimal integer, binary, hexadecimal and IPv6-mapped forms at once, which is exactly what you need when reading flags and masks in packet captures, building a reverse-DNS or PTR name, or debugging a parser that accepted one notation and rejected another. Input is validated as a dotted quad before anything is computed, so a typo produces a complaint rather than a plausible-looking wrong number.',
    faqs: [
      { q: 'Why does 192.168.0.1 equal 3232235521?', a: 'The four octets are one 32-bit number: 192×256³ + 168×256² + 0×256 + 1 = 3232235521. Dotted notation is a convenience for humans; many systems store the plain integer.' },
      { q: 'What is the IPv6 form of an IPv4 address?', a: 'IPv4 addresses can be represented inside IPv6 as a mapped address like ::ffff:c0a8:1 (192.168.0.1). You will meet this form in dual-stack logs and transition mechanisms.' },
      { q: 'Can I open a decimal IP in my browser?', a: 'Often yes — http://3232235521 works in most browsers because the OS resolves it to 192.168.0.1. Some browsers restrict it, so treat it as a debugging trick, not a production pattern.' },
      { q: 'Why does 10.0.0.256 fail instead of wrapping?', a: 'Because each octet is range-checked before conversion. 256 does not fit in 8 bits, so the tool refuses the input rather than quietly producing a different address — a silent modulo would be far more dangerous than a rejection.' },
      { q: 'Which forms do network tools actually accept?', a: 'It varies, which is the reason the conversions exist. Command-line tools and resolvers commonly accept the decimal integer and the 0xAABBCCDD hexadecimal form; browsers have historically accepted several notations in the address bar. Application code and modern parsers usually insist on the dotted quad, so treat the other forms as debugging aids rather than as something to publish.' },
    ],
  },

  '/ipv4-range-expander': {
    intro: 'Given a start and end IP, computes the minimal list of CIDR blocks covering that range — very practical when tidying firewall rules.',
    steps: ['Enter the start IP', 'Enter the end IP', 'Read the generated CIDR list'],
    notes: ['If the range is not a contiguous block it is split into several CIDRs — that is expected'],
    example: { label: 'Fill in a sample start IP', text: '10.0.0.1' },
    about: 'Given a start and an end address, this tool finds the smallest CIDR block (or a minimal set of blocks) that covers the whole range. Useful when a firewall, cloud security group or routing table only accepts CIDR notation but your list of machines was defined by two endpoints.',
    faqs: [
      { q: 'Why is the result larger than my range?', a: 'CIDR blocks must start on a boundary and have a power-of-two size. If your start and end are not aligned, the covering block necessarily includes extra addresses on both sides — the tool picks the smallest such block.' },
      { q: 'Why did my range split into several CIDRs?', a: 'Some ranges cannot be covered by a single block without huge waste. The tool then returns the minimal set of contiguous blocks that exactly covers your endpoints, which is still valid for firewall rules.' },
      { q: 'What does /32 mean here?', a: '/32 is a block of exactly one address — start and end are the same. It is the tightest possible rule and often what you want when whitelisting a single host.' },
    ],
  },

  '/ipv4-subnet-calculator': {
    intro: 'Parses a CIDR network and works out the full set of details: usable hosts, first and last address, mask and more.',
    steps: ['Enter the CIDR (e.g. 192.168.1.0/24)', 'Read the results below', 'Copy whichever field you need'],
    notes: ['The network address and broadcast address normally cannot be assigned to a host'],
    example: { label: 'Fill in a sample network', text: '192.168.1.0/24' },
    about: 'Paste a CIDR block like 192.168.1.0/24 and get everything a subnet plan needs: network and broadcast addresses, first and last usable host, usable host count, netmask and wildcard mask. Handy for VLAN planning, DHCP scope sizing or double-checking an assignment before you apply it.',
    faqs: [
      { q: 'How many addresses are in a /24?', a: '256 total. Subtracting the network and broadcast addresses leaves 254 usable hosts — this is the most common home-lab and small-office subnet.' },
      { q: 'Why do two addresses disappear from the usable count?', a: 'The lowest address identifies the network itself and the highest is reserved for broadcast, so neither can be assigned to a host. The calculator shows them explicitly so nothing surprises you.' },
      { q: 'What is a wildcard mask for?', a: 'It is the inverted netmask (0.0.0.255 for /24). Access control lists on routers and some firewalls are written with wildcards instead of netmasks, and mixing the two up breaks matching.' },
      { q: 'How do I calculate a subnet mask from CIDR?', a: 'Paste the CIDR (192.168.1.0/24) and the netmask, wildcard, host range and usable count are all derived at once — no manual binary math. /24 → 255.255.255.0, /26 → 255.255.255.192, and so on.' },
    ],
  },

  '/ipv6-ula-generator': {
    intro: 'Generates an IPv6 Unique Local Address (ULA) prefix per RFC 4193 for local networks — handy for addressing internal devices.',
    steps: ['Click generate to get a prefix', 'Combine it with a subnet and interface ID as needed', 'Copy and use it'],
    notes: ['A ULA is the IPv6 counterpart of a private IPv4 range and must not be routed on the public internet'],
    example: { label: 'Paste a sample MAC address', text: '00:11:22:33:44:55' },
    about: 'A ULA (Unique Local Address) is the IPv6 counterpart of the private IPv4 ranges: addresses under fd00::/8 that are free to use inside your organisation but must not be routed on the public internet. RFC 4193 asks for a randomly chosen 40-bit global ID so independently generated prefixes almost never collide, and that is exactly what this tool generates.',
    faqs: [
      { q: 'ULA vs public IPv6 — what is the difference?', a: 'Public addresses are globally routable and assigned by your provider. ULAs work only inside your network, never leave your router, and survive provider changes — good for infrastructure that should not be exposed.' },
      { q: 'Why generate the prefix randomly instead of picking fd00::1?', a: 'RFC 4193 mandates a random global ID precisely so two sites that later merge their networks will not clash. Hand-picked prefixes like fd00::/64 are a common source of hard-to-debug conflicts.' },
      { q: 'Can a ULA reach the internet?', a: 'No. Routers must not forward fd00::/8 to the public internet. Use it for internal services; hosts still get global addresses from your provider for outbound traffic.' },
    ],
  },

  '/json-diff': {
    intro: 'Compares two JSON documents and highlights the differences — makes config changes or API response drift obvious.',
    steps: ['Paste the original JSON on the left', 'Paste the new JSON on the right', 'Review the highlighted additions, removals and changes'],
    notes: ['Key order does not affect the comparison, but array order does'],
    about: 'Comparing two JSON documents by eye does not scale: a changed port or a missing comma hides easily among hundreds of lines. A JSON diff parses both sides and reports the differences structurally — values that were added, removed, or changed — instead of diffing raw text lines. That means JSON that was merely reformatted compares as equal, while a real value change stands out.',
    faqs: [
      { q: 'Does key order affect the result?', a: 'No. JSON objects are unordered key-value pairs, so { "a": 1, "b": 2 } equals { "b": 2, "a": 1 }. Arrays are ordered by definition — reordering array elements is reported as a change.' },
      { q: 'Why do two values that look identical show as different?', a: 'Usually the type changed: 1 (number) and "1" (string), or true and "true", render similarly but are different JSON values. A textual diff hides that; a structural diff points at the type mismatch.' },
      { q: 'Can I compare large documents?', a: 'Everything runs in your browser, so the practical limit is tab memory — documents of a few megabytes are fine.' },
    ],
    example: { label: 'Fill in sample JSON', text: '{ "name": "DigDevBox", "version": 1, "tags": ["a", "b"] }' },
    relatedNotes: [
      {
        slug: 'json-formatting-guide',
        title: 'JSON Formatter Guide: Format, Validate and Compare JSON Online',
        description: 'How to format, validate, minify and compare JSON online — a practical guide to cleaning up API responses, spotting syntax errors and diffing config files.',
        url: 'https://notes.digdevbox.com/posts/json-formatting-guide',
        tag: 'JSON',
      },
    ],
  },

  '/json-minify': {
    intro: 'Strips the whitespace and newlines out of JSON, compressing it onto one line to save transfer size.',
    steps: ['Paste the formatted JSON', 'Get the minified result', 'Copy and use it'],
    example: { label: 'Fill in sample JSON', text: '{\n  "name": "DigDevBox",\n  "list": [1, 2, 3]\n}' },
    notes: [
      'Input is parsed as JSON5, so comments and trailing commas survive — but they are gone in the output, because JSON has nowhere to put them.',
      'Key order is preserved as written; minification does not sort keys.',
      'Unparsable input yields an empty result, so an empty output means the input was invalid, not that it was already minimal.',
    ],
    about: 'Minifying JSON strips everything the machine does not need: indentation, padding spaces and newlines. The parsed value stays exactly the same, but the file gets smaller and fits on one line — useful for embedding a payload in an environment variable, a query parameter or a commit. The input side is more forgiving than the output side: parsing goes through JSON5, so comments, trailing commas, single quotes and unquoted keys are all accepted on the way in, and what comes out is strict, compact JSON. If the input cannot be parsed at all, the result is empty rather than a stack of error text.',
    faqs: [
      { q: 'How much smaller does the file get?', a: 'For formatted JSON typically 20-40%: whitespace is pure overhead. Minifying does not shorten keys or values the way a binary format would — for transfer size, gzip on the transport layer is the next step.' },
      { q: 'Is minified JSON still valid?', a: 'Yes. Whitespace between tokens is not part of the JSON data model. Minifying requires parsing first, so invalid input errors out instead of producing broken output.' },
      { q: 'How do I get it back into readable form?', a: 'Paste it into the JSON formatter and it is re-indented. Minify and format are inverse operations at the presentation level — the data itself never changes.' },
      { q: 'Does it also prettify, or only minify?', a: 'Only minify — the output is deliberately one line with no indentation. For the readable form there is a separate JSON formatter; keeping the two directions in separate tools makes each one\'s output predictable.' },
      { q: 'My file had comments in it — where did they go?', a: 'They were accepted on input (JSON5 allows them) and dropped on output, because standard JSON has no comment syntax. If the comments are load-bearing, keep the annotated copy as the source of truth and minify only when shipping.' },
    ],
    relatedNotes: [
      {
        slug: 'json-formatting-guide',
        title: 'JSON Formatter Guide: Format, Validate and Compare JSON Online',
        description: 'How to format, validate, minify and compare JSON online — a practical guide to cleaning up API responses, spotting syntax errors and diffing config files.',
        url: 'https://notes.digdevbox.com/posts/json-formatting-guide',
        tag: 'JSON',
      },
    ],
  },

  '/json-prettify': {
    intro: 'Formats cramped JSON into a readable indented structure — essential when reading logs and API responses.',
    steps: ['Paste the minified JSON', 'Get the formatted result', 'Adjust the indentation if you need to'],
    notes: ['JSON only allows double quotes; single quotes fail to parse'],
    about: 'JSON (JavaScript Object Notation) is the de-facto data format for APIs and configuration files. Tools and logs usually emit it minified — one long line with no whitespace — which is compact to transfer but unreadable to humans. This tool re-indents that single line into a structure you can actually read, and fails loudly on invalid JSON, which makes syntax errors visible at a glance.',
    faqs: [
      { q: 'Does formatting change my data?', a: 'No. Whitespace between tokens is not part of the JSON data model, so the parsed value is identical before and after — only the presentation changes.' },
      { q: 'Why does my JSON fail to parse here?', a: 'The three most common causes: single quotes instead of double quotes, a trailing comma after the last element, and unescaped newlines inside strings. JSON is stricter than JavaScript object literals.' },
      { q: 'Is this the same as a JSON validator?', a: 'Formatting has to parse the input first, so invalid JSON shows up as an error either way. A dedicated validator also gives you the precise error position, which matters more for large documents.' },
    ],
    example: { label: 'Fill in sample JSON', text: '{"name":"DigDevBox","tools":["toolbox","devtools"],"count":2}' },
    relatedNotes: [
      {
        slug: 'json-formatting-guide',
        title: 'JSON Formatter Guide: Format, Validate and Compare JSON Online',
        description: 'How to format, validate, minify and compare JSON online — a practical guide to cleaning up API responses, spotting syntax errors and diffing config files.',
        url: 'https://notes.digdevbox.com/posts/json-formatting-guide',
        tag: 'JSON',
      },
    ],
  },

  '/csv-to-json': {
    intro: 'Paste CSV and get a JSON array of objects, one per data row, keyed by the header row. Quoted fields, commas and real line breaks inside a cell, doubled quotes, a leading BOM and CRLF endings are all handled.',
    steps: [
      'Paste the CSV text into the input box.',
      'Leave "First row holds the column names" on when the first row is a header; turn it off to get column_1, column_2 keys instead.',
      'Copy the JSON result.',
    ],
    notes: [
      'Every value becomes a string. Numbers, dates and booleans are not guessed, so 30 stays "30" instead of becoming the number 30.',
      'A row with more values than the header is not dropped: the extra values are kept under __extra_1, __extra_2 and the row number is reported above the output.',
      'Duplicate column names are renamed (a, a__2) instead of overwriting each other, and the rename is listed so you can fix the source.',
      'An empty header cell becomes column_N so no column is lost.',
      'An unterminated quote is reported as an error with its line number rather than producing a truncated result.',
    ],
    about: 'CSV has more conventions than rules. RFC 4180 defines quoted fields, doubled quotes as the escape and CRLF line breaks, but real exports from spreadsheets use semicolons, a UTF-8 BOM or bare LF depending on locale. A converter that just splits on commas quietly corrupts any cell containing a comma or a newline, which is why this tool parses character by character.',
    faqs: [
      { q: 'Why are all my numbers strings in the output?', a: 'CSV carries no type information, so guessing that 30 is a number would break values like 007 or a zip code with a leading zero. Every cell stays a string and typing is left to your code.' },
      { q: 'Can it read an Excel .xlsx file?', a: 'No. An .xlsx is a zipped workbook, not CSV. Save or export as CSV first, then paste the text here.' },
      { q: 'My file uses semicolons instead of commas.', a: 'Replace the semicolons with commas in a text editor, or export from your spreadsheet app with a comma separator.' },
      { q: 'What happens to a row with too few values?', a: 'Missing cells become empty strings and the row numbers are listed above the output, so ragged rows stay visible instead of being silently normalised.' },
    ],
    example: {
      label: 'Load an example CSV',
      text: 'name,role,joined\nAda,engineer,2021-03-02\nGrace,lead,2019-07-11\n',
    },
  },

  '/json-to-csv': {
    intro: 'Converts a JSON array into a CSV table for Excel or a data-analysis tool.',
    steps: ['Paste the JSON array', 'Check the auto-detected column headers', 'Copy or download the CSV'],
    notes: ['Nested objects are flattened or stringified; for deeply structured JSON it helps to tidy it first'],
    about: 'CSV is still the common language of spreadsheets. This tool takes a JSON array of objects — the shape most APIs return — and maps each object to a row, with the keys becoming column headers. Data moves from an API response into Excel, Numbers or a BI tool without writing a conversion script.',
    faqs: [
      { q: 'What happens to nested objects and arrays?', a: 'CSV has only flat rows. Nested values are flattened or stringified (an object becomes JSON text inside the cell). For deeply nested data, reshape the JSON first — the formatter helps you see the structure before converting.' },
      { q: 'How are the column headers decided?', a: 'From the keys of the objects in the array. If objects have different keys, the union is used and missing cells stay empty.' },
      { q: 'Will Excel open the result correctly?', a: 'For normal text, yes. Watch out for values starting with = (Excel treats them as formulas) and very long numbers turning into scientific notation. Importing the downloaded file is safer than copy-paste.' },
    ],
    example: { label: 'Fill in sample JSON', text: '[\n  { "id": 1, "name": "Alice", "score": 92 },\n  { "id": 2, "name": "Bob", "score": 88 }\n]' },
  },

  '/json-to-toml': {
    intro: 'Converts JSON into TOML, a common format for configuration files.',
    steps: ['Paste the JSON', 'Get the TOML result', 'Copy and use it'],
    example: { label: 'Fill in sample JSON', text: '{ "title": "demo", "server": { "port": 8080 } }' },
    about: 'TOML (Tom\'s Obvious Minimal Language) was designed as a readable config format that maps cleanly onto a hash table — and, crucially, onto JSON as well. This tool walks a JSON value and emits the equivalent TOML: objects become tables, nested objects become dotted keys or sub-tables, and arrays become TOML arrays. The reverse direction is handled by the TOML-to-JSON tool, so you can move between the two formats without hand-editing. This is the bridge most teams need when a project\'s config started as JSON but the surrounding tooling (Cargo, pyproject.toml, Hugo) expects TOML.',
    faqs: [
      { q: 'Do JSON and TOML represent the same data?', a: 'Mostly. TOML was deliberately designed so a TOML document maps onto a JSON object, and JSON is a subset of what TOML can express. The conversion is lossless for the common cases: strings, numbers, booleans, arrays and nested tables.' },
      { q: 'How are nested JSON objects written in TOML?', a: 'A nested object becomes either a [table] section or a dotted key. { "server": { "port": 8080 } } can be written as [server] followed by port = 8080, or as server.port = 8080 — both are valid TOML. This tool uses dotted keys for shallow nesting and full tables for deeper structures.' },
      { q: 'What is lost when converting?', a: 'Nothing in the data model, but TOML has stricter key rules than JSON: keys holding certain characters must be quoted, and duplicate keys across tables are an error. JSON allows arbitrary string keys, so if yours contain dots or square brackets, expect them to be quoted in the TOML output.' },
    ],
  },

  '/json-to-xml': {
    intro: 'Converts JSON into XML, for integrating with older systems that only accept XML.',
    steps: ['Paste the JSON', 'Get the XML result', 'Copy and use it'],
    notes: ['XML has no concept of arrays, so lists become repeated tags'],
    example: { label: 'Fill in sample JSON', text: '{ "user": { "id": 1, "name": "Alice" } }' },
    about: 'XML is still the interchange format for a lot of enterprise, payment and SOAP-style systems, even though JSON won. This tool maps a JSON value onto an XML document: objects become elements with a child element per key, arrays become repeated elements sharing the same tag name, and scalar values become text content. Because XML and JSON model data differently — XML has no native array or boolean type — the conversion makes a set of reasonable choices (booleans and numbers become string text, for instance), and the XML-to-JSON tool reverses it when you receive XML back.',
    faqs: [
      { q: 'How are arrays represented in XML?', a: 'An array of values becomes several sibling elements that share the same tag name. [1, 2, 3] under the key "item" becomes <item>1</item><item>2</item><item>3</item>. There is no XML array type, so the repeated-tag convention is the standard way to round-trip a list.' },
      { q: 'What happens to the root element?', a: 'XML documents need exactly one root element, but top-level JSON may be an object, array or scalar. This tool wraps the output in a root element (commonly <root>) so the result is always well-formed XML; rename it to match the schema your consumer expects.' },
      { q: 'Is the conversion reversible?', a: 'With caveats. Converting XML back to JSON again loses the distinction XML never had — there is no native boolean or number, everything is text — so 1 may come back as the string "1". Keep the original JSON if you need exact types round-tripped.' },
    ],
  },

  '/json-to-yaml-converter': {
    intro: 'Converts JSON into YAML, widely used for Kubernetes manifests and other configuration files.',
    steps: ['Paste the JSON', 'Get the YAML result', 'Copy and use it'],
    example: { label: 'Fill in sample JSON', text: '{ "name": "devbox", "services": ["web", "api"] }' },
    about: 'YAML is a superset of JSON — any valid JSON is also valid YAML — which is why it is so common for configuration: it preserves everything JSON can express while adding a cleaner, indentation-based syntax and comments. This tool re-emits a JSON value as idiomatic YAML: nested objects become indented blocks, arrays become dash lists, and quoting is added only where YAML would otherwise misinterpret the value (a bare yes or 1.0, for example). The companion YAML-to-JSON tool does the reverse when you need to feed a YAML config into a JSON API.',
    faqs: [
      { q: 'Is the result valid YAML?', a: 'Yes — YAML is a superset of JSON, so the emitted text parses as both. Indentation is added with spaces (never tabs, which YAML rejects), and values that look like other YAML types are quoted so they stay strings.' },
      { q: 'Why did my number get quoted?', a: 'YAML infers types: a value like 1.0 or 2024 may be read back as a number, and yes/no/on/off as booleans. To keep the data identical to the source JSON, this tool quotes values that would otherwise be reinterpreted, so "1.0" stays the string "1.0".' },
      { q: 'Can I convert this back to JSON?', a: 'Yes, with the YAML-to-JSON tool. Because YAML is a JSON superset the round trip is lossless for the data model; you only lose the YAML comments, which JSON has no place to store.' },
    ],
    relatedNotes: [
      {
        slug: 'yaml-vs-json-guide',
        title: 'YAML vs JSON: Syntax Differences, Trade-offs and Parser Traps',
        description: 'How YAML and JSON differ in syntax and intent, which one to pick for a given file, and the parser traps — indentation, yes/no dates — that break otherwise valid YAML.',
        url: 'https://notes.digdevbox.com/posts/yaml-vs-json-guide',
        tag: 'YAML',
      },
    ],

  },

  '/jwt-parser': {
    intro: 'Decodes a JWT so you can read the header, payload and signature sections directly.',
    steps: ['Paste the token', 'Read the three decoded sections', 'Check claims such as the expiry time'],
    notes: [
      'This only decodes, it does not verify — you cannot tell from here whether the token was tampered with',
      'The payload is plain Base64, so never put sensitive data in it',
    ],
    about: 'A JWT (JSON Web Token) is three Base64URL segments joined by dots: header (algorithm and token type), payload (the claims, such as sub for the subject and exp for expiry) and signature. Decoding is pure Base64 — that is what this tool does — so anyone holding the token can read every claim inside it. That is fine and intended: JWTs carry identity, not secrecy. What decoding cannot tell you is authenticity — only the server holding the secret key or public key can verify the signature, and until it does, any decoded content should be treated as unverified input. Reading an expired token, checking which claims a third-party service actually issues, or debugging why your auth middleware rejects a token are the everyday jobs of this page.',
    faqs: [
      { q: 'Does decoding a JWT verify it?', a: 'No. Decoding just reverses Base64URL and anyone can do it, including an attacker with a forged token. Verification requires the signing key (HMAC) or public key (RSA/ECDSA) on the server. A token whose signature you have not verified is a claim, not a fact.' },
      { q: 'Is it safe to put user data in the JWT payload?', a: 'Readable, yes; sensitive, no. The payload is plain Base64URL with no encryption — "decode" is one click. Never put passwords, keys, or data a user must not see into it; keep such data server-side and reference it by an identifier.' },
      { q: 'My token was rejected — what should I check first?', a: 'The exp claim first (this tool shows it; remember it is in seconds, not milliseconds), then that nothing mangled the token in transit — trailing whitespace, line breaks, or a proxy URL-decoding the Base64URL characters - and _ will all invalidate the signature.' },
    ],
    example: { label: 'Fill in a sample token', text: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IllRSCIsImlhdCI6MTUxNjIzOTAyMn0.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ' },
    relatedNotes: [
      {
        slug: 'jwt-decoder-guide',
        title: 'JWT Decoder Explained: How to Inspect and Debug JSON Web Tokens',
        description: 'Learn how a JSON Web Token is structured and how to decode one online to inspect its header, payload and registered claims when debugging authentication issues.',
        url: 'https://notes.digdevbox.com/posts/jwt-decoder-guide',
        tag: 'JWT',
      },
    ],
  },

  '/keycode-info': {
    intro: 'Press any key to see its keyCode, code, location and other details — useful when wiring up keyboard shortcuts.',
    steps: ['Focus the page', 'Press the key you want to inspect', 'Read the details shown below'],
    notes: ['keyCode is deprecated; prefer event.code or event.key in new code'],
    about: 'Press any key and see everything the browser tells you about the event: the legacy keyCode, the modern code (physical key), key (produced character), location and active modifiers. The fastest way to resolve "which value do I compare against" while wiring a keyboard shortcut or a game control scheme.',
    faqs: [
      { q: 'Is keyCode deprecated?', a: 'Yes — the spec marks it legacy and new code should use KeyboardEvent.code for physical keys or KeyboardEvent.key for characters. It is kept here because countless existing libraries and tutorials still compare against it.' },
      { q: 'What is the difference between key and code?', a: 'key is what the character produces and changes with layout and modifiers (Shift+1 gives "!"); code is the physical button regardless of layout (Digit1 in both cases). Shortcuts belong on code; text input belongs on key.' },
      { q: 'Why do some keys differ between platforms?', a: 'Physical layouts vary (ISO vs ANSI Enter, Mac Command vs Windows key) and location distinguishes left/right modifiers. Testing the real key on the target platform avoids surprises.' },
    ],
  },

  '/list-converter': {
    intro: 'Sorts, de-duplicates, adds prefixes/suffixes and reverses multi-line text in one go — a big time saver when tidying data.',
    steps: ['Paste the data, one item per line', 'Tick or select the operations you need', 'Copy the processed result'],
    example: { label: 'Fill in a sample list', text: 'banana\napple\ncherry\napple' },
    notes: [
      'No transpose and no truncation: the unit of work is the whole line.',
      'Duplicate removal runs before trimming, so "apple" and "apple " are still two different items.',
      'Sorting is applied after reversing — with both enabled the sorted order wins.',
    ],
    about: 'Clean up a list of items, one per line, without opening a spreadsheet: lowercase everything, drop duplicate lines, reverse the order, sort ascending or descending, trim whitespace off each item, wrap every item with a prefix and suffix (quotes, commas, markup), wrap the finished list once with its own prefix and suffix, choose what separates the values, and decide whether each item keeps its own line. Paste a column out of a spreadsheet, reshape it, paste it back — the text-level alternative to fighting with formulas.',
    faqs: [
      { q: 'How do I remove duplicate lines?', a: 'Tick remove duplicates. It runs before trimming, so "apple" and "apple " still count as two different lines. If your data carries stray spaces, expect near-duplicates to survive unless you clean them first.' },
      { q: 'Do blank lines stay in the output?', a: 'No. After trimming, empty items are dropped, so blank lines and lines that contained only whitespace disappear from the result.' },
      { q: 'What is the difference between the item prefix and the list prefix?', a: 'The item prefix goes in front of every value; the list prefix goes in front of the finished result once. To build a quoted array, use the item prefix for the quotes and comma, and the list prefix for the opening bracket.' },
      { q: 'I turned on reverse and sorting — why is the order still sorted?', a: 'Sorting is applied after reversing, so with both enabled the sort wins and the reverse has no visible effect. Pick one of the two.' },
      { q: 'Can I keep everything on one line?', a: 'Yes — turn off keep line breaks and the separator becomes the only thing between items, so the list collapses into a single line such as "a, b, c".' },
    ],
  },

  '/lorem-ipsum-generator': {
    intro: 'Generates placeholder text to fill out layouts and visual mockups.',
    steps: ['Choose paragraphs or a word count', 'Click generate', 'Copy the text'],
    about: 'Generate lorem ipsum placeholder paragraphs, sentences or words to fill a layout with realistic-looking text. Lorem ipsum has been the printing industry\'s dummy text since the 1500s because its letter distribution resembles natural language — the layout reads as "text" without anyone getting distracted by meaning.',
    faqs: [
      { q: 'What is lorem ipsum?', a: 'Lorem ipsum is the standard placeholder text used in publishing and web design since the 1500s: scrambled pseudo-Latin that fills a layout with realistic-looking words so the design can be judged without real copy distracting the reviewer.' },
      { q: 'Why not just use "text text text" as filler?', a: 'Uniform filler hides typography problems. Lorem ipsum has varied word lengths and rhythm, which exposes cramped spacing, bad measure and weak hierarchy exactly like real copy does.' },
      { q: 'Is lorem ipsum real Latin?', a: 'It derives from a scrambled passage of Cicero\'s "De Finibus Bonorum et Malorum" (circa 45 BC), truncated and garbled over centuries. It looks like Latin; it does not parse as Latin.' },
      { q: 'Should placeholder ship to production?', a: 'No. It is for design and layout review only. A surprising number of "lorem ipsum" screenshots in the wild started as an unfinished page that got deployed.' },
    ],
  },

  '/mac-address-generator': {
    intro: 'Generates MAC addresses in bulk for testing network gear or fabricating test data.',
    example: { label: 'Fill in quantity 10', text: '10' },
    steps: ['Enter how many you need', 'Add a prefix if required', 'Click generate and copy'],
    notes: [
      'The first octet is random unless you pin it, so the generated address may set the multicast or globally-unique bits — it is not forced to be locally-administered unicast.',
      'A prefix longer than six groups yields more than six octets; the tool does not trim to six.',
      'These are random values, not allocated addresses: they are safe as fixtures, but they are not reserved by any standard.',
    ],
    about: 'Generate random MAC addresses, optionally anchored to a prefix you supply. Type an OUI or the first few octets and the remaining bytes are filled with random values, then joined with your chosen separator and cased the way you want — handy for test fixtures, documentation examples, mock device inventories and UI state that needs a plausible-looking hardware address without reusing a real one. Prefix bytes are used exactly as written and left-padded to two hex digits, so “A” becomes 0A rather than A0.',
    faqs: [
      { q: 'What does the prefix option do?', a: 'The first three bytes (OUI) encode the manufacturer. Setting a prefix makes the generated addresses look like they belong to a given vendor — handy when your system parses or routes on OUI.' },
      { q: 'Are these safe to use in documentation?', a: 'Yes for examples and tests. Do not reuse them to spoof devices on networks you do not own — MAC filtering and logging exist for a reason.' },
      { q: 'Why upper versus lower case?', a: 'IEEE records use colon-separated lower case, while many Windows tools print upper case. The bytes are identical; pick the convention your target system expects to avoid string-comparison bugs.' },
      { q: 'Why does my prefix of A come back as 0A?', a: 'Because prefix bytes are left-padded to two hex digits, not right-padded: a lone “A” is read as the byte 0x0A. If you meant the address to start with A0, write the prefix as “A0”. The same rule applies to any odd-length prefix, which is why pasting a half-written OUI silently shifts every nibble.' },
      { q: 'Does the generator keep the address unicast?', a: 'No. Only the bytes you supply as a prefix are controlled; the rest are uniform random over 0-255, which means the least-significant bit of the first octet (multicast) and the second-least-significant bit (locally administered) are decided by chance. Pin the first octet if either property matters to you.' },
    ],
  },

  '/mac-address-lookup': {
    intro: 'Looks up the vendor behind a MAC address — useful for identifying unknown devices on a network.',
    steps: ['Enter the MAC address', 'Click look up', 'Read the vendor information'],
    notes: ['The first 24 bits identify the vendor and the last 24 can be rewritten, so this locates a vendor, not a device'],
    example: { label: 'Fill in a sample MAC', text: '00:1A:2B:3C:4D:5E' },
    about: 'Every network interface carries a MAC whose first three bytes identify its manufacturer. Enter an address and this tool resolves that OUI prefix to the vendor name using a bundled offline copy of the IEEE registry — the lookup runs entirely in your browser and works without a network connection.',
    faqs: [
      { q: 'Why is my vendor shown as unknown?', a: 'The address may use a locally administered format (the second hex digit is 2, 6, A or E) — those are assigned by software, not IEEE, so no vendor exists for them. Randomised MACs from phones also have no meaningful vendor.' },
      { q: 'Where does the vendor data come from?', a: 'From the IEEE OUI registry, bundled into the page as static data. Nothing is sent to a server, so the lookup also works offline.' },
      { q: 'Which part of the MAC is the vendor?', a: 'The first three bytes, e.g. 00:1A:2B in 00:1A:2B:3C:4D:5E. The remaining three bytes are the device-specific serial the vendor assigns.' },
    ],
  },

  '/markdown-to-html': {
    intro: 'Converts Markdown into HTML, for writing docs or generating page content.',
    steps: ['Write or paste Markdown on the left', 'The right side previews it live and shows the HTML', 'Copy the HTML, or click print to save it as a PDF'],
    example: { label: 'Fill in sample Markdown', text: '# Heading\n\nThis is a **bold** paragraph.\n\n- First item\n- Second item\n\n[Link](https://digdevbox.com)' },
    about: 'Convert Markdown to clean HTML in the browser, with a built-in print view for saving as PDF. Useful for turning notes, READMEs or release notes into a shareable page or a printable document without pasting content into an online converter you cannot audit.',
    faqs: [
      { q: 'Which Markdown flavour is supported?', a: 'The common core: headings, lists, tables, code blocks, links, images and emphasis. GitHub-flavoured extras like task lists generally render too; exotic extensions (footnotes, math) may not.' },
      { q: 'How does save-as-PDF work?', a: 'The tool renders your Markdown to HTML and opens the browser print dialog, where "Save as PDF" is a destination. Styling follows the print preview — page breaks land where the HTML puts them.' },
      { q: 'Is my content uploaded anywhere?', a: 'No — conversion happens in your browser. That is the practical reason to use a local converter for internal notes instead of pasting them into a random web service.' },
    ],
  },

  '/math-evaluator': {
    intro: 'Evaluates mathematical expressions with functions such as sqrt, sin, cos and abs — handier than a system calculator.',
    steps: ['Type the expression', 'The result updates live, or after you click evaluate', 'For long expressions, verifying the steps separately is worthwhile'],
    example: { label: 'Fill in a sample expression', text: 'sqrt(16) + 3 * (2 + 4)' },
    about: 'Evaluate mathematical expressions directly — arithmetic, parentheses, and functions like sqrt, cos, sin and abs. Faster than opening a spreadsheet for a one-off calculation, and it keeps the full expression visible so you can check the formula, not just the result.',
    faqs: [
      { q: 'Which functions can I use?', a: 'The common math set: sqrt, abs, trigonometric functions (sin, cos, tan), logarithms and more. Type the expression as you would write it — the standard precedence rules apply.' },
      { q: 'Why does 0.1 + 0.2 not equal exactly 0.3?', a: 'Floating-point arithmetic: binary cannot represent 0.1 exactly, so the result is 0.30000000000000004. It is a property of every IEEE 754 calculator, not a bug in this one.' },
      { q: 'Are angles in degrees or radians?', a: 'The trig functions follow the JavaScript convention and use radians — convert with deg * pi / 180 first if your data is in degrees.' },
    ],
  },

  '/mime-types': {
    intro: 'Looks up MIME types and file extensions from one another — useful when configuring a server or writing upload validation.',
    steps: ['Enter a MIME type or an extension', 'Read the corresponding form', 'Copy and use it'],
    about: 'Look up which MIME type matches a file extension and vice versa. Searchable in both directions, so you can resolve "what Content-Type do I send for .woff2" as easily as "which files does audio/mpeg cover". The mapping matters every time you configure a web server, write an upload handler or debug a file that downloads instead of rendering.',
    faqs: [
      { q: 'Why does one extension map to several MIME types?', a: 'Formats accumulate aliases over time (.mp3 maps to audio/mpeg while older stacks expect audio/mp3). Servers expect the canonical one; this tool shows the common mappings so you can pick what your stack accepts.' },
      { q: 'What happens if I send the wrong Content-Type?', a: 'Browsers may refuse to execute scripts (strict MIME checking), render text as plain text, or trigger a download. API clients also pick their parser from the Content-Type, so wrong types cause silent parse failures.' },
      { q: 'What is the difference between text/plain and application/octet-stream?', a: 'text/plain tells the client the bytes are human-readable text; octet-stream means "opaque binary, save it". Sending octet-stream for something renderable is the classic cause of forced downloads.' },
    ],
  },

  '/numeronym-generator': {
    intro: 'Builds numeronyms such as i18n and k8s — first letter, letter count, last letter.',
    steps: ['Enter a long word', 'Get its numeronym', 'Copy and use it'],
    example: { label: 'Fill in a sample word', text: 'internationalization' },
    about: 'A numeronym is an abbreviation formed by replacing the middle letters of a word with their count, keeping the first and last letter: internationalization becomes i18n (18 letters between the i and the n), kubernetes becomes k8s, accessibility becomes a11y. Engineers adopted numeronyms for words that get typed and read constantly — they are shorter to write, unambiguous in context, and have become standard vocabulary in their fields. Well-known numeronyms include i18n and l10n (internationalization / localization, the classic pair), a11y (accessibility), k8s (Kubernetes), n7m (numeronym itself), c11s and g11n (compliance / globalization). This tool encodes any word into its numeronym form and decodes the established ones back to their full words, so you can check what a term means before using it in a doc, commit message, or issue thread.',
    faqs: [
      { q: 'What is a numeronym?', a: 'A numeronym is an abbreviation where the letters between the first and last letter of a word are replaced by their count — internationalization → i18n, kubernetes → k8s, accessibility → a11y. The count is the number of omitted middle letters.' },
      { q: 'How is i18n formed?', a: 'First letter + count of the letters in between + last letter: "internationalization" has 18 letters between the leading i and the trailing n. The rule works for any long word.' },
      { q: 'Which numeronyms should I use at work?', a: 'The established ones travel well: i18n, l10n, a11y, k8s, n7m. Inventing new ones for one-off words forces every reader to decode them — use numeronyms for frequency, not for style.' },
      { q: 'Why does accessibility use a11y?', a: 'Same rule — "accessibility" has 11 letters between the a and the y. The tag stuck because it sits nicely next to i18n in engineering discussions about inclusive products.' },
      { q: 'What do k8s and l10n stand for?', a: 'k8s is Kubernetes (8 letters between k and s), the abbreviation so common it appears in the project logo itself. l10n is localization (10 letters between l and n), usually paired with i18n in software that ships in multiple languages.' },
    ],
  },

  '/og-meta-generator': {
    intro: 'Generates Open Graph and social-platform meta tags for share cards.',
    steps: ['Enter the title, description, image URL and link', 'Click generate', 'Paste the resulting meta tags into your page head'],
    notes: ['Platforms cache share cards, so you may need their debug tool to refresh the cache after a change'],
    example: { label: 'Fill in a sample site title', text: 'My Awesome Site' },
    about: 'Fill in a page title, description, URL and image, and get ready-to-paste Open Graph and Twitter meta tags. Social platforms read these tags to build share cards, so the difference between a bare link and an inviting preview is usually just this handful of meta tags in your page head.',
    faqs: [
      { q: 'What is the minimum set of OG tags?', a: 'og:title, og:description, og:image and og:url cover every major platform. The Twitter tags (twitter:card in particular) refine how the card looks on X.' },
      { q: 'Why does my share card still show old text?', a: 'Platforms cache card data aggressively. After changing tags you usually need the platform\'s debugger (e.g. the Facebook Sharing Debugger or X Card Validator) to force a re-scrape.' },
      { q: 'What image size should og:image be?', a: 'Around 1200×630 pixels is the widely supported sweet spot. Keep text large and centred — cards are often cropped or shown small on mobile.' },
    ],
  },

  '/otp-generator': {
    intro: 'Generates and verifies time-based one-time passwords (TOTP) for two-factor authentication setups.',
    steps: ['Enter the secret (Base32)', 'Click generate to get the current code', 'To verify, enter the code the other party provided and compare'],
    notes: ['TOTP depends on the device clock — too large a time difference makes codes fail to match indefinitely'],
    example: { label: 'Paste a sample Base32 secret', text: 'JBSWY3DPEHPK3PXP' },
    about: 'Generate and validate time-based one-time passwords (TOTP) from a base32 secret — the same mechanism behind Google Authenticator-style codes. Useful for testing your own MFA implementation, decoding a setup key before scanning it into an app, or verifying that a code is currently valid.',
    faqs: [
      { q: 'How does the 6-digit code get calculated?', a: 'The secret plus the current time (in 30-second steps) go through HMAC, and a slice of the result becomes the code. Same secret + same time window = same code, which is why phone and server agree.' },
      { q: 'Why did my code stop matching?', a: 'Clock drift. TOTP depends on the device clock — too large a difference from the server makes codes fail indefinitely. Re-sync the device time or re-enrol the secret.' },
      { q: 'Is the base32 secret sensitive?', a: 'Completely — anyone holding it can generate your codes forever. Store it like a password, and enrol it in an authenticator app rather than pasting it around.' },
    ],
  },

  '/password-strength-analyser': {
    intro: 'Estimates password strength and approximate cracking time, to judge whether a password is good enough.',
    steps: ['Enter the password to evaluate', 'Read the strength bar and estimated cracking time', 'Lengthen it or add character classes as suggested'],
    notes: ['The calculation runs entirely in your browser; the password is never sent anywhere'],
    about: 'Analyse a password\'s strength entirely in your browser — entropy, common-pattern checks and a crack-time estimate. Nothing is submitted anywhere, so it is safe to probe the passwords you actually use; the point is to see which weaknesses (length? reuse? predictable structure?) dominate your risk.',
    faqs: [
      { q: 'How is "time to crack" estimated?', a: 'It models an attacker guessing at some rate (billions per second for offline attacks on a stolen hash). The estimate is orders-of-magnitude, not a prophecy — relative comparisons between passwords are what matter.' },
      { q: 'Is a complex short password better than a long simple one?', a: 'Usually not. Length dominates: a four-word passphrase outruns a 9-character symbol soup because entropy grows with every added character of vocabulary, not only with symbol variety.' },
      { q: 'Does the tool store or transmit my password?', a: 'No — the analysis runs client-side and the input never leaves the page. Still, measuring a password on any shared machine carries some risk; prefer your own device.' },
    ],
  },

  '/image-crop': {
    intro: 'Drag a selection over an image and crop it to that exact region, exporting at the source resolution rather than a scaled-down copy of what you saw on screen.',
    steps: ['Pick an image', 'Drag inside the box to move it, or drag a corner to resize; optionally lock a ratio', 'Choose the format and crop'],
    notes: [
      'The crop is taken from the original pixels, not from the on-screen preview — a 640px-wide preview of a 4000px photo still crops at full resolution.',
      'The selection is always clamped inside the image, so you cannot accidentally crop a region that does not exist.',
      'Available output formats are probed from the browser at runtime; formats a browser cannot genuinely encode are not offered.',
    ],
    about: 'Crop a photo to the region you actually want, in the browser, and get back a file whose dimensions are the crop\'s dimensions in the original image. That last part is the difference between this and a naive cropper: the box you drag lives in image coordinates, and the export calls drawImage with a source rectangle on the untouched bitmap, so shrinking the preview to fit your window never shrinks the result. Lock a ratio when the destination demands one — 1:1 for avatars, 4:3 or 3:2 for print crops, 16:9 for social embeds — and the box keeps its proportions while you drag. Re-encoding is unavoidable when you export to JPEG or WebP, so quality is exposed as a slider; PNG export stays lossless and keeps transparency.',
    faqs: [
      { q: 'Does cropping reduce image quality?', a: 'The crop itself does not: it selects a rectangle of existing pixels. Quality loss only enters at export, and only for lossy formats. Choose PNG if the crop must stay pixel-exact, and JPEG or WebP when file size matters more.' },
      { q: 'Why is the exported file smaller than the image I see?', a: 'Because the export is the size of your selection, not of the whole image. The readout next to the box shows the exact output dimensions before you commit.' },
      { q: 'Can I crop to an exact size like 800×600?', a: 'Crop to the region you want and check the reported selection size, then fine-tune. The preview is scaled to fit the window, so the numbers shown are always the real image pixels, not the on-screen size.' },
      { q: 'Does it keep transparency?', a: 'Yes when you export to PNG or WebP. Exporting to JPEG flattens transparency onto an opaque background, because JPEG has no alpha channel at all.' },
      { q: 'Why can I not pick my phone photo?', a: 'If the browser cannot decode the file, nothing can be drawn from it. HEIC from iPhone and most TIFF files fall into that category — convert those first, or use a tool that ships a dedicated decoder.' },
    ],
  },

  '/image-color-picker': {
    intro: 'Click any pixel in an image and read back its exact colour as HEX, RGB and HSL, sampled from the original file rather than from a screenshot of the page.',
    steps: ['Pick an image', 'Click the pixel you want (the cursor readout shows the coordinate)', 'Copy the HEX value, or read the RGB and HSL forms'],
    notes: [
      'The sample is a 1×1 read of the original bitmap, so display scaling never changes the answer.',
      'Alpha is not reported: a fully transparent PNG pixel returns whatever RGB the file happens to store there, which is often black.',
      'The image is decoded by the browser, so formats the browser cannot read cannot be sampled.',
    ],
    about: 'Find out what colour a pixel in a picture actually is. You click, the tool reads that single pixel out of the decoded original and reports it three ways — HEX for CSS, RGB for design tools, HSL when you are reasoning about the colour as hue and lightness. Because the sample comes from the source bitmap and not from a screenshot of the page, the result is unaffected by how large or small the image happens to be displayed, and it is not contaminated by browser colour management on screen capture. This is the version of an eyedropper that answers a factual question about a file: what is the brand colour in this logo screenshot, what background does this texture use, which hex is that gradient endpoint. Everything happens locally — the image is never uploaded, which matters when the picture is a design mockup that has not shipped.',
    faqs: [
      { q: 'Why does the colour I pick look different from what I see?', a: 'You are seeing the pixel through your display profile, gamma and any CSS filters on the page; the tool reports the file\'s stored value. For a single image on a plain page those agree closely, but a colour-managed viewer can shift them.' },
      { q: 'Why is a transparent area reported as black?', a: 'PNG stores red, green and blue even where alpha is zero, and this tool reads those channels without compositing. A transparent pixel therefore often reports 0,0,0. Composite it over a background first if you need the visible colour.' },
      { q: 'Can I get the colour at an exact coordinate?', a: 'The coordinate readout shows where you clicked in image pixels, so you can aim deliberately. Very fine targets are easier when you zoom the browser, since the click still maps back to the original pixel grid.' },
      { q: 'Does it work on photos with compression artefacts?', a: 'Yes, but neighbouring pixels differ: JPEG ringing means a 1×1 sample on a noisy edge is only one sample. Pick a flat area, or average a region if you need a representative colour.' },
      { q: 'Is my image uploaded anywhere?', a: 'No. The file is decoded in your browser and sampled from the resulting bitmap; there is no network request in this tool.' },
    ],
  },

  '/favicon-generator': {
    intro: 'Turn one square-ish image into a real favicon.ico with 16, 32 and 48px sizes inside it, plus an apple-touch-icon and a 512px PNG, all resized in your browser.',
    steps: ['Pick an image', 'Choose whether to keep transparency or fill white', 'Generate, then download the .ico and PNGs and paste the HTML snippet'],
    notes: [
      'A non-square source is centre-cropped to a square before resizing, so it is never stretched into a distorted icon.',
      'Sizes above 128px are exported as separate PNGs rather than packed into the .ico, because the ICO width field is a single byte.',
      'The .ico embeds PNG payloads (the Vista-and-later form), which every current browser accepts.',
    ],
    about: 'One picture in, a working icon set out. The tool centre-crops your image to a square, resamples it down to 16, 32 and 48 pixels, and packs all three into a single favicon.ico using the PNG-in-ICO container that modern browsers expect — so a browser picks the size that fits instead of scaling one bitmap and going blurry. It also emits a 180px apple-touch-icon for iOS home screens and a 512px PNG for Android shortcuts and PWA manifests, plus the three lines of HTML that wire them up. Everything is done with the browser\'s own image pipeline and a hand-written ICO header, so nothing is uploaded and there is no server queue: useful exactly when the icon belongs to a project that is not public yet. Resampling uses high-quality smoothing, which is the difference between a legible 16px favicon and a smear.',
    faqs: [
      { q: 'Why does my 16px favicon look blurry?', a: 'Usually because a large icon was scaled to 16px in the browser rather than being supplied at 16px. This tool writes real 16, 32 and 48px bitmaps into the .ico so the browser does not have to guess. Very detailed artwork will still suffer at 16px — simplify the source if it does.' },
      { q: 'Why is 512px not inside the .ico?', a: 'The ICO width field is one byte, so 256 has to be encoded as zero and anything larger does not fit the format at all. The safe, standard route is to ship 512px as a separate PNG and reference it from the manifest.' },
      { q: 'Do I still need apple-touch-icon?', a: 'Yes if iOS users may add your site to a home screen — that icon is picked up separately from favicon.ico and 180px is the size it wants. It is a PNG, not part of the .ico.' },
      { q: 'Should my source be square?', a: 'It should be roughly square. A non-square source is centre-cropped here, which protects you from distortion but will cut off whatever sits near the edges. Keep the mark centred with breathing room.' },
      { q: 'Which HTML do I actually need?', a: 'The snippet shown covers the common case: favicon.ico for tabs and bookmarks, apple-touch-icon for iOS, and the 512px PNG for Android and PWA install prompts. Add a manifest file if you are building an installable app.' },
    ],
  },

  '/image-to-pdf': {
    intro: 'Put one or more images into a single PDF, each on its own page sized to that image, with JPEG carried over unchanged and PNG kept lossless.',
    steps: ['Pick one or more images', 'Set a page margin if you want white space around the picture', 'Create the PDF and download it'],
    notes: [
      'A JPEG goes into the document as its own compressed stream, byte for byte — no second generation of compression.',
      'A PNG loses no pixels either, but it is re-wrapped in the PDF image encoding, so its share of the output size can differ from the source. WebP, BMP and GIF are converted to PNG in the browser first, which is lossless and often larger.',
      'Each page takes the pixel dimensions of its image, so a portrait photo and a landscape screenshot end up on differently sized pages.',
    ],
    about: 'Combine photos, scans and screenshots into one PDF without a server seeing them. The design choice that matters is what happens to quality: a JPEG is carried into the document unchanged, so a 3MB scan does not come out as a 3MB file with fresh compression artefacts laid on top. A PNG is not lossy-recompressed either — it is decoded and stored in the PDF\'s own lossless image encoding, which costs nothing in quality but can change how many bytes it ends up as. Page geometry follows the image — a page is the image\'s pixel size, one point per pixel — which is what you want for scans and screenshots, and an optional margin adds white space when the document is going to be printed. The whole thing is a single in-browser operation, so a folder of receipts or a batch of whiteboard photos never leaves the machine; the resulting PDF is assembled locally and handed to you as a download.',
    faqs: [
      { q: 'Are my images compressed?', a: 'A JPEG is not touched: its compressed bytes are embedded as they are, so output quality equals input quality exactly. A PNG loses nothing either, it is merely stored in a different lossless encoding. Only images that need a format change (WebP, BMP, GIF) go through a re-encode, and that step is lossless.' },
      { q: 'Why is my PDF much bigger than I expected?', a: 'Because the PDF contains the full-resolution originals rather than thumbnails. That is deliberate — it is what preserves quality — but if you need a small file, resize or compress the images first and then combine them.' },
      { q: 'Can I make every page the same size, like A4?', a: 'Not in this tool: pages follow each image\'s own dimensions so nothing is stretched or letterboxed. If you need uniform pages, place the images into a document editor and export, or use a print-to-PDF step.' },
      { q: 'Does the order of images matter?', a: 'Yes — pages appear in the order the files were selected. Check the list shown after picking to confirm the sequence before generating.' },
      { q: 'Is a scanned document still searchable?', a: 'No. This produces a PDF whose pages are pictures; there is no text layer, so search and copy will not find words. Optical character recognition is a separate step.' },
    ],
  },

  '/image-resize': {
    intro: 'Resize an image to exact pixel dimensions in the browser, with step-down scaling that keeps detail instead of smearing it.',
    steps: ['Pick an image', 'Enter the target width and height (or keep the aspect ratio locked)', 'Choose the output format and download the result'],
    notes: [
      'Downscaling is done by repeated halving rather than one big jump — a single canvas scale throws away pixels and leaves aliasing.',
      'Enlarging beyond the original resolution cannot add detail; the result will be softer, not sharper.',
      'Only formats the browser can genuinely encode are offered — see the question about formats below.',
    ],
    about: 'Resize an image to the exact width and height you need, entirely in your browser — the file never leaves your machine. The important part is how the shrinking is done: a canvas will happily scale 4000×3000 straight down to 400×300 in one step, and the browser\'s bilinear sampling simply discards most of the pixels, which shows up as jagged edges and moire on patterns and text. This tool instead halves the image repeatedly until it is within two steps of the target, then does the final adjustment, which is the closest thing to a proper resampling filter you can get without a native library. Output is PNG (lossless), or JPEG/WebP where you control the quality. Formats are offered only if the browser actually encodes them: the spec says an unsupported type should make toBlob return null, but Chrome, Safari and Firefox quietly return a PNG instead, so the option list is probed at runtime rather than assumed.',
    faqs: [
      { q: 'Why is my resized photo sharper than one from another resizer?', a: 'Because shrinking happens in repeated halving steps instead of one jump. A single large downscale makes the browser sample too sparsely and drop detail; halving keeps each step close to 2:1 so information is averaged rather than skipped.' },
      { q: 'Can I make a small image bigger without losing quality?', a: 'No tool can invent detail that was never captured. Enlarging here resamples the existing pixels, so the result is larger but no sharper — expect it to look softer. The exception is pixel art, where nearest-neighbour style scaling keeps hard edges.' },
      { q: 'Which output formats are available?', a: 'PNG always, plus JPEG and WebP when your browser genuinely encodes them. Formats the browser cannot really produce are not listed at all, rather than being listed and silently producing a different file type.' },
      { q: 'Why should I resize locally instead of using an online converter?', a: 'Because an ID card, a contract scan or a private photo does not need a second home on someone\'s server. Nothing is uploaded here, so there is no retention policy to trust and no breach to worry about.' },
      { q: 'What are the size limits?', a: 'The practical ceiling is your device memory, not a server quota. Very large images (roughly beyond 8000 pixels on a side as capped in the fields) can fail in the browser, and the tool reports the failure instead of returning a truncated file.' },
    ],
  },

  '/image-compress': {
    intro: 'Compress a JPEG or WebP image to a quality level you set, or straight down to a target file size, without uploading it anywhere.',
    steps: ['Pick an image', 'Choose JPEG or WebP and either a quality level or a target size in KB', 'Compress, compare the before and after numbers, and download'],
    notes: [
      'This is lossy re-encoding: each pass discards data. Start from the original file rather than re-compressing an already-compressed one.',
      'PNG output is not offered here because lossless re-encoding rarely shrinks a photo — use the resizer or convert to JPEG/WebP instead.',
      'A target size that cannot be reached is reported as a failure rather than quietly returning a file that ignores your limit.',
    ],
    about: 'Shrink a photo to the size you actually need — either by picking a quality level, or by naming a target file size and letting the tool search for the quality that gets there. Everything runs on your own machine: the image is decoded, re-encoded and handed back without a network request, which matters exactly when the file is the thing you least want copied — documents, receipts, photos of a whiteboard, anything with a face in it. Under the hood it is the browser\'s own JPEG and WebP encoders driven by a quality search: for a target size, the tool bisects the quality range (up to seven attempts) and keeps the highest quality that still fits. That is the same shape of algorithm a desktop "save for web" dialog uses, minus the upload. Expect the honest limits of lossy compression: text and sharp edges start to look noisy before a photograph does, and re-compressing an already-compressed JPEG compounds the damage.',
    faqs: [
      { q: 'How much smaller can I make it?', a: 'Photos typically drop to a fraction of their original size at quality 70-80 with little visible change, and further if you accept softer edges. The tool shows before and after numbers so you can judge the trade instead of guessing.' },
      { q: 'Why is my PNG not getting smaller?', a: 'PNG is lossless, so re-encoding a photo as PNG cannot throw information away — it usually grows. For photographs, convert to JPEG or WebP. PNG is the right choice for flat-colour graphics, screenshots of text and anything needing transparency.' },
      { q: 'Does the target-size mode always hit my number?', a: 'It returns the highest quality that fits the limit, or fails visibly when even the lowest quality is too large — which usually means the image itself needs resizing first. It will not hand you an oversized file with a reassuring label.' },
      { q: 'Will compressing damage my image?', a: 'Yes, lossy compression discards data permanently. Keep the original, and avoid re-compressing a file that was already a JPEG — each pass adds its own artefacts on top of the last.' },
      { q: 'Is it safe for documents with personal information?', a: 'For this tool, yes in the sense that nothing is uploaded: the file is read and rewritten locally by your browser. What you should still not do is paste a sensitive file into an unknown online converter that sends it to a server and tells you to trust its retention policy.' },
    ],
  },

  '/pdf-merge': {
    intro: 'Combines multiple PDF files into one document, preserving upload order.',
    steps: ['Select two or more PDF files', 'Click merge', 'Download the combined PDF'],
    notes: ['The output page order is exactly the order you added the files — drag to reorder before merging if needed'],
    about: 'PDF merge concatenates documents: every page of the first file, then every page of the second, and so on. Because the merge happens by copying the original page objects (not re-rendering), text stays selectable, fonts stay embedded, and page dimensions keep their original sizes — a landscape A3 page stays landscape A3 next to a portrait A4. Typical uses: assembling scanned receipts into one expense file, combining report chapters written separately, or attaching a cover letter to a CV.',
    faqs: [
      { q: 'Does merging change the page quality?', a: 'No. Pages are copied as objects, not re-rendered or re-encoded — text, fonts and images are carried over byte-for-byte into the merged file.' },
      { q: 'Is there a file size or count limit?', a: 'The browser is the only limit: it needs to hold all input files and the output in memory at once. Dozens of typical documents merge fine; hundreds of multi-hundred-megabyte scans may exhaust the tab.' },
      { q: 'Are my PDFs uploaded anywhere?', a: 'No. Parsing and merging run entirely in your browser — nothing leaves the page, which matters when the documents are contracts or scans of IDs.' },
    ],
  },

  '/pdf-split': {
    intro: 'Splits a PDF into single pages, or extracts a page range into a new document.',
    steps: ['Select a PDF file', 'Pick a mode — one file per page, or a page range', 'Download the results'],
    notes: ['Page count is read from the file before you choose a mode, so the range inputs can never go out of bounds'],
    about: 'PDF split has two common shapes. Split-to-pages turns an N-page document into N single-page PDFs — useful when only one page of a report needs to go to a client, or when a scanner produced a batch that must be filed separately. Extract-range keeps pages X to Y as one new document — the shape for "give me chapter 2" or trimming a signed contract to the pages that matter. Both copy original page objects, so quality is unchanged.',
    faqs: [
      { q: 'Why is each split page larger than the original divided by pages?', a: 'Every output file carries its own copy of shared resources (fonts, images on that page) plus a fresh document structure. The per-file overhead is small but real — splitting a 1 MB 50-page scan into 50 files yields slightly more than 1 MB total.' },
      { q: 'Can I split an encrypted PDF?', a: 'Files with an owner password (restrictions on copy or print) load with restrictions ignored. Files requiring a user password to open cannot be processed — the browser never sees the decrypted content.' },
      { q: 'How do I reassemble pages in a different order?', a: 'Split to single pages first, then feed the pages into the merge tool in the order you want — the two tools are designed to be used together this way.' },
    ],
  },

  '/pdf-watermark': {
    intro: 'Adds a text watermark to every page of a PDF, with adjustable size, opacity, angle and layout.',
    steps: ['Select a PDF file', 'Type the watermark text and tune the style', 'Apply and download the result'],
    notes: ['The source file is never modified — a new PDF is generated with the watermark layer on top'],
    about: 'A watermark is a semi-transparent text layer stamped over the page content, typically used to mark documents as DRAFT, CONFIDENTIAL, or to credit the recipient ("Prepared for ACME Corp") before distribution. Single-line mode draws one centered rotated line per page — the classic look. Tile mode repeats the text in a grid across the whole page, which survives cropping and partial screenshots better. The watermark is drawn above existing content, so it is visible on top of images and text but, at low opacity, does not prevent reading.',
    faqs: [
      { q: 'Can the watermark be removed?', a: 'A text watermark drawn this way is a page annotation like any other content — a determined user with a PDF editor can remove it. It deters casual reuse; it is not DRM.' },
      { q: 'What opacity should I use?', a: 'The default 0.18 is readable on white without hiding content. For photo-heavy pages, 0.25-0.35 with tile mode keeps the mark visible; above 0.5 the underlying text becomes hard to read.' },
      { q: 'Does the watermark work on rotated pages?', a: 'The text is placed in page coordinate space, so on a page stored in landscape rotation the watermark follows the page itself — it may appear rotated relative to the viewer. Verify on one page before batch-marking a mixed-orientation document.' },
    ],
  },

  '/pdf-compress': {
    intro: 'Shrinks a PDF by recompressing its embedded photos and rebuilding the file structure, with before/after sizes and a never-larger guarantee.',
    steps: ['Select a PDF file', 'Pick balanced or strong compression', 'Run it and compare the sizes', 'Download the result'],
    notes: ['If nothing can be saved the original file is returned unchanged — the output is never larger than the input', 'Text-only PDFs are already compact; the savings come from photos', 'Files stay on your device — nothing is uploaded'],
    about: 'There are two levers behind every PDF size. The image layer: scans, camera shots and inserted photos are usually stored as full-resolution JPEGs, so the tool decodes each one and re-encodes it at lower quality (and, on strong mode, a lower pixel cap). The structural layer: PDFs that went through several edit-save cycles, printer drivers or email forwards accumulate orphaned objects and bloated cross-reference tables — rebuilding the file drops that overhead. What the tool deliberately does not touch: the text and vector layer stays untouched, so letters remain selectable and sharp at any zoom, and lossless screenshots keep their quality. That is also why a text-heavy PDF may shrink only a little — there was simply little fat to cut, and in that case you get your original file back.',
    faqs: [
      { q: 'Why did my PDF barely shrink?', a: 'Text and vector drawings are already extremely compact — one page of an article can be a few KB. Size accumulates in images, so a PDF without photos has almost nothing to squeeze. If you are fighting an upload or mailbox limit, splitting the document by page ranges is the alternative.' },
      { q: 'Will compression make my document look bad?', a: 'Balanced mode keeps images at screen quality and is fine for everyday documents. Strong mode softens photos noticeably at around 1200px — good for scans and receipts, not for print-ready work. Text never degrades, because it is not re-rendered.' },
      { q: 'Is it safe for confidential PDFs?', a: 'Yes. The whole pipeline runs inside your browser; the file never leaves the device and there is no upload step that could be intercepted.' },
    ],
  },

  '/pdf-signature-checker': {
    intro: 'Checks whether a PDF carries a digital signature and whether that signature is valid.',
    steps: ['Choose or drag in a PDF file', 'Wait for it to be parsed', 'Read the number of signatures and the verification result'],
    notes: ['Having a signature only means a signature field exists — trustworthiness also depends on the certificate chain'],
    about: 'Verify the digital signatures inside a PDF file: who signed it and whether the content has been altered since signing. The file is processed locally, so confidential contracts can be checked without uploading them to a third party — useful when a counterparty\'s PDF arrives and you need to trust it before acting.',
    faqs: [
      { q: 'What does a valid signature actually prove?', a: 'Two things: the document bytes have not changed since signing, and the certificate chain ties the signature to an identity (a person or organisation) at signing time. It does not judge whether the signer was trustworthy.' },
      { q: 'The document opens fine — why is the signature invalid?', a: 'Any edit after signing breaks the byte-range digest, including saving with "print to PDF", annotating, or a converter that rewrites the file. A clean-looking page does not mean untouched bytes.' },
      { q: 'Where can I get a signed PDF to test with?', a: 'Many tax authorities, banks and certification bodies publish sample signed documents. Signing one yourself requires a certificate — the checker is happy with either as input.' },
    ],
  },

  '/percentage-calculator': {
    intro: 'Computes percentages between two numbers, percentage increases or decreases, or works backwards from a percentage.',
    example: { label: 'Fill in 42 (%)', text: '42' },
    steps: ['Pick the mode matching your question', 'Enter the known values', 'Read the result'],
    about: 'The percentage maths that always needs a second of thought, made explicit: X is what percent of Y, what is P percent of Y, and percentage increase or decrease between two values. Fill the two knowns, read the third — no more re-deriving the formula in your head at the checkout.',
    faqs: [
      { q: 'Why does the result need both fields filled?', a: 'Every percentage question involves two known numbers and one unknown; a single input cannot determine anything. Enter both values for your chosen question type and the answer computes immediately.' },
      { q: 'How do I compute a percentage change (not just a share)?', a: 'Use the increase/decrease mode: (new - old) / old × 100. Going from 80 to 100 is +25%; going back from 100 to 80 is -20% — the asymmetry is real and trips up many reports.' },
      { q: 'What is the difference between percentage and percentage points?', a: 'A percentage is a share of a base; percentage points are the arithmetic difference between two shares. Interest moving from 3% to 4% rose one point, but 33% relative.' },
      { q: 'How do I multiply a percentage by a number, like 0.05 × 2500?', a: 'A percent is just a decimal: 0.05 × 2500 = 12.5, the same as 5% of 2500. To use the calculator, enter 5 (%) and 2500 (value) in "what is P percent of Y" mode — the result, 125, is 5% of 2500.' },
    ],
  },

  '/phone-parser-and-formatter': {
    intro: 'Parses a phone number, identifying the country code, area code and number type, and formats it to a standard form.',
    steps: ['Enter the phone number (including the country code improves accuracy)', 'Read the parsed details', 'Copy the formatted number'],
    notes: ['A number without a country code can only be parsed against a default region and is easily misidentified'],
    example: { label: 'Fill in a sample number', text: '+86 138 0013 8000' },
    about: 'Parse a phone number into its structured form and reformat it between national, international and E.164 notation. The engine is libphonenumber (the same library behind Android\'s number handling), so you get country code, number type and validity based on real numbering plans rather than a regex guess.',
    faqs: [
      { q: 'What is E.164 and why does everyone ask for it?', a: 'It is the unambiguous international format — plus sign, country code, subscriber number, no spaces (e.g. +442071838750). APIs and databases prefer it because the same number has many human spellings but exactly one E.164 form.' },
      { q: 'Why does the result change when I add a country code?', a: 'Without one, the parser must assume a default country for local notation; with one, the number is interpreted globally. Ambiguous short numbers can legitimately parse differently — always pass the country you mean.' },
      { q: 'What does the "type" field mean?', a: 'It classifies the number as mobile, fixed line, toll-free, premium rate and so on, based on the country\'s numbering plan. Useful for filtering out fax lines or blocking premium numbers before dialling.' },
    ],
  },

  '/qrcode-generator': {
    intro: 'Turns text or a link into a QR code, with customisable colours and size, ready to download.',
    steps: ['Enter what to encode (a URL or any text)', 'Adjust the foreground colour, background colour and size as needed', 'Click download to save the image'],
    notes: ['Longer content makes a denser code; if it will not scan, shorten the content or increase the size'],
    example: { label: 'Fill in a sample link', text: 'https://digdevbox.com' },
    about: 'Generate a QR code for any URL or plain text, tune the foreground and background colours, and download the result as a PNG. Everything is rendered in your browser — the encoded content never leaves the page — so it is safe for internal links and credentials-shaped test data alike.',
    faqs: [
      { q: 'Can I change the colours?', a: 'Yes. Keep strong contrast between foreground and background — scanners rely on it. Dark-on-light is the safest combination; inverting the usual colours works only if contrast stays high.' },
      { q: 'What actually goes inside a QR code?', a: 'Exactly the text you type — nothing more. A URL QR code simply stores the URL; scanning apps just open or show it.' },
      { q: 'How do I print it reliably?', a: 'Prefer a quiet margin around the code, high contrast, and a physical size large enough for the scanning distance. Test the printed version with at least two different phones before mass printing.' },
    ],
  },

  '/random-port-generator': {
    intro: 'Generates a random port number above 1024, for starting local services or writing tests.',
    steps: ['Click generate to get a port', 'Copy and use it', 'Generate again if you need several'],
    notes: [
      'The range is 1024-65535 inclusive, so 1024 and 65535 can both come back.',
      'It does not check availability: a random port is unlikely to be in use, but “unlikely” is not “free” — bind and handle the error, or use port 0 to let the OS choose.',
      'Registered service ports above 1024 (3306 MySQL, 5432 PostgreSQL, 6379 Redis, and so on) are inside the range and can be returned.',
    ],
    about: 'Pick a random TCP/UDP port number in the range 1024 to 65535, inclusive — the unprivileged space, deliberately excluding the well-known 0-1023 range that on Unix-like systems requires root to bind. Useful when a local dev server, a test harness, a proxy config or a demo needs a port that will not collide with SSH, HTTP or DNS, and when you want a number you can paste rather than one you have to invent. Refresh for a new value; nothing is checked against your machine, because the tool cannot see it.',
    faqs: [
      { q: 'Why exclude ports 0–1023?', a: 'The well-known range is reserved for system services (SSH 22, HTTP 80…) and binding to it usually requires administrator rights. Random picks there would mostly fail or shadow real services.' },
      { q: 'Does a random port guarantee it is free?', a: 'No — nothing else on your machine claimed it at generation time, but you should still check with netstat or your runtime before binding. The tool gives you a sane candidate, not a reservation.' },
      { q: 'Which range do the numbers come from?', a: 'The registered/ephemeral range above 1023 (up to 65535). For services exposed to others, the conventional registered range is 1024–49151.' },
      { q: 'Should I just bind port 0 instead?', a: 'When the port genuinely has to be available, yes: binding port 0 asks the kernel to allocate an unused one and you read the number back from the socket. Use this generator when you want a plausible, stable-looking number to paste into a config file or a screenshot, and port 0 when correctness at bind time is what matters.' },
      { q: 'Why is my database port a possible answer?', a: 'Because 1024-65535 contains both ephemeral/client space and the registered service ports that modern databases live on. If you need a port that will not be mistaken for a service, narrow the search yourself (for example 20000-29999) and re-roll until it lands where you want.' },
    ],
  },

  '/regex-memo': {
    intro: 'A cheat sheet of common regular expressions for when you have forgotten the syntax.',
    steps: ['Find the syntax you need by category', 'Copy the fragment', 'Verify it in the Regex Tester'],
    about: 'Regex syntax is easy to forget precisely because it is dense: character classes, quantifiers, anchors and groups are all written in punctuation. This cheat sheet collects the constructs you actually reach for — ready-made patterns for emails, URLs and dates, the common character classes, and lookahead examples — so you copy a working starting point instead of rebuilding it from memory.',
    faqs: [
      { q: 'Are these patterns production-ready?', a: 'They are solid starting points for common cases. The classic example: fully RFC-compliant email validation is practically impossible in pure regex — the patterns here cover the pragmatic 99%, not the adversarial 1%.' },
      { q: 'Will these patterns work in every language?', a: 'The core syntax (classes, quantifiers, groups, anchors) is nearly universal. Advanced features like lookbehind or named groups vary by engine — verify JavaScript behavior in the Regex Tester.' },
      { q: 'How do I adapt a pattern to my case?', a: 'Copy it into the Regex Tester, paste a sample of your real text, then tighten the pattern until only the parts you want are highlighted.' },
    ],
    relatedNotes: [
      {
        slug: 'regex-testing-guide',
        title: 'Regex Testing Guide: How Developers Debug Regular Expressions',
        description: 'A practical workflow for testing and debugging regular expressions online — live matches, flags, capture groups and a cheat sheet for the syntax you forget.',
        url: 'https://notes.digdevbox.com/posts/regex-testing-guide',
        tag: 'Regex',
      },
    ],
  },

  '/regex-tester': {
    intro: 'Tests regular expression matches live, so you can verify as you write.',
    steps: ['Write the pattern in the top field (without the surrounding slashes)', 'Enter the text to match in the bottom field', 'Review the highlighted matches and capture groups'],
    notes: ['Add the g flag for global matching, otherwise only the first match is reported'],
    about: 'Regular expressions fail silently: a pattern that looks right may be matching the wrong thing. A live tester closes the gap between writing a pattern and trusting it — paste the real text you need to parse, and every match, capture group and flag effect is highlighted as you type.',
    faqs: [
      { q: 'Which regex flavor does this use?', a: 'JavaScript (ECMAScript). Everyday syntax is shared with PCRE and Python, but lookbehind, named groups and unicode handling differ between engines — keep the rules of your target language in mind when testing.' },
      { q: 'What do the flags mean?', a: 'g returns all matches instead of stopping at the first one; i ignores case; m makes ^ and $ match line boundaries; s lets the dot match newlines.' },
      { q: 'Is my text sent anywhere?', a: 'No. Matching runs entirely in your browser — nothing you paste ever leaves the page.' },
      { q: 'How do I test a regex with capture groups?', a: 'Write the groups into your pattern (e.g. (\\d+)-(\\d+)), run it against your text, and each match lists its capture groups with their values — so you can verify not only that the pattern matches, but that the right parts land in the right groups.' },
      { q: 'Why does my regex work here but fail in my program?', a: 'Usually a flavor or escaping difference: languages disagree on lookbehind, named groups and unicode classes, and string literals often eat a backslash before the regex engine sees it. Test with the same escaping your program uses.' },
    ],
    example: { label: 'Fill in a sample pattern', text: '\\d{3}-\\d{4}' },
    relatedNotes: [
      {
        slug: 'regex-testing-guide',
        title: 'Regex Testing Guide: How Developers Debug Regular Expressions',
        description: 'A practical workflow for testing and debugging regular expressions online — live matches, flags, capture groups and a cheat sheet for the syntax you forget.',
        url: 'https://notes.digdevbox.com/posts/regex-testing-guide',
        tag: 'Regex',
      },
    ],
  },

  '/roman-numeral-converter': {
    intro: 'Converts between Roman numerals and Arabic numbers — useful for ordinals and copyright years.',
    steps: ['Enter a number or a Roman numeral on either side', 'The other side updates automatically', 'Copy and use it'],
    example: { label: 'Fill in a sample number', text: '2024' },
    notes: [
      'The supported range is 1 to 3999. Beyond that, classical notation needs a vinculum (overline) to multiply by 1,000, which has no ASCII form.',
      'Out-of-range numbers return an empty result rather than an error — a blank output can mean “too big”, not “broken”.',
      'Validation is canonical-form only: IIII is a legitimate historical engraving but not a valid modern numeral.',
    ],
    about: 'Convert between Roman numerals and Arabic numbers in both directions, with strict validation on the Roman side. Reading years on buildings and film credits (MCMXCIV), parsing chapter or monarch numbering, or generating stylistic numerals for a design — all from one field. The Roman input is checked against the canonical subtractive form, which means it has to be a numeral this tool itself could have produced: MMMCMXCIX passes, while IIII and VX do not, even though both appear on real clocks and monuments.',
    faqs: [
      { q: 'Why is 4 written IV and not IIII?', a: 'Subtractive notation: a smaller numeral before a larger one subtracts (IV = 5-1, CM = 900). Clock faces traditionally break this rule and print IIII, but standard Roman numerals use subtraction.' },
      { q: 'What is the largest number this handles?', a: 'Standard notation tops out around 3999 (MMMCMXCIX) because there is no classical symbol above M. Anything larger needs vinculum or archaic forms that no modern convention agrees on.' },
      { q: 'Why does my Roman input fail validation?', a: 'Likely an illegal pattern like IC for 99 (must be XCIX) or repeated V, L, D. The validator enforces classical rules so you do not engrave a typo in stone.' },
      { q: 'Is IIII ever correct?', a: 'On clocks, watch dials and some monuments, yes — IIII is the traditional engraved form, often said to be chosen for visual symmetry with VIII opposite it. It is simply not the subtractive form this tool validates, so treat it as decoration rather than as input.' },
      { q: 'How would I write 5,000 or 100,000?', a: 'You cannot in plain ASCII. The classical extension places an overline (vinculum) over a numeral to multiply it by 1,000, so V with a bar means 5,000. With no way to render or parse a bar, the tool stops at 3,999.' },
    ],
  },

  '/rsa-key-pair-generator': {
    intro: 'Generates an RSA public/private key pair in PEM format, for encrypted transport or signature verification.',
    steps: ['Choose the key length (2048 bits and up)', 'Click generate', 'Save the private and public keys separately'],
    notes: ['A lost private key cannot be recovered, so store it safely — and never commit it to a repository'],
    example: { label: 'Fill in a sample key size', text: '4096' },
    about: 'Generate an RSA key pair — private and public key in PEM format, in the key size you choose — directly in the browser. Useful for SSH keys, TLS client certificates, JWT RS256 signing setups, or anywhere you need a fresh pair without installing OpenSSL.',
    faqs: [
      { q: 'Which key size should I generate?', a: '2048 bits is the floor for compatibility; 4096 if the extra signing/verification cost is acceptable and longevity matters. Everything below 2048 exists in the tool only for testing legacy systems.' },
      { q: 'How do I keep the private key private?', a: 'Never share it, never commit it, and prefer generating it on the machine that will use it. This tool runs locally so the key is not transmitted — but anything pasted into a browser context deserves the same care as a password.' },
      { q: 'Can I use these keys for SSH?', a: 'Yes — an RSA PEM private key converts to OpenSSH format with ssh-keygen. Generate here, then run ssh-keygen -y against it to derive the public line for authorized_keys.' },
      { q: 'How do I generate an RSA key without OpenSSL?', a: 'Right here — choose a key size (2048+) and click generate; the private and public keys come out in PEM format, ready for SSH, TLS or JWT RS256, without installing anything.' },
    ],
  },

  '/safelink-decoder': {
    intro: 'Recovers the real link hidden behind an Outlook SafeLink wrapper.',
    steps: ['Copy the very long SafeLink URL from the email', 'Paste it into the input', 'Click decode to get the original URL'],
    notes: ['Decoding only reveals the address — you still have to judge for yourself whether it is trustworthy'],
    example: { label: 'Fill in a sample SafeLink URL', text: 'https://nam.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fdocs' },
    about: 'Outlook SafeLink wraps every URL in corporate mail into a long tracking redirect — you click the wrapper, not the destination. Paste a SafeLink URL and this tool extracts the real address encoded inside it, so you can see (and decide about) where a link actually goes before opening it.',
    faqs: [
      { q: 'What is SafeLink, and why do links look like that?', a: 'It is Microsoft\'s rewriter: mail links are replaced with a URL that routes through Microsoft servers for scanning, then forwards you. The original address is inside the wrapper as a query parameter.' },
      { q: 'Why decode before clicking?', a: 'Two reasons: transparency (you see the real destination, including any look-alike domains) and convenience — the decoded URL opens directly, without the tracking hop and its privacy implications.' },
      { q: 'Does decoding bypass any security?', a: 'No. It only reads the wrapped URL; it does not touch attachments or Microsoft\'s scanning. You are simply choosing to visit the destination directly rather than through the redirect.' },
    ],
  },

  '/slugify-string': {
    intro: 'Turns a title or filename into a slug containing only lowercase letters, digits and hyphens, for URLs and file naming.',
    steps: ['Enter the original string', 'Read the generated slug', 'Copy and use it'],
    notes: ['Input longer than 100,000 characters is rejected outright — slug generation is skipped rather than blocking the page', 'Non-ASCII text is transliterated or handled by rule; English words make the best slugs'],
    example: { label: 'Fill in sample text', text: 'Hello World! 你好 2026' },
    about: 'Turn any string into a URL-, filename- and ID-safe slug: accents transliterated, spaces and symbols replaced, lowercase throughout. Slugs keep URLs readable and stable, and this tool shows exactly what your title becomes before it hits routing or a filesystem.',
    faqs: [
      { q: 'Why do URLs use slugs instead of titles?', a: 'Titles contain spaces, punctuation and encodable characters that make URLs long and brittle. A slug is one safe token that still reads — better for users, sharing and SEO than an opaque ID.' },
      { q: 'What happens to accented characters?', a: 'They are transliterated to their base form (é to e, ü to u) so the slug stays ASCII-safe. If you need to preserve accents in URLs, modern browsers can display them — but ASCII slugs are the portable choice.' },
      { q: 'Can two different titles produce the same slug?', a: 'Yes — "Café!" and "cafe" both become "cafe". That is why systems append IDs or dates when uniqueness matters; the slug guarantees safety and readability, not uniqueness.' },
    ],
  },

  '/sql-prettify': {
    intro: 'Formats SQL that is crammed onto one line into a clearly indented structure — very useful for reading slow-query logs.',
    steps: ['Paste the SQL', 'Pick a dialect (optional)', 'Copy the formatted result'],
    example: { label: 'Fill in sample SQL', text: 'select id,name,created_at from users where status=1 order by created_at desc limit 10' },
    about: 'Paste a SQL query and get it formatted — keywords upper-cased, joins and clauses indented, one field per line — with dialect-aware parsing for PostgreSQL, MySQL, T-SQL, PL/SQL, SQLite, BigQuery, Redshift, Hive, Spark, MariaDB, DB2 and N1QL. A formatted query is the fastest way to review a 40-line join before running it.',
    faqs: [
      { q: 'Why should I pick the right dialect?', a: 'Dialects differ in keywords, quoting and comment syntax. Formatting with the engine you actually run keeps identifiers like backtick-quoted names or @variables recognised and placed correctly.' },
      { q: 'Does formatting change how my query executes?', a: 'No — whitespace and case are irrelevant to the SQL engine. Formatting is purely for humans; the query plan stays identical.' },
      { q: 'Can it minify SQL back to one line?', a: 'Prettifying is the core job. For a compact form, most developers keep the formatted version as the source of truth and let their tools strip whitespace on deploy.' },
      { q: 'How do I make a slow-query log readable?', a: 'Paste the whole one-line statement and let the formatter expand it — the JOIN structure and WHERE conditions become visible at a glance, which is usually where the slow part hides.' },
    ],
  },

  '/string-obfuscator': {
    intro: 'Masks part of a string by rule — for showing order numbers or tokens while protecting the content.',
    steps: ['Enter the original string', 'Set how many leading and trailing characters to keep', 'Copy the masked result'],
    notes: ['This is display-level masking, not encryption. Do not rely on it to protect genuinely sensitive data'],
    example: { label: 'Fill in a sample string', text: 'my-secret-token-123456' },
    about: 'Mask a string so it stays recognisable and comparable without revealing its content — show the first and last few characters and blank out the middle. Built for sharing examples safely: paste a token, an IBAN or a client ID into a bug report or screenshot without leaking the real value.',
    faqs: [
      { q: 'Can the masked value be recovered?', a: 'No — it is redaction for display. The masked value cannot be recovered, which is the point: the output is safe to share precisely because the middle is gone.' },
      { q: 'How much should I keep visible?', a: 'Enough for recognition, not enough for reconstruction. A common convention is first 4 and last 4 for long tokens; shorter secrets deserve fewer visible characters or none.' },
      { q: 'Why not just delete the secret from the screenshot?', a: 'Because you usually need to show that a value was there — length, shape, distinctness between two values. Masking preserves that evidence while removing the secret itself.' },
    ],
  },

  '/svg-placeholder-generator': {
    intro: 'Generates an SVG placeholder of a given size — faster and more reliable than an external placeholder service when building skeleton screens.',
    example: { label: 'Fill in width 800', text: '800' },
    steps: ['Enter the width and height', 'Set the text and colours as needed', 'Copy the SVG or its data URI'],
    about: 'Generate SVG placeholder images — set dimensions, colours and optional text, and embed the URL or markup in your layout while real assets are still in flight. SVG stays crisp at any size and the file is a few hundred bytes, so mockups stop breaking on missing images.',
    faqs: [
      { q: 'Why SVG instead of a PNG placeholder service?', a: 'No network dependency and no fixed resolution: an inline SVG data URI renders instantly and stays sharp at any DPI. For wireframes and CI screenshots, self-hosted placeholders are also more private.' },
      { q: 'How do I embed the result?', a: 'Either as an image src pointing to the generated SVG URL/data URI, or inline as markup so you can style it with CSS. The tool gives you both forms.' },
      { q: 'Can I customise the label text?', a: 'Yes — the placeholder can carry text (dimensions by default, or your own label), which makes it obvious in review which slot each image belongs to.' },
    ],
  },

  '/temperature-converter': {
    intro: 'Converts between Celsius, Fahrenheit, Kelvin and other temperature scales.',
    steps: ['Enter a value on any scale', 'The other scales update automatically', 'Copy the result you need'],
    example: { label: 'Fill in a sample temperature', text: '100' },
    about: 'Convert a temperature across eight scales at once: Celsius, Fahrenheit, Kelvin, Rankine, Delisle, Newton, Réaumur and Rømer. Type a value on any scale and the others update live — whether you are checking an oven setting from a European recipe or decoding historical scientific data that used Réaumur.',
    faqs: [
      { q: 'Why are there so many scales?', a: 'Celsius, Fahrenheit and Kelvin are the everyday and scientific standards; Rankine is Kelvin\'s Fahrenheit-based sibling; Delisle, Newton, Réaumur and Rømer are historical European scales you meet in old records and period instruments.' },
      { q: 'Why can temperature go negative in some scales but not Kelvin?', a: 'Kelvin is absolute — 0 K is the physical floor — while Celsius and Fahrenheit place zero at convenient reference points (freezing water, brine). Negative degrees just mean "below that reference", not "less than no heat".' },
      { q: 'Which scale should I use in code?', a: 'Kelvin for physics and thermodynamics (ratios are meaningful), Celsius or Fahrenheit for user-facing display. Converting at the boundary once is cheaper than mixing scales through your logic.' },
    ],
  },

  '/text-diff': {
    intro: 'Compares two blocks of text line by line to see exactly what changed.',
    steps: ['Paste the original text on the left', 'Paste the new text on the right', 'Review the highlighted additions and removals'],
    example: { label: 'Fill in sample text', text: 'First line\nSecond line\nThird line' },
    notes: [
      'The two panes are read-only for comparison purposes; edit the source files, not the diff view, unless you intend the diff view to be your scratch space.',
      'Because Monaco is a full editor component, this page loads more JavaScript than most tools here — expect a slower first paint on a weak connection.',
      'Whitespace differences are shown, not ignored: a trailing space or a tab-versus-spaces change registers as a real difference.',
    ],
    about: 'Paste two texts and see their differences side by side. The comparison runs in the Monaco diff editor — the same component that powers VS Code — so you get line alignment, inline highlighting of what actually changed inside a line, moved-block detection and familiar keyboard shortcuts, rather than a hand-rolled line-by-line equality check. It is the no-install way to compare config exports, log excerpts, two versions of a paragraph, or a proposed file against the one in production before you commit to either.',
    faqs: [
      { q: 'How does the diff decide lines changed?', a: 'It aligns matching lines and reports the rest as added or removed, in the classic diff style. Rewritten lines usually show as a removal plus an addition rather than a special "changed" marker.' },
      { q: 'Why does a tiny edit show the whole paragraph changed?', a: 'Because the diff is line-based: one changed character makes the whole line differ. Diffing on smaller units (split the paragraph into lines) gives a tighter result.' },
      { q: 'Does whitespace matter?', a: 'Yes — trailing spaces and line-ending differences (CRLF vs LF) count as changes and are a common source of "nothing changed but everything is red". Normalise line endings before comparing if that noise is not what you are hunting.' },
      { q: 'Does it compare words or lines?', a: 'Both, at different levels. Lines are aligned and classified as added, removed or changed, and changed lines get inline markers showing the exact spans inside them. That is why a one-word edit highlights the word rather than the whole paragraph.' },
      { q: 'Is anything uploaded to make the comparison?', a: 'No. Both texts stay in your browser and the diff is computed locally, which is the main reason to reach for a web diff tool instead of pasting proprietary config into some random site that offers the same feature.' },
    ],
  },

  '/text-statistics': {
    intro: 'Counts characters, words and byte size — useful when writing copy or checking an API limit.',
    steps: ['Paste the text', 'Read the statistics', 'Cross-check the byte count against the limit where relevant'],
    notes: ['In UTF-8 a CJK character is about 3 bytes, so the byte count differs from the character count'],
    example: { label: 'Fill in sample text', text: 'The quick brown fox jumps over the lazy dog.' },
    about: 'Live statistics for the text you paste: character count, word count, line count and byte size, updating as you type. The byte size accounts for multi-byte characters, which is what actually matters when filling forms with length limits, sizing payloads or estimating storage.',
    faqs: [
      { q: 'Why do character count and byte size differ?', a: 'Characters outside ASCII take multiple bytes in UTF-8 — an emoji is one character but four bytes. Forms and APIs usually enforce byte or UTF-16 limits, so watch the byte counter for anything multilingual.' },
      { q: 'How are words counted?', a: 'By whitespace separation. "well-known" is one word and punctuation sticks to its word; if you need linguistic word counts (hyphens, contractions) treat this as the fast estimate it is.' },
      { q: 'What counts as a line?', a: 'Every newline-terminated row, so a trailing newline adds one to the count. Empty lines count too — they are real lines in the text.' },
    ],
  },

  '/text-to-binary': {
    intro: 'Converts text to and from ASCII binary — for inspecting low-level representations or teaching.',
    steps: ['Enter the text or the binary', 'The other side updates automatically', 'Copy and use it'],
    notes: ['Binary is grouped in 8-bit blocks; spaces between them are tolerated'],
    example: { label: 'Fill in sample text', text: 'Hi' },
    about: 'Convert text into its ASCII binary representation and back — each character becomes one 8-bit byte, so "Hi" is 01001000 01101001. Useful in teaching contexts, protocol debugging, and any moment you want to see what a string really is under the hood.',
    faqs: [
      { q: 'Why 8 bits per character?', a: 'Extended ASCII and UTF-8 both represent the basic Latin range in single 8-bit bytes. For characters beyond that range, UTF-8 uses multiple bytes — check the Unicode tool for those.' },
      { q: 'How do I convert back without losing data?', a: 'Split the binary into groups of 8 bits and map each to its character code. Groups that are not multiples of 8 indicate truncated or corrupted input.' },
      { q: 'Can binary text keep a message secret?', a: 'Not at all — it is a faithful encoding with no key. Anyone can decode it, which makes it great for illustration and useless for secrecy.' },
    ],
  },

  '/text-to-nato-alphabet': {
    intro: 'Turns text into the NATO phonetic alphabet, so spelling something out over the phone is not misheard.',
    steps: ['Enter the text', 'Read the corresponding words', 'Copy them, or just read them out'],
    example: { label: 'Fill in sample text', text: 'SOS' },
    notes: [
      'Only A–Z is converted; digits, punctuation and spaces are copied through unchanged.',
      'Codewords are joined with single spaces, so a space in your input shows up as a wider gap.',
      'Spelling follows the English convention (Alpha, Juliet), not the strict ICAO forms (Alfa, Juliett).',
    ],
    about: 'Transcribe letters into the NATO / ICAO spelling alphabet so that reading a reference out loud survives the trip: A becomes Alpha, S becomes Sierra, B becomes Bravo. The mapping covers the 26 Latin letters only — digits, punctuation and spaces are copied through unchanged, so "Call 911" comes out as "Charlie Alpha Lima Lima 9 1 1". Use it for ticket IDs, licence plates, serial numbers, flight codes and support scripts, the places where B/P, M/N and E/I confusion costs a callback.',
    faqs: [
      { q: 'Why not just say the letters louder?', a: 'Because the problem is not volume — it is that B, C, D, E, G, P, T, V, Z all rhyme. Distinct codewords remove the ambiguity entirely, which is why the alphabet is international and standardised.' },
      { q: 'Are digits converted into words?', a: 'No. Only the 26 letters have codewords in this tool, so a digit is copied through as itself — 9 stays "9" rather than becoming "niner". If your channel needs spoken digits, add those words yourself.' },
      { q: 'What happens to punctuation and spaces?', a: 'They pass through unconverted. Every output item is joined with a single space, so a space in your input produces a wider gap in the result. Nothing is lost: the extra gap is the space itself.' },
      { q: 'Why does it print "Alpha" and "Juliet"?', a: 'The strict ICAO/NATO spellings are Alfa and Juliett. This table uses the common English forms for those two words; the other 24 codewords match the standard exactly.' },
      { q: 'Is this the alphabet aviation actually uses?', a: 'Yes for the codewords — Alpha through Zulu is the international spelling alphabet used by aviation, maritime and military radio. What varies between organisations is how digits are spoken (niner vs nine, woe vs one), and this tool does not touch digits at all.' },
    ],
  },

  '/text-to-unicode': {
    intro: 'Converts text to and from Unicode code points — useful for tracking down mojibake or writing escape sequences.',
    steps: ['Enter the text or the code point sequence', 'The other side shows the converted result', 'Copy and use it'],
    example: { label: 'Fill in sample text', text: 'Hello 你好' },
    notes: [
      'The numbers are UTF-16 code units, not Unicode code points: characters outside the Basic Multilingual Plane (most emoji) come out as a pair of surrogate references.',
      'ASCII is escaped too — every character gets a reference, so the output is far longer than the input.',
      'This tool neither emits nor parses \\uXXXX escapes or &#xNN; hexadecimal forms; only decimal &#NN; is understood.',
    ],
    about: 'Turn text into numeric character references and back. Each character becomes &#NN; holding its UTF-16 code-unit value, so “Hello” turns into &#72;&#101;&#108;&#108;&#111;, and the reverse field takes a run of those references and gives the text back. This is the form that survives systems which mangle non-ASCII bytes: paste it into HTML and the browser renders the original characters regardless of the file\'s encoding. Note what it is not — the numbers are code units rather than code points, and the only syntax either direction understands is decimal &#NN;.',
    faqs: [
      { q: 'Why does my "duplicate" username fail a comparison?', a: 'It very likely contains invisible characters — zero-width spaces, joiners or look-alike homoglyphs. Inspecting the code points exposes them; a character that should not be there will stand out immediately.' },
      { q: 'What is the difference between U+ notation and \\u escapes?', a: 'They are two spellings of the same code point: U+1F600 and \\uD83D\\uDE00 (its surrogate pair in JS/JSON) both denote the same emoji. This tool converts between the views so you can paste whichever your context needs.' },
      { q: 'What are combining characters?', a: 'Accents and marks that attach to the previous character instead of standing alone. "é" can be one code point or "e" plus a combining accent — both display the same but compare differently, and this tool shows which one you have.' },
      { q: 'Why does my emoji turn into two numbers?', a: 'Because it sits outside the Basic Multilingual Plane, so JavaScript stores it as a surrogate pair — two UTF-16 code units. The tool reports both, and reading them back reassembles the emoji correctly. A tool that claims to emit code points would show one larger number instead.' },
      { q: 'Can it read \\u0048 or &#x48; style escapes?', a: 'No. The reverse pass matches decimal references only. Hexadecimal references mean the same character in HTML and \\uXXXX belongs to JavaScript string syntax rather than HTML, but neither is parsed here.' },
    ],
  },

  '/password-generator': {
    intro: 'Generates strong random passwords with a cryptographic random source — length and character sets under your control.',
    steps: ['Set the length (8–128)', 'Tick the character classes you need', 'Click refresh until you like one, then copy'],
    notes: [
      'Uses the browser crypto.getRandomValues source — suitable for real account passwords, not just placeholders',
      'Visually ambiguous characters (I l 1 O 0 o) are excluded by default so passwords stay readable when transcribed',
      'Everything is generated locally; nothing is transmitted or logged',
    ],
    about: 'A password generator creates random strings strong enough to use as real account credentials. This one draws from the browser cryptographic random source (crypto.getRandomValues, the same class of source behind Web Crypto), so the output is unpredictable rather than merely unique. You control the length (8–128 characters) and the character classes — uppercase, lowercase, digits, symbols — and visually ambiguous characters (I l 1 O 0 o) are excluded by default so the password survives being read off a screen or written down. For accounts that matter, the usual guidance applies: longer is stronger (a 16+ character random password outperforms any clever short one), every account gets its own password, and a password manager is the practical way to hold them all.',
    faqs: [
      { q: 'What makes a password strong?', a: 'Length and randomness. A 16+ character random password is outside practical brute-force range; complexity rules (add a symbol, add a digit) matter far less than length. A random 20-character password from this tool is stronger than any human-memorable phrase.' },
      { q: 'Is this password generator safe to use?', a: 'Yes — the passwords are generated in your browser from the Web Crypto random source and never transmitted. The practical risk of a generated password is not the generator, it is where you store it: use a password manager rather than a note file.' },
      { q: 'How long should my password be?', a: '16 characters is a sensible floor for accounts you care about; 20+ for email, banking and password-manager unlock. This tool caps at 128, far beyond any realistic need.' },
      { q: 'Why exclude characters like I, l and 0?', a: 'They are easily confused when reading a password off a screen, printing it, or saying it over the phone. Excluding them removes transcription errors without meaningfully shrinking the search space. Toggle them back on if your system requires specific characters.' },
    ],
  },

  '/token-generator': {
    intro: 'Generates a random string from a chosen character set — for temporary passwords and invite codes.',
    steps: ['Set the length', 'Tick the character classes you need', 'Click generate and copy'],
    notes: ['This uses a regular random number generator; for security-sensitive cases use the platform cryptographic source'],
    example: { label: 'Show a sample token', text: 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2W3x4Y5z6a7B8c9D0e1F2g3H4i5J6k7' },
    about: 'A token here is a random string built from a character set you choose — uppercase, lowercase, digits and optional symbols — at any length from 1 to 512. It is handy for temporary passwords, invite codes, placeholder secrets and other non-critical identifiers. The string is generated in the browser from a pseudo-random source: fine for uniqueness, but for security-sensitive secrets (password-reset links, API keys) prefer a cryptographically strong generator that an attacker cannot predict.',
    faqs: [
      { q: 'Are generated tokens sent anywhere?', a: 'No. The token is produced locally in your browser and never leaves the page, so nothing is uploaded or logged by this tool.' },
      { q: 'Can I use this for password-reset tokens or API keys?', a: 'For low-stakes cases — a temporary password, an invite code, a test fixture — yes. For anything security-sensitive, use a cryptographically strong source instead: this tool uses a regular random number generator, which is good for uniqueness but not for unpredictability against a determined attacker.' },
      { q: 'How do I make a token harder to guess?', a: 'Increase the length and enable more character classes. Entropy grows with length multiplied by alphabet size, so a longer token that mixes letters, digits and symbols is far harder to brute-force than a short one.' },
      { q: 'What is a token?', a: 'In everyday dev use, a random string that identifies or protects something: a session ID, an invite code, a temporary password. This tool builds them from the character set and length you choose.' },
    ],
  },

  '/toml-to-json': {
    intro: 'Converts TOML configuration into JSON, so it can be consumed in code or over an API.',
    steps: ['Paste the TOML', 'Get the JSON result', 'Copy and use it'],
    example: { label: 'Fill in sample TOML', text: 'title = "demo"\n\n[server]\nport = 8080' },
    about: 'TOML is a favourite for application config because it is human-editable and maps onto a clean data structure, but most code and APIs speak JSON. This tool parses TOML into its data model and serialises the result as JSON: tables become objects, dotted keys become nested objects, and arrays of tables become JSON arrays. The companion JSON-to-TOML tool handles the other direction, so config can flow from a TOML file into a JSON-based pipeline without manual editing.',
    faqs: [
      { q: 'Are TOML tables the same as JSON objects?', a: 'Effectively yes. A [server] table with port = 8080 becomes { "server": { "port": 8080 } }, and a dotted key server.port = 8080 produces the same structure. Arrays of tables ([[items]]) become JSON arrays of objects.' },
      { q: 'What about TOML types JSON lacks?', a: 'TOML has datetimes (local, zoned and offset) that JSON cannot represent natively. They are serialised as ISO-8601 strings so the value survives the conversion; if you need them as real dates on the other side, parse the string explicitly.' },
      { q: 'Is the conversion lossless?', a: 'For the data model, yes — nothing is dropped. The only loss is TOML-specific niceties like comments and key ordering in some serialisers; the values themselves come through unchanged.' },
    ],
  },

  '/toml-to-yaml': {
    intro: 'Converts TOML configuration into YAML, for migrating between configuration formats.',
    steps: ['Paste the TOML', 'Get the YAML result', 'Copy and use it'],
    example: { label: 'Fill in sample TOML', text: 'title = "demo"\n\n[server]\nport = 8080' },
    about: 'Convert TOML into YAML — the direction you need when a Rust or Python project file must become a CI variable file, a Kubernetes-adjacent config, or simply a format your teammates can eyeball. TOML tables map to nested YAML mappings, arrays of tables to YAML lists.',
    faqs: [
      { q: 'What happens to [tool.x] style table headers?', a: 'Each dotted header becomes the equivalent nested mapping, so [tool.pytest] turns into tool: pytest: {...}. Round-tripping back to TOML reproduces the original structure.' },
      { q: 'Are arrays of tables supported?', a: 'Yes — [[products]] style arrays become YAML lists of mappings, which is the standard way to express the same data in YAML.' },
      { q: 'Why does the YAML output quote some values?', a: 'YAML has many implicit-type pitfalls (the Norway problem: "no" parses as false). Emitting quotes where the type could be ambiguous keeps the converted document faithful to the TOML types.' },
    ],
  },

  '/ulid-generator': {
    intro: 'Generates ULIDs: unique like a UUID, but sortable by time — friendlier as a database primary key.',
    steps: ['Click generate to get a ULID', 'Generate repeatedly for more', 'Copy and use it'],
    about: 'A ULID is a 128-bit identifier that is lexicographically sortable: the first 10 characters encode a millisecond timestamp, so sorting ULIDs as strings puts them in creation order. That makes them a drop-in upgrade over a random UUID when the identifier is also used as a database primary key or a sort key — new rows land at the end instead of being scattered. The remaining 16 characters are 80 bits of randomness, so collisions are not a practical concern. ULIDs use Crockford base32 (no I, L, O or U) and are conventionally written uppercase.',
    faqs: [
      { q: 'How is a ULID different from a UUID v4?', a: 'A UUID v4 is random, so its byte order carries no meaning and sorting it tells you nothing about creation time. A ULID puts a millisecond timestamp in its first 10 characters, so lexicographic order equals chronological order — which is exactly what you want from a primary or sort key.' },
      { q: 'Can two ULIDs collide?', a: 'Within a single millisecond a ULID still has 80 random bits (the last 16 characters), giving about 2^80 values before a collision is even theoretically likely. Real systems generate far fewer than that per millisecond, so collisions are not a concern in practice.' },
      { q: 'Is a ULID case-sensitive?', a: 'ULID uses Crockford base32 and is conventionally uppercase; the canonical form keeps it uppercase. Some libraries accept lowercase on input, but store and compare the canonical uppercase string to avoid mismatches.' },
    ],
    relatedNotes: [
      {
        slug: 'uuid-vs-ulid-guide',
        title: 'UUID vs ULID: Choosing the Right Identifier for Modern Applications',
        description: 'UUID or ULID for your primary keys? A practical comparison of randomness, sortability and index behavior — with live generators to produce both formats online.',
        url: 'https://notes.digdevbox.com/posts/uuid-vs-ulid-guide',
        tag: 'UUID',
      },
    ],
  },

  '/url-encoder': {
    intro: 'Encodes a string into percent-encoded form, or decodes it back — avoids the classic pitfalls when building query strings.',
    steps: ['Paste the raw or already-encoded string', 'Click encode or decode', 'Copy the result'],
    notes: ['Encoding a whole URL also escapes the :// — normally you should only encode the parameter values'],
    about: 'Percent-encoding (URL encoding) replaces characters that would break a URL — spaces, &, ?, #, +, non-ASCII text — with a % followed by the byte\'s hex value, so a space becomes %20 and 王 becomes %E7%8E%8B. This tool uses the browser\'s encodeURIComponent, the same function your backend frameworks call, so its output matches what production code produces. The single most common mistake is scope: encoding a complete URL escapes the :// and ? that make it a URL. Encode values, then concatenate them into the URL — that is what "only encode the parameter values" in the notes means.',
    faqs: [
      { q: 'What is the difference between %20 and +?', a: 'Both historically mean "space" in a query string, but they belong to different encodings: %20 comes from percent-encoding, + is an application/x-www-form-urlencoded convention. encodeURIComponent produces %20. Some servers treat + literally, so when in doubt use %20 and test against the real endpoint.' },
      { q: 'Why is my decoded string full of %EF%BF%BD or garbage characters?', a: 'That byte sequence is U+FFFD, the replacement character: the text was already corrupted before encoding, typically by being stored or transmitted in the wrong charset. Percent-encoding preserves bytes, not meaning — fixing it requires finding where the encoding was first mismatched.' },
      { q: 'Should I encode the whole URL or just the parameter values?', a: 'Only the values. Encoding a full URL turns https:// into https%3A%2F%2F and destroys its structure. Build the URL first, then encode each value you insert into it — or encode the complete URL only when it is itself a value of another parameter (a redirect target, for example).' },
    ],
    example: { label: 'Fill in sample text', text: 'https://example.com/search?q=hello world&page=1' },
    relatedNotes: [
      {
        slug: 'url-encoding-guide',
        title: 'URL Encoding Guide: Percent-Encoding, encodeURIComponent and Form Traps',
        description: 'How percent-encoding works, where encodeURIComponent and encodeURI differ, and why a plus sign can quietly turn into a space in your form data.',
        url: 'https://notes.digdevbox.com/posts/url-encoding-guide',
        tag: 'URL',
      },
    ],

  },

  '/url-parser': {
    intro: 'Breaks a URL down into its scheme, host, port, path and query parameters.',
    steps: ['Paste the full URL', 'Read the parsed fields', 'Query parameters are listed as a table for easy copying'],
    about: 'This tool applies the browser\'s native URL parser to whatever you paste and lays out every component the spec recognizes: protocol, username, password, hostname, port, pathname, query parameters (each key and value on its own row) and fragment. Using the same parser as the browser matters because URL edge cases are genuinely subtle — default ports are hidden, percent-encoding is normalized, and internationalized domain names are converted to punycode. When a redirect, an allowlist check or a routing rule is not behaving as expected, parse the exact string here first; the discrepancy between what you think the URL is and what the parser sees is usually the bug.',
    faqs: [
      { q: 'Why is the port missing from my parsed URL?', a: 'Default ports are not written in URLs: https implies 443 and http implies 80, and the browser\'s parser reports an empty port for them. The URL is not "missing" anything — the scheme determines the port automatically.' },
      { q: 'Can a URL with a username and password be safe?', a: 'Basic-auth credentials in a URL (https://user:pass@host) are visible in logs, browser history and Referer headers, and several browsers now strip or block them. The parser shows them so you can audit links — production systems should send credentials via headers instead.' },
      { q: 'What does the #fragment part mean for the server?', a: 'Nothing: the fragment is never sent to the server, it stays in the browser (for anchor jumps or, in SPA frameworks, as client-side routing). Two URLs differing only in fragment are the same request to a server.' },
    ],
    example: { label: 'Fill in a sample URL', text: 'https://user:pass@example.com:8443/path/to/page?a=1&b=2#section' },
    relatedNotes: [
      {
        slug: 'url-encoding-guide',
        title: 'URL Encoding Guide: Percent-Encoding, encodeURIComponent and Form Traps',
        description: 'How percent-encoding works, where encodeURIComponent and encodeURI differ, and why a plus sign can quietly turn into a space in your form data.',
        url: 'https://notes.digdevbox.com/posts/url-encoding-guide',
        tag: 'URL',
      },
    ],

  },

  '/user-agent-parser': {
    intro: 'Identifies the browser, engine, operating system and device type from a User-Agent string.',
    steps: ['Paste a UA string, or fill in the current browser in one click', 'Read the parsed information', 'Copy the fields you need'],
    notes: ['A UA string can be forged, so it suits statistics and display but never security decisions'],
    example: { label: 'Fill in a sample UA', text: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' },
    about: 'Paste a user-agent string and get its structure parsed into browser, engine, OS, CPU and device fields. Essential when triaging analytics, writing UA-based routing rules, or checking what a crawler\'s UA actually declares before you trust it.',
    faqs: [
      { q: 'Can I trust the user-agent string?', a: 'No — any client can send any string, and some browsers deliberately freeze or spoof parts of it. Treat parsed UA data as a hint for statistics and routing, never as an authentication factor.' },
      { q: 'Why does the device field say "generic" on desktop?', a: 'Desktop browsers do not report a device model at all, so the parser can only say the class. Detailed device names appear mostly for mobile UAs.' },
      { q: 'How do I recognise a bot?', a: 'Bots usually announce themselves (Googlebot, bingbot) and often lack a full engine/version structure. Parse the string and check whether browser and engine fields look coherent — missing pieces are a strong bot signal.' },
    ],
  },

  '/uuid-generator': {
    intro: 'Generates UUIDs in bulk (v4 by default) for test data or unique identifiers.',
    steps: ['Choose how many you need', 'Click generate', 'Copy and use them'],
    notes: ['UUID v4 is random and not time-sortable; use ULID if you need an ordered identifier'],
    about: 'A UUID (Universally Unique Identifier) is a 128-bit label, and version 4 — the default here — is generated from random data. With about 122 random bits, the chance of two v4 UUIDs colliding is negligible, so machines can generate identifiers independently without any central coordinator. This tool can also produce v1, v3 and v5 when you need time- or name-based identifiers.',
    faqs: [
      { q: 'Can two generated UUIDs ever collide?', a: 'Theoretically yes, practically no — you would need to generate billions per second for a long time to reach even a coin-flip chance. Databases keep unique constraints as a backstop, not because you will hit it.' },
      { q: 'UUID v4 or ULID — which one do I need?', a: 'v4 is completely random, so sorting by UUID says nothing about creation order. If identifiers land in database indexes where insertion order matters, a time-ordered format such as ULID or UUID v7 performs better.' },
      { q: 'Are the generated UUIDs sent anywhere?', a: 'No. They are generated locally in your browser and never leave the page.' },
    ],
    relatedNotes: [
      {
        slug: 'uuid-vs-ulid-guide',
        title: 'UUID vs ULID: Choosing the Right Identifier for Modern Applications',
        description: 'UUID or ULID for your primary keys? A practical comparison of randomness, sortability and index behavior — with live generators to produce both formats online.',
        url: 'https://notes.digdevbox.com/posts/uuid-vs-ulid-guide',
        tag: 'UUID',
      },
    ],
  },

  '/wifi-qrcode-generator': {
    intro: 'Generates a Wi-Fi QR code so guests can join the network by scanning instead of typing the password.',
    steps: ['Enter the network name (SSID)', 'Enter the password and pick the security type', 'Generate, then scan or download'],
    notes: ['The QR code contains the password in plain form — be careful about posting it in public places'],
    example: { label: 'Fill in a sample SSID', text: 'Home-WiFi' },
    about: 'Turn your WiFi credentials into a QR code guests can scan to join instantly — no more reading passwords aloud. Fill in the network name (SSID), pick the security mode (WPA by default, or a no-password open network), type the password and optionally mark the SSID as hidden; then download the code as a PNG for printing.',
    faqs: [
      { q: 'How does scanning a WiFi QR code work?', a: 'The QR encodes a standard WIFI: string (SSID, password, security mode). iOS and Android both detect this format natively and offer to join the network straight from the camera.' },
      { q: 'My network has no password — which mode do I pick?', a: 'Choose the no-password/open option. Picking WPA with an empty password produces a code phones cannot use — the mode must match how the router actually broadcasts.' },
      { q: 'Does it work with a hidden SSID?', a: 'Yes — mark the SSID as hidden and the code carries that flag. Guests still need to be within radio range, and some older devices handle hidden networks less smoothly.' },
    ],
  },

  '/xml-formatter': {
    intro: 'Formats XML that has been compressed onto one line into an indented structure — very useful when reading API payloads.',
    steps: ['Paste the XML', 'Click format', 'Copy the result'],
    example: { label: 'Fill in sample XML', text: '<root><user id="1"><name>Alice</name></user></root>' },
    about: 'Turn a cramped XML string into readable, indented markup — or strip it back down when you need the compact form. Well-formed XML is validated as part of processing, so a misplaced tag surfaces immediately instead of exploding somewhere downstream in your SOAP response or Android layout.',
    faqs: [
      { q: 'Does formatting validate my XML?', a: 'Partially: the parser must read your XML successfully, so broken nesting, unclosed tags and bad entities fail loudly here. It is not a schema (XSD) validator — structure rules beyond well-formedness need a dedicated tool.' },
      { q: 'Why is my indented XML suddenly bigger?', a: 'Pretty-printing adds whitespace text nodes, which matter in XML: an element containing " text " is not the same as one containing "text". That is why round-tripping through minify can alter content-sensitive documents.' },
      { q: 'What about namespaces and attributes?', a: 'Namespaces are preserved exactly — formatting only re-arranges whitespace between tags, never renames elements or touches attribute values.' },
    ],
  },

  '/xml-to-json': {
    intro: 'Converts XML into JSON for integrating with modern APIs.',
    steps: ['Paste the XML', 'Get the JSON result', 'Copy and use it'],
    notes: ['XML attributes and text nodes are represented by different fields in JSON — check the output after converting'],
    example: { label: 'Fill in sample XML', text: '<user id="1"><name>Alice</name></user>' },
    about: 'JSON is the lingua franca of modern APIs, but plenty of systems still emit XML. This tool parses an XML document and projects it into JSON: elements become objects, repeated elements become arrays, and attributes and text are given distinct keys so neither is lost. The mapping is not unique — XML carries more structure than JSON in places (attributes, mixed content) — so the output uses a consistent convention (commonly attributes under an "@" key and text under "#text") that you can rely on when parsing it downstream.',
    faqs: [
      { q: 'Where do XML attributes go in the JSON?', a: 'This tool puts attributes under a dedicated key (typically @) and element text under another (typically #text), so <user id="1">Alice</user> becomes { "user": { "@id": "1", "#text": "Alice" } }. The exact key names follow the converter\'s convention — read one sample before trusting the shape in code.' },
      { q: 'Why did my repeated tags become an array?', a: 'JSON has real arrays; XML does not. When the same child element appears more than once, the converter groups them into an array so order and multiplicity are preserved. A single occurrence stays a single object unless the schema marks it as a list.' },
      { q: 'How do I convert back to XML?', a: 'Use the JSON-to-XML tool. Keep in mind the round trip is not perfectly symmetric: attributes that became @ keys must be re-special-cased, and any typing XML lost (everything is text) will not magically return.' },
    ],
  },

  '/yaml-prettify': {
    intro: 'Formats YAML so the indentation is consistent and easy to read and debug.',
    steps: ['Paste the YAML', 'Click format', 'Copy the result'],
    notes: ['YAML expresses hierarchy through indentation, and only spaces work — never tabs'],
    example: { label: 'Fill in sample YAML', text: 'name: devbox\nservices:\n- web\n- api' },
    about: 'Normalise a YAML document into clean, consistent indentation — the single most common source of YAML bugs. Paste your config, get it re-emitted with uniform spacing and structure, and use the parse step as a syntax check before kubectl or your CI pipeline rejects it for one stray tab.',
    faqs: [
      { q: 'Why does YAML break so easily?', a: 'Structure comes from indentation, not brackets — one wrong space changes nesting, and tabs are forbidden outright. Formatting normalises all of it and fails fast on anything unparseable.' },
      { q: 'Does the formatter fix wrong indentation?', a: 'It re-emits whatever the parser understood. If your YAML parses, the output comes out with consistent indentation; if the structure itself is ambiguous, parsing fails and points you at the line.' },
      { q: 'Will it preserve my comments and anchors?', a: 'Parse-and-rewrite loses comments in some cases, because comments are not part of the parsed model. Keep a version-controlled copy of commented configs rather than round-tripping through any formatter.' },
    ],
    relatedNotes: [
      {
        slug: 'yaml-vs-json-guide',
        title: 'YAML vs JSON: Syntax Differences, Trade-offs and Parser Traps',
        description: 'How YAML and JSON differ in syntax and intent, which one to pick for a given file, and the parser traps — indentation, yes/no dates — that break otherwise valid YAML.',
        url: 'https://notes.digdevbox.com/posts/yaml-vs-json-guide',
        tag: 'YAML',
      },
    ],

  },

  '/yaml-to-json-converter': {
    intro: 'Converts YAML into JSON, a common step when handling configuration files or API data.',
    steps: ['Paste the YAML', 'Get the JSON result', 'Copy and use it'],
    example: { label: 'Fill in sample YAML', text: 'name: devbox\nservices:\n  - web\n  - api' },
    about: 'YAML is everywhere in config and CI, but code and APIs overwhelmingly consume JSON. This tool parses YAML into its data model and writes it back as JSON. Because YAML is a strict superset of JSON, the conversion is faithful: indentation defines nesting, dash lists become arrays, and YAML\'s type inference (booleans, numbers, null) is preserved as the matching JSON values. The JSON-to-YAML tool reverses it when you need a YAML file from JSON.',
    faqs: [
      { q: 'Does the conversion keep my data types?', a: 'Yes. YAML infers booleans, integers, floats and null, and those become the correct JSON true/false/number/null. A string like "123" stays a string because it was quoted or unambiguous, so the JSON types match the YAML intent.' },
      { q: 'What happens to YAML comments?', a: 'They are dropped — JSON has no representation for comments, so there is nowhere to put them. If the comments carry meaning (for example a deprecation note), preserve the YAML source alongside the generated JSON.' },
      { q: 'Why did my value turn into a number or boolean?', a: 'YAML auto-types bare words: yes, no, true, false, on and off become booleans, and 1, 1.5 and 1e3 become numbers. If you need them as strings, quote them in the YAML; otherwise the JSON will correctly reflect YAML\'s interpretation.' },
    ],
    relatedNotes: [
      {
        slug: 'yaml-vs-json-guide',
        title: 'YAML vs JSON: Syntax Differences, Trade-offs and Parser Traps',
        description: 'How YAML and JSON differ in syntax and intent, which one to pick for a given file, and the parser traps — indentation, yes/no dates — that break otherwise valid YAML.',
        url: 'https://notes.digdevbox.com/posts/yaml-vs-json-guide',
        tag: 'YAML',
      },
    ],

  },

  '/yaml-to-toml': {
    intro: 'Converts YAML into TOML format, for configuration migrations.',
    steps: ['Paste the YAML', 'Get the TOML result', 'Copy and use it'],
    example: { label: 'Fill in sample YAML', text: 'title: demo\nserver:\n  port: 8080' },
    about: 'Convert YAML configuration into TOML. Typical situation: a tool or language ecosystem expects TOML (Cargo, pyproject.toml, Netlify) while your notes or templates are in YAML — paste one side, copy the other, with nested structures mapped to TOML tables.',
    faqs: [
      { q: 'How do nested YAML maps become TOML?', a: 'Nested mappings become TOML table headers ([section], [section.sub]). The output stays readable, but very deep nesting produces long dotted table names — that is the format\'s nature, not a bug.' },
      { q: 'What about YAML lists and mixed types?', a: 'Lists map to TOML arrays; lists of maps become arrays of inline tables ([{...}]). Homogeneous lists survive perfectly; exotic mixes may change shape slightly.' },
      { q: 'Are YAML anchors and multi-line strings converted?', a: 'Anchors are resolved to their values during parsing — the TOML output is always anchor-free. Block scalars become ordinary strings with the newlines preserved.' },
    ],
  },

  '/htpasswd-generator': {
    intro: 'Generates the "username:hash" line for an .htpasswd file to protect Apache / Nginx with Basic authentication, and can verify an existing entry against a password.',
    steps: [
      'Enter the username and password',
      'Pick a format: bcrypt (recommended since Apache 2.4), Apache MD5 ($apr1$, most compatible), SHA1, or plaintext (debugging only)',
      'For apr1 you can supply the salt (up to 8 characters) or click for a random one; for bcrypt use cost to control strength',
      'Click generate and write the whole line into .htpasswd, pointing auth_basic_user_file at it',
      'To verify: paste an existing line into the content field, enter the password to test, and read the comparison result',
    ],
    notes: [
      'Both generation and verification happen locally in the browser; the password never leaves the page',
      'A higher bcrypt cost is slower and harder to brute-force; after raising it, clicking generate involves a noticeable wait',
      'SHA1 ({SHA}) is barely better than plaintext and is explicitly marked insecure in Apache documentation',
      'The plaintext format is only supported by Windows / Netware — do not use it in production',
    ],
    example: { label: 'Fill in a sample username', text: 'admin' },
    about: 'Generate .htpasswd entries for Apache or Nginx basic auth — bcrypt, apr1, SHA1 or crypt — and verify existing lines. One entry per line in the right hash format is all a server needs to password-protect a directory, and this tool produces exactly that without touching a terminal.',
    faqs: [
      { q: 'Which hash format should I choose?', a: 'bcrypt for new setups (strongest, slow by design). apr1 is the Apache-legacy default; SHA1 and plain are only for ancient servers that accept nothing else — do not introduce them on purpose.' },
      { q: 'Where does the .htpasswd file go?', a: 'Outside the web root, referenced from your server config (AuthUserFile in Apache, auth_basic_user_file in Nginx). The file must never be downloadable.' },
      { q: 'Why does verification fail for a line I know is right?', a: 'Hashes are salted: a password hashes to a different string each generation, and only the stored salt is reused to verify. Mismatch usually means the password differs, not that the tool is broken.' },
    ],
  },

  '/rmb-uppercase': {
    intro: 'Converts an amount into the uppercase Chinese numerals required on invoices and expense forms, so you do not miscount the places by hand.',
    steps: ['Enter the amount', 'Tick the RMB prefix and the 元/圆 wording as needed', 'Copy the uppercase Chinese result'],
    notes: ['Grouping units go up to trillions; double-check the result for unusually large amounts'],
    example: { label: 'Fill in a sample amount', text: '1409.05' },
    about: 'Turn a numeric amount into the standard Chinese financial uppercase wording (人民币大写: 壹佰贰拾叁元整), with jiao and fen handled and an optional 「人民币」 prefix. Financial documents in China require this form on invoices, receipts and contracts precisely because uppercase characters cannot be altered the way plain digits can.',
    faqs: [
      { q: 'Why do Chinese financial documents use uppercase numerals?', a: 'Simple strokes like 一二三 are trivially altered into 二三四. The complex uppercase forms (壹, 贰, 叁) resist tampering, so banking law requires them on negotiable documents.' },
      { q: 'How are zeros handled?', a: 'Standard rules apply: intermediate zeros collapse to one 零 (102 = 壹佰零贰元), and trailing zero jiao/fen produce 整 (exactly). The tool follows the People\'s Bank conventions.' },
      { q: 'Does it support the 人民币 prefix and decimals?', a: 'Yes — toggle the prefix as your template requires, and amounts with jiao (角) and fen (分) decimals are worded correctly down to the cent.' },
    ],
  },

  '/fullwidth-converter': {
    intro: 'Converts characters between full-width and half-width forms, cleaning up full-width letters, digits or punctuation that crept into mixed CJK/Latin text.',
    steps: ['Paste the text to process', 'Pick a conversion mode: half-width → full-width, full-width → half-width, or punctuation only', 'Copy the converted result'],
    notes: [
      'Punctuation-only mode leaves letters and digits alone and replaces punctuation per the mapping table',
      'Half-width and full-width spaces (U+3000) are both converted',
    ],
    example: { label: 'Fill in sample text', text: 'ＡＢＣ１２３，全角标点。' },
    about: 'Convert between full-width and half-width characters — the fixed Unicode offset 0xFEE0 maps A to Ａ, 1 to １ and so on — with an option to adjust punctuation only. Essential when cleaning data pasted from CJK documents, aligning mixed-language databases, or fixing lookups that fail because "ABC" and "ＡＢＣ" are different strings to a computer.',
    faqs: [
      { q: 'What is the difference between full-width and half-width?', a: 'Full-width characters occupy an em square (used in CJK typesetting); half-width is the narrow Latin form. Unicode places most full-width forms at a constant 0xFEE0 offset from their half-width counterparts, which is exactly what this tool exploits.' },
      { q: 'Why did my search or join fail with no visible difference?', a: 'Because ＡＢＣ and ABC are different code points even though they print identically in many fonts. Normalising width before comparing strings fixes a whole class of "invisible" data bugs.' },
      { q: 'When should I convert punctuation only?', a: 'When the letters are correct but punctuation came in full-width from a CJK editor (，vs ,). Converting only punctuation keeps identifiers intact while fixing separators.' },
    ],
  },

  '/morse-code-converter': {
    intro: 'Converts between text and Morse code (. -) in both directions.',
    steps: ['Paste the text or the Morse code', 'Pick the conversion direction', 'Copy the converted result'],
    notes: [
      'Supports A–Z, 0–9 and common punctuation; characters with no Morse mapping (such as CJK) are skipped when encoding',
      'In the encoded output, letters are separated by spaces and words by /',
      'When decoding, the word separator may also be written as | or ｜',
      'Decoding an unknown code point outputs ?',
    ],
    example: { label: 'Fill in sample text', text: 'SOS' },
    about: 'Encode text into Morse code and decode it back, with letters separated by spaces and words by slashes. Useful for radio amateur practice, escape-room props, signal-themed games — or just settling what "SOS" actually looks like in dots and dashes.',
    faqs: [
      { q: 'Why are words separated by a slash?', a: 'Morse only has dot/dash and gaps, and text has two levels of separation (letters and words). Written Morse needs a visible word gap, and the slash is the convention — a single space would be ambiguous.' },
      { q: 'Is Morse case-sensitive?', a: 'No — Morse has no case and no punctuation of its own except a few procedural signals. This encoder accepts mixed input and maps every letter to the same code regardless of case.' },
      { q: 'What is the classic SOS sequence?', a: 'Three short, three long, three short: ... --- ... It was chosen because the pattern is unmistakable even under noise, not because it abbreviates anything.' },
      { q: 'What is Morse code?', a: 'A letter-encoding system from the 1840s where each character is a sequence of dots and dashes — SOS (... --- ...) is its most famous sequence. Letters are separated by spaces and words by a slash.' },
    ],
  },

  '/px-rem-converter': {
    intro: 'Converts between px and rem in bulk against a root font size — for tuning responsive typography and spacing.',
    example: { label: 'Fill in root size 16', text: '16' },
    steps: [
      'Set the root font size — the font-size of the page html, 16px by default; adjust the decimal places as needed',
      'Choose the direction: px → rem or rem → px',
      'Enter the values (separated by spaces, commas or newlines; px and rem units are accepted)',
      'Copy the result. The relationship is rem = px ÷ root font size',
    ],
    notes: ['A wrong root font size shifts every result, so keep it in sync when you change the design baseline'],
    about: 'Convert a batch of values between px and rem against any root font size — the 16px default or whatever your design system sets. Rems keep typography and spacing accessible (users who scale their base font size get proportional layouts), and this converter handles the whole stylesheet\'s worth of values in one paste.',
    faqs: [
      { q: 'What root font size should I assume?', a: 'Browsers default to 16px, but users and design systems can change it. The tool lets you set the root explicitly — converting against the real root of your project beats assuming the default.' },
      { q: 'Why prefer rem over px at all?', a: 'Accessibility and consistency: rem values scale when a user raises their base font size, while px stays fixed. Browsers also enforce minimum font sizes, which px-based layouts handle badly.' },
      { q: 'Does it convert both directions in one go?', a: 'Yes — paste a list and see px and rem side by side. Ideal when migrating a legacy px stylesheet to rem incrementally.' },
    ],
  },

  '/text-replacer': {
    intro: 'Find and replace across text in bulk, with regex and case-insensitive support — handy for logs, SQL and config fragments.',
    steps: [
      'Paste the original text into the source field',
      'Enter what to find and what to replace it with (leaving it empty deletes the matches)',
      'Tick "use regular expression" for regex; tick "ignore case" for case-insensitive matching',
      'Check the replacement count first to confirm the number of hits, then copy the result',
    ],
    notes: [
      'An invalid pattern makes the page report an invalid regular expression rather than producing a wrong result',
      'Without regex mode, symbols such as . * ( ) in the search field are treated as literal characters',
      '$1 and $& in the replacement text are not treated as capture group references and are written literally',
    ],
    example: { label: 'Fill in sample text', text: 'name=Alice; name=Bob; name=Carol' },
    about: 'Batch find-and-replace with plain or regular-expression matching, optional case-insensitivity and a match counter so you know exactly how many substitutions happened. For renaming repeated tokens across a config, normalising log lines, or any edit that would take fifty manual replaces.',
    faqs: [
      { q: 'Plain text or regex mode — which should I use?', a: 'Plain for literal strings (it treats . and * as themselves); regex when you need patterns, anchors or capture groups. The match counter is the fastest way to sanity-check that the pattern hits exactly what you expect.' },
      { q: 'Why does case-insensitive matching still surprise me?', a: 'Because it also matches variants you did not intend — "ID", "id" and "Id" all match "id". Use it deliberately, and check the counter before pasting the result anywhere.' },
      { q: 'Can I reference the matched text in the replacement?', a: 'In regex mode, capture groups in the pattern can be reused in the replacement (e.g. reordering "Last, First" to "First Last"). Plain mode replaces with a literal string only.' },
    ],
  },

  '/json-to-get-params': {
    intro: 'Converts between JSON and GET query parameters: flatten nested objects into a query string such as a[b][0]=c, or rebuild JSON from it.',
    steps: ['Choose the direction: JSON → GET params or GET params → JSON', 'Paste the JSON or the query string', 'Copy the converted result'],
    notes: [
      'Nesting levels and array indices are both expressed with square brackets, e.g. items[0][name]',
      'Fields whose value is null, an empty array or an empty object produce an empty value',
    ],
    example: { label: 'Fill in sample JSON', text: '{"a":1,"b":{"c":2},"list":[1,2]}' },
    about: 'HTML forms and many server frameworks encode structured data in the query string using bracket notation: a nested object { "b": { "c": 2 } } becomes b[c]=2, and an array { "list": [1, 2] } becomes list[0]=1&list[1]=2. This tool flattens JSON into that exact notation so you can drop a JSON payload straight into a URL, and parses a query string back into nested JSON when you receive one. It is the bridge between a clean JSON body and the bracket-encoded query strings that PHP, Express, Ruby on Rails and others expect.',
    faqs: [
      { q: 'How is nesting expressed in the query string?', a: 'With square brackets, mirroring JavaScript member access: { "a": { "b": [1] } } becomes a[b][0]=1. Each level of object nesting adds a bracketed key, and each array index adds a numeric bracket, so the structure is fully recoverable on the way back.' },
      { q: 'What happens to null or empty values?', a: 'They produce an empty value in the query string (key= with nothing after). That is the faithful representation — a query string cannot encode "absence" more precisely than an empty field — so when rebuilding JSON the value comes back as an empty string rather than null. Drop such keys before sending if the server is strict.' },
      { q: 'Is the output URL-encoded?', a: 'The tool shows the logical key=value pairs; special characters in keys or values should be percent-encoded before putting them in a real URL. Encode the values (not the brackets) so the bracket structure stays intact and the server parses it correctly.' },
    ],
  },

  '/json-to-code': {
    intro: 'Turns a JSON sample into entity class definitions for TypeScript / C# / Java / Go, sparing you from hand-writing fields off an API response.',
    steps: ['Enter the root class name — the name of the generated top-level type', 'Choose the target language', 'Paste a JSON object or array of objects', 'Copy the generated code'],
    notes: [
      'Field types are inferred from the sample values, not read from a schema',
      'Fields that are null in the sample cannot be typed and fall back to the language\'s generic type',
      'Providing a few realistic records (especially several array elements) yields a more complete field set',
      'The output is only a starting point — review field names and nullability against your own domain',
    ],
    about: 'When an API returns JSON but your codebase is statically typed, the first tedious step is writing a class or interface that mirrors the response. This tool reads a JSON sample and generates that scaffolding for you in TypeScript, C#, Java or Go: each object becomes a class with typed fields, nested objects become nested types, and arrays become lists or slices. Types are inferred from the actual values you paste — a number becomes the appropriate numeric type, a string stays a string — so a good sample with a few representative records produces a far more accurate starting point than an empty schema guess.',
    example: { label: 'Fill in a sample JSON', text: '{\n  "id": 1,\n  "name": "Alice",\n  "email": "alice@example.com",\n  "active": true\n}' },
    faqs: [
      { q: 'How are field types decided?', a: 'From the sample values, not a schema. A numeric value becomes the appropriate numeric type (the tool picks int/long/double per language), a string stays a string, and a boolean becomes bool. Mixed types across records are widened to the common supertype.' },
      { q: 'What if a field is null in my sample?', a: 'A null value carries no type information, so the field falls back to the language\'s generic/any type (object in C#, interface{} in Go, any in TypeScript). To type it correctly, include at least one record where that field has a concrete value.' },
      { q: 'Will the generated code match my API exactly?', a: 'No. It is a starting point derived from one sample, so field names follow the JSON keys and nullability is guessed. Review the names, make fields nullable where the API can omit them, and add validation — the generator removes the boilerplate, it does not replace your domain knowledge.' },
    ],
  },

  '/unit-converter': {
    intro: 'Converts across 11 categories of units, including traditional Chinese units such as jin, liang, mu, chi and li.',
    steps: ['Pick a category', 'Enter the value and pick the source unit from the dropdown', 'Copy the converted result — every unit in the category is listed at once'],
    notes: [
      'Time is calculated as 30 days per month and 365 days per year',
      'Data storage uses powers of 1024 (KB = 1024 bytes)',
      'Temperature uses conversion formulas rather than a shared coefficient',
    ],
    example: { label: 'Fill in a sample amount to convert', text: '100' },
    about: 'Convert across 11 unit categories — length, area, volume, weight, speed, time, data storage, power, pressure, angle and temperature — with one interface. The everyday answer to "how many GB is 4.7 GiB", "mph to km/h" and whether that 100 kB JSON is actually big.',
    faqs: [
      { q: 'What is the difference between kB and KiB?', a: 'kB is decimal (1 kB = 1000 B); KiB is binary (1 KiB = 1024 B). Storage vendors use decimal, operating systems often report binary, and the gap grows with size — hence "missing" disk space.' },
      { q: 'How precise are the conversions?', a: 'Factors use standard definitions (inch = 25.4 mm exactly, mile = 1.609344 km). For derived categories like speed, the calculation composes exact factors, so precision is limited by your input, not the table.' },
      { q: 'Why is temperature in its own category?', a: 'Because temperature conversion is not multiplication by a factor — it needs offsets (0 °C = 273.15 K). Treating it like a scaled unit is a classic bug, so it gets dedicated handling.' },
    ],
  },

  '/ascii-table': {
    intro: 'A reference for the standard ASCII table (0–127), listing the character alongside its decimal, hexadecimal, octal and binary forms, with a short description.',
    steps: ['Type a character (e.g. A) or a code value (e.g. 65, 0x41) in the search box', 'The list filters live', 'Compare against the bases listed for each row'],
    notes: ['Search matches the character, the description, and the decimal and hexadecimal values'],
    example: { label: 'Fill in a sample query', text: 'A' },
    about: 'The standard ASCII table from 0 to 127 with decimal, hexadecimal, octal and binary values side by side, searchable by character or by code. The quickest way to resolve "what is the hex for newline" or "which character is 0x7F" without opening a full Unicode reference.',
    faqs: [
      { q: 'Why does the table stop at 127?', a: 'Classic ASCII defines 128 codes (0–127). Values 128–255 belong to extended encodings like Latin-1, which vary by convention — for those, use the Unicode tool instead.' },
      { q: 'Which codes are the invisible control characters?', a: '0–31 plus 127 (DEL). They predate screens — BEL, CR, LF and TAB are the ones you still meet daily in logs and file formats.' },
      { q: 'What is the difference between 0x30 and the digit 0?', a: 'The character "0" has code 48 (0x30); the byte value 0 is the NUL terminator. Confusing the two is a classic C-string bug, which is exactly why this table shows both views at once.' },
    ],
  },

  '/http-headers': {
    intro: 'A reference for common HTTP request and response headers plus the nine standard request methods — to consult when writing APIs or debugging caching, CORS and method semantics.',
    steps: ['Type a field name (e.g. Cookie) or a purpose keyword (e.g. cache, CORS) in the search box', 'The header list filters live', 'Each entry shows the field name, direction (request / response) and a short description', 'Below the headers, the request-methods table lists each verb with its safe / idempotent flags'],
    notes: ['Search matches the field name, the description and the direction', 'The request-methods table is always shown under the header reference'],
    example: { label: 'Fill in a sample query', text: 'cache' },
    about: 'A searchable reference of common HTTP request and response headers, joined by a table of the standard request methods. Instead of digging through RFCs to remember what Strict-Transport-Security does, which direction a header travels, or whether PATCH is idempotent, search by name and read a focused description — with CORS, caching and security headers grouped for fast scanning, and GET/POST/PUT/PATCH/DELETE/OPTIONS marked by their safety and idempotency so you pick the right verb, not just the right header.',
    faqs: [
      { q: 'Which security headers should every site send?', a: 'The usual baseline is Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options: nosniff and a frame policy (X-Frame-Options or CSP frame-ancestors). Search each one here for what it does.' },
      { q: 'Which headers matter for CORS?', a: 'Requests trigger Origin; responses need Access-Control-Allow-Origin (plus Allow-Methods/Allow-Headers for preflights). The reference groups these so you can debug a blocked request quickly.' },
      { q: 'Which headers control caching?', a: 'Cache-Control is the primary switch, with ETag/If-None-Match and Last-Modified/If-Modified-Since driving conditional revalidation. Note that Cache-Control is sent by the server but also honoured by browsers and CDNs.' },
      { q: 'What is the difference between PUT and PATCH?', a: 'PUT replaces the whole resource, so it is idempotent — sending the same body again yields the same result. PATCH applies a partial update and is not necessarily idempotent; the server decides. The methods table on this page flags each verb as safe and/or idempotent.' },
    ],
  },

  '/linux-commands': {
    intro: 'A reference for common Linux commands covering files, text processing, processes and networking, each with an example you can adapt directly.',
    steps: ['Type a command (e.g. grep) or a scenario keyword (e.g. port, disk) in the search box', 'The list filters live', 'Adapt each example to your own paths and arguments'],
    notes: ['Search matches the command name, the description and the example command'],
    about: 'Most Linux knowledge is not syntax — it is remembering which of the hundred tools applies and which flags it takes. This reference groups the everyday commands by scenario (files and directories, text processing, processes, networking, permissions) and shows each one with a working example you can adapt, so looking up "how do I find what is listening on a port" lands you on ss with the right flags instead of a man page. The search box filters the list live and matches the command name, the description and the example command, which makes it work both ways: type grep when you know the tool, type port or disk when you only know the goal. Every entry is a starting point to adapt to your own paths and arguments — the reference teaches the pattern, not just the incantation.',
    faqs: [
      { q: 'Does the search match anything besides command names?', a: 'Yes. It matches the command name, the scenario description and the example command text. That means searching port finds ss -tlnp and lsof -i, and searching disk finds df and du, even when the command name itself contains neither word.' },
      { q: 'Are the examples safe to run as-is?', a: 'They are written to be read first, run second. Most are harmless, but some (like chmod or kill examples) contain placeholder arguments you should replace with your own values. The list adapts each example to your paths and arguments rather than pasting blindly.' },
      { q: 'Why is a command I know missing from the list?', a: 'The list covers the commands that come up in day-to-day server and shell work, curated rather than exhaustive. If a whole area feels missing, the scenario categories above the list are the intended navigation; for niche flags, the man page of the closest related command usually cross-references it.' },
    ],
    example: { label: 'Fill in a sample query', text: 'grep' },
  },

  '/whois-lookup': {
    intro: 'Looks up domain registration details: registrar, registration and expiry dates, and domain status. The data comes from RDAP, the official successor to WHOIS.',
    steps: ['Enter the domain (pasting a full URL works — only the host name is used)', 'Click lookup WHOIS or press enter', 'Copy the registration details'],
    notes: [
      'The lookup is made by this site\'s server-side endpoint, so it requires the site to be deployed; local development requests will fail',
      'The registration data is returned as the endpoint provides it; different suffixes (.com / .cn / .io …) vary in detail and may not all include an expiry date',
    ],
    example: { label: 'Fill in a sample domain', text: 'example.com' },
    about: 'Look up registration data for a domain — registrar, creation and expiry dates, status codes and nameservers — using RDAP, the official successor to classic WHOIS. RDAP returns structured, machine-readable responses instead of free-form text, so the results are consistent and easy to scan.',
    faqs: [
      { q: 'How is RDAP different from WHOIS?', a: 'Both answer the same questions, but RDAP uses standardised HTTP+JSON endpoints run by registries, replacing the fragmented plain-text WHOIS protocol. This tool speaks RDAP only, which keeps parsing reliable.' },
      { q: 'Why can some domains not be looked up?', a: 'RDAP coverage is still growing: some country-code registries do not yet expose an RDAP server, in which case the lookup fails even though the domain exists.' },
      { q: 'Why do I no longer see the owner\'s name and address?', a: 'GDPR and similar rules made registries redact personal contact data. You still get registrar, dates and status — the operational facts — but not private individuals\' details.' },
    ],
  },

  '/http-status-checker': {
    intro: 'Checks from the server side what HTTP status code and response headers a URL actually returns, to confirm what is really served in production.',
    steps: ['Enter the URL (https is assumed when no scheme is given)', 'Click check status or press enter', 'Read the colour-coded status and the response header list, which can be copied as a whole'],
    notes: [
      'The check runs from this site\'s server, so you see the result from the server\'s network environment, which may differ from a local curl (DNS cache, proxy, regional differences)',
      'The site must be deployed; local development requests will fail',
      'Status codes are coloured green for 2xx, orange for 3xx and red for 4xx / 5xx',
    ],
    example: { label: 'Fill in a sample URL', text: 'example.com' },
    about: 'Check a live URL and see the actual HTTP status code and response headers it returns right now — useful to tell "the site is down" from "the site redirects", to verify a cache purge, or to confirm a security header actually ships in production. Requests run through the DigDevBox API, so the result reflects a server-side fetch, not your local cache.',
    faqs: [
      { q: 'Why does the checker show a different result than my browser?', a: 'Browsers send cookies, Accept headers and cached responses. This tool makes a clean, cookie-less request, so what you see is closer to what a search-engine bot or a fresh visitor would get.' },
      { q: 'The site loads for me but returns 403 here — why?', a: 'Some firewalls block datacenter IPs or non-browser user agents. A 403 from the checker with a working browser often means bot protection, not a broken site.' },
      { q: 'Can I follow a redirect chain with it?', a: 'The tool reports the final status and headers after the server-side request completes, so permanent and temporary redirects are already resolved — check the response headers to see where you landed.' },
    ],
  },

  '/today-in-history': {
    intro: 'Lists events that happened on this day in history, loading today\'s content automatically when the page opens.',
    steps: ['The page loads automatically when opened', 'Click reload to fetch it again'],
    notes: ['The data comes from this site\'s server-side endpoint, so the site must be deployed; local development will fail to load'],
    about: 'See what happened on today\'s date in years past — events load automatically when the page opens, fetched live from the DigDevBox API. A small daily-knowledge ritual: open it with your morning coffee, or use it as an icebreaker source for standups and classrooms.',
    faqs: [
      { q: 'Where does the event data come from?', a: 'From a curated historical-events dataset served through the site\'s own API, so the page shows fresh, structured entries rather than a static list frozen at build time.' },
      { q: 'Why do events not cover every year evenly?', a: 'Coverage reflects the source dataset\'s editorial depth — modern and Western-centric events are denser. Treat it as a browsing delight, not a complete historical index.' },
      { q: 'Does the page need a network connection?', a: 'Yes — events are fetched live when the page opens. If the request fails, the page tells you rather than showing stale data.' },
    ],
  },
};
