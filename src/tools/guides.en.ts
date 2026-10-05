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
    example: { label: 'Fill in sample text', text: 'DevBox' },
  },

  '/base-converter': {
    intro: 'Converts the same number between decimal, hexadecimal, binary, octal and even base64 — useful when debugging bitwise logic and protocol fields.',
    steps: ['Enter the number in any of the base fields', 'The other bases update automatically', 'Copy the result you need from its field'],
    notes: ['This converts numbers, not text. To convert text, use "Text to ASCII Binary" instead'],
    example: { label: 'Fill in a sample number', text: '255' },
  },

  '/base64-file-converter': {
    intro: 'Encodes a file (image, PDF, …) into a Base64 string so it can be inlined into HTML/CSS or an API payload.',
    steps: ['Click the upload area to pick a file, or drag one in', 'The Base64 string appears on the right', 'Copy it; enable the data-URI option if that is the form you need'],
    notes: ['Base64 inflates the size by roughly a third, so inline large files with care'],
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
  },

  '/basic-auth-generator': {
    intro: 'Builds the HTTP Basic Authorization header from a username and password, ready to paste into an API request.',
    steps: ['Enter the username', 'Enter the password', 'Copy the generated Authorization header'],
    notes: ['Basic auth only Base64-encodes the credentials, so it must always be used over HTTPS'],
    example: { label: 'Fill in a sample username', text: 'admin' },
  },

  '/bcrypt': {
    intro: 'Hashes a password with bcrypt, or verifies that a plaintext password matches an existing hash — the standard approach for storing credentials.',
    steps: ['Enter the plaintext password', 'Click generate to get the hash', 'To verify, put the hash in its field, enter the plaintext, then compare'],
    notes: [
      'bcrypt is a hash, not encryption: it is irreversible, there is no "decrypt"',
      'A higher cost is slower and more secure; 10–12 is typical in production',
      'The same plaintext produces a different hash every time — that is expected (random salt)',
    ],
    example: { label: 'Fill in a sample password', text: 'MyP@ssw0rd' },
  },

  '/benchmark-builder': {
    intro: 'Times several code snippets side by side to see quickly which implementation is faster.',
    steps: ['Add the implementations you want to compare', 'Click run', 'Read the per-snippet timings and relative ratios'],
    notes: ['Browser-side timing is affected by machine load — avoid drawing conclusions from differences under ~10%'],
  },

  '/bip39-generator': {
    intro: 'Generates or validates BIP39 mnemonic phrases, and derives the seed from a mnemonic. Useful for wallets and key management.',
    steps: ['Choose the mnemonic length (12 words is common)', 'Click generate to get the phrase', 'With an existing phrase, paste it in to validate and derive the seed'],
    notes: ['A mnemonic is equivalent to a private key: store it offline and never leave it in an online tool'],
  },

  '/camera-recorder': {
    intro: 'Takes a photo or records a short video with your camera — a quick way to check a device works or capture throwaway footage.',
    steps: ['Click start and allow the browser permission prompt', 'Take a photo or start recording', 'Download the result when you are done'],
    notes: ['Browsers only allow camera access over HTTPS', 'Everything is processed locally and never uploaded'],
  },

  '/case-converter': {
    intro: 'Changes case in bulk and converts between naming styles such as camelCase, snake_case and kebab-case — a time saver for API fields and constants.',
    steps: ['Paste the original text', 'Pick the target style below', 'Copy the result'],
    example: { label: 'Fill in sample text', text: 'hello world example' },
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
  },

  '/chronometer': {
    intro: 'A clean stopwatch/timer for measuring elapsed time or running pomodoro sessions.',
    steps: ['Click start', 'Click lap to record split times', 'Click stop to see the total duration'],
  },

  '/color-converter': {
    intro: 'Converts between HEX, RGB, HSL and CSS colour names — useful when editing a design or tuning a theme.',
    steps: ['Type a value in any format, or use the colour picker', 'The other formats update automatically', 'Copy the one you need'],
    example: { label: 'Fill in a sample colour', text: '#ff6600' },
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
  },

  '/date-converter': {
    intro: 'Converts a time to a Unix timestamp or turns a timestamp back into a readable time, with several output formats.',
    steps: ['Use the current time or enter one manually', 'Read the Unix timestamp and the formatted results', 'Note whether you need seconds or milliseconds'],
    notes: ['Unix timestamps are usually seconds (10 digits), while JavaScript Date.now() is milliseconds (13 digits)'],
  },

  '/device-information': {
    intro: 'Shows the current device screen size, pixel ratio, User-Agent and more — useful evidence when debugging compatibility issues.',
    steps: ['Open the page to see all the information', 'Copy the fields you need'],
  },

  '/docker-run-to-docker-compose-converter': {
    intro: 'Turns a long docker run command into a docker-compose.yml, saving you from writing the compose file by hand.',
    steps: ['Paste the docker run command', 'The compose snippet is generated on the right', 'Check the port mappings and volume mounts before copying'],
    notes: ['Automatic conversion covers the common flags; health checks, network aliases and similar need to be added by hand'],
    example: { label: 'Fill in a sample command', text: 'docker run -d --name web -p 8080:80 -v /data:/usr/share/nginx/html nginx:latest' },
  },

  '/email-normalizer': {
    intro: 'Normalises email addresses into a standard form — useful for de-duplication, cleaning data or matching accounts.',
    steps: ['Paste one or more email addresses', 'Read the normalised results', 'Apply the rules you need for + tags, casing, dots, etc.'],
    notes: ['Gmail\'s dot and + tag rules differ between providers; confirm your own policy before de-duplicating'],
    example: { label: 'Fill in a sample email', text: 'John.Doe+news@Gmail.com' },
  },

  '/emoji-picker': {
    intro: 'Search and copy emoji, and look up their Unicode code points.',
    steps: ['Type a keyword in the search box (e.g. smile)', 'Click the emoji you need', 'Copy the character or its Unicode encoding'],
  },

  '/encryption': {
    intro: 'Encrypts and decrypts text with symmetric algorithms such as AES, TripleDES, Rabbit and RC4.',
    steps: ['Enter the text to encrypt', 'Set a key', 'Pick an algorithm and click encrypt; to decrypt, enter the ciphertext with the same key and click decrypt'],
    notes: [
      'If you lose the key you cannot recover the data — save it first',
      'Algorithms and modes are not interchangeable: decryption must use exactly the same settings as encryption',
    ],
    example: { label: 'Fill in sample text', text: 'This is a message to encrypt' },
  },

  '/eta-calculator': {
    intro: 'Estimates when a task will finish based on current progress — a clear way to see how much longer a download or batch job needs.',
    steps: ['Enter the amount completed', 'Enter the total amount', 'Read the estimated completion time'],
  },

  '/git-memo': {
    intro: 'A cheat sheet of common Git commands for when you have forgotten the exact flags.',
    steps: ['Find the scenario by category', 'Copy the command', 'Replace the placeholders with your own branch or file names'],
  },

  '/hash-text': {
    intro: 'Computes MD5, SHA1, SHA256 and other hashes of text — for verifying file integrity or producing digests.',
    steps: ['Paste the text', 'Choose the algorithm in the result area', 'Copy the corresponding digest'],
    notes: ['MD5 and SHA1 are no longer collision-resistant; do not use them for passwords or signatures'],
    example: { label: 'Fill in sample text', text: 'hello world' },
  },

  '/hmac-generator': {
    intro: 'Computes an HMAC from a key and a hash function, for API signing and verifying a message origin.',
    steps: ['Enter the message', 'Enter the key', 'Choose a hash algorithm to get the HMAC'],
    notes: ['HMAC depends on the key: a different key gives a completely different result, so both sides must agree on it'],
    example: { label: 'Fill in a sample message', text: 'hello world' },
  },

  '/html-entities': {
    intro: 'Converts characters such as <, > and & into HTML entities, or reverses the process — used to insert text into a page safely.',
    steps: ['Paste the original text', 'Click escape or unescape', 'Copy the result'],
    example: { label: 'Fill in sample text', text: '<div class="box">Hello & "World"</div>' },
  },

  '/html-wysiwyg-editor': {
    intro: 'A WYSIWYG rich-text editor whose HTML source you can grab once you are done editing.',
    steps: ['Type or paste into the editing area', 'Use the toolbar to adjust formatting', 'Switch to the source view and copy the HTML'],
    example: { label: 'Fill in sample content', text: '<h2>Heading</h2><p>This is the body text, try <strong>bold</strong>.</p>' },
  },

  '/http-status-codes': {
    intro: 'A reference for the meaning of every HTTP status code, for when you hit an unfamiliar one.',
    steps: ['Find the code by category or search', 'Read its official name and the usual scenario'],
  },

  '/iban-validator-and-parser': {
    intro: 'Validates an IBAN bank account number and breaks it down into country, check digits and BBAN.',
    steps: ['Enter the IBAN (spaces are fine)', 'Read the validation result', 'Read the parsed country code and account parts below'],
    notes: ['An IBAN carries its own check digits, so a malformed one is rejected outright — first check you did not mistype it'],
    example: { label: 'Fill in a sample IBAN', text: 'DE89 3704 0044 0532 0130 00' },
  },

  '/ipv4-address-converter': {
    intro: 'Converts an IPv4 address into decimal, binary and hexadecimal forms — useful when writing scripts or reading packet dumps.',
    steps: ['Enter the IPv4 address', 'Read the results in each base', 'Copy the format you need'],
    example: { label: 'Fill in a sample address', text: '192.168.1.1' },
  },

  '/ipv4-range-expander': {
    intro: 'Given a start and end IP, computes the minimal list of CIDR blocks covering that range — very practical when tidying firewall rules.',
    steps: ['Enter the start IP', 'Enter the end IP', 'Read the generated CIDR list'],
    notes: ['If the range is not a contiguous block it is split into several CIDRs — that is expected'],
  },

  '/ipv4-subnet-calculator': {
    intro: 'Parses a CIDR network and works out the full set of details: usable hosts, first and last address, mask and more.',
    steps: ['Enter the CIDR (e.g. 192.168.1.0/24)', 'Read the results below', 'Copy whichever field you need'],
    notes: ['The network address and broadcast address normally cannot be assigned to a host'],
    example: { label: 'Fill in a sample network', text: '192.168.1.0/24' },
  },

  '/ipv6-ula-generator': {
    intro: 'Generates an IPv6 Unique Local Address (ULA) prefix per RFC 4193 for local networks — handy for addressing internal devices.',
    steps: ['Click generate to get a prefix', 'Combine it with a subnet and interface ID as needed', 'Copy and use it'],
    notes: ['A ULA is the IPv6 counterpart of a private IPv4 range and must not be routed on the public internet'],
  },

  '/json-diff': {
    intro: 'Compares two JSON documents and highlights the differences — makes config changes or API response drift obvious.',
    steps: ['Paste the original JSON on the left', 'Paste the new JSON on the right', 'Review the highlighted additions, removals and changes'],
    notes: ['Key order does not affect the comparison, but array order does'],
    example: { label: 'Fill in sample JSON', text: '{ "name": "DevBox", "version": 1, "tags": ["a", "b"] }' },
  },

  '/json-minify': {
    intro: 'Strips the whitespace and newlines out of JSON, compressing it onto one line to save transfer size.',
    steps: ['Paste the formatted JSON', 'Get the minified result', 'Copy and use it'],
    example: { label: 'Fill in sample JSON', text: '{\n  "name": "DevBox",\n  "list": [1, 2, 3]\n}' },
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
  },

  '/json-to-csv': {
    intro: 'Converts a JSON array into a CSV table for Excel or a data-analysis tool.',
    steps: ['Paste the JSON array', 'Check the auto-detected column headers', 'Copy or download the CSV'],
    notes: ['Nested objects are flattened or stringified; for deeply structured JSON it helps to tidy it first'],
    example: { label: 'Fill in sample JSON', text: '[\n  { "id": 1, "name": "Alice", "score": 92 },\n  { "id": 2, "name": "Bob", "score": 88 }\n]' },
  },

  '/json-to-toml': {
    intro: 'Converts JSON into TOML, a common format for configuration files.',
    steps: ['Paste the JSON', 'Get the TOML result', 'Copy and use it'],
    example: { label: 'Fill in sample JSON', text: '{ "title": "demo", "server": { "port": 8080 } }' },
  },

  '/json-to-xml': {
    intro: 'Converts JSON into XML, for integrating with older systems that only accept XML.',
    steps: ['Paste the JSON', 'Get the XML result', 'Copy and use it'],
    notes: ['XML has no concept of arrays, so lists become repeated tags'],
    example: { label: 'Fill in sample JSON', text: '{ "user": { "id": 1, "name": "Alice" } }' },
  },

  '/json-to-yaml-converter': {
    intro: 'Converts JSON into YAML, widely used for Kubernetes manifests and other configuration files.',
    steps: ['Paste the JSON', 'Get the YAML result', 'Copy and use it'],
    example: { label: 'Fill in sample JSON', text: '{ "name": "devbox", "services": ["web", "api"] }' },
  },

  '/jwt-parser': {
    intro: 'Decodes a JWT so you can read the header, payload and signature sections directly.',
    steps: ['Paste the token', 'Read the three decoded sections', 'Check claims such as the expiry time'],
    notes: [
      'This only decodes, it does not verify — you cannot tell from here whether the token was tampered with',
      'The payload is plain Base64, so never put sensitive data in it',
    ],
    example: { label: 'Fill in a sample token', text: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IllRSCIsImlhdCI6MTUxNjIzOTAyMn0.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ' },
  },

  '/keycode-info': {
    intro: 'Press any key to see its keyCode, code, location and other details — useful when wiring up keyboard shortcuts.',
    steps: ['Focus the page', 'Press the key you want to inspect', 'Read the details shown below'],
    notes: ['keyCode is deprecated; prefer event.code or event.key in new code'],
  },

  '/list-converter': {
    intro: 'Sorts, de-duplicates, adds prefixes/suffixes and reverses multi-line text in one go — a big time saver when tidying data.',
    steps: ['Paste the data, one item per line', 'Tick or select the operations you need', 'Copy the processed result'],
    example: { label: 'Fill in a sample list', text: 'banana\napple\ncherry\napple' },
  },

  '/lorem-ipsum-generator': {
    intro: 'Generates placeholder text to fill out layouts and visual mockups.',
    steps: ['Choose paragraphs or a word count', 'Click generate', 'Copy the text'],
  },

  '/mac-address-generator': {
    intro: 'Generates MAC addresses in bulk for testing network gear or fabricating test data.',
    steps: ['Enter how many you need', 'Add a prefix if required', 'Click generate and copy'],
  },

  '/mac-address-lookup': {
    intro: 'Looks up the vendor behind a MAC address — useful for identifying unknown devices on a network.',
    steps: ['Enter the MAC address', 'Click look up', 'Read the vendor information'],
    notes: ['The first 24 bits identify the vendor and the last 24 can be rewritten, so this locates a vendor, not a device'],
    example: { label: 'Fill in a sample MAC', text: '00:1A:2B:3C:4D:5E' },
  },

  '/markdown-to-html': {
    intro: 'Converts Markdown into HTML, for writing docs or generating page content.',
    steps: ['Write or paste Markdown on the left', 'The right side previews it live and shows the HTML', 'Copy the HTML, or click print to save it as a PDF'],
    example: { label: 'Fill in sample Markdown', text: '# Heading\n\nThis is a **bold** paragraph.\n\n- First item\n- Second item\n\n[Link](https://digdevbox.com)' },
  },

  '/math-evaluator': {
    intro: 'Evaluates mathematical expressions with functions such as sqrt, sin, cos and abs — handier than a system calculator.',
    steps: ['Type the expression', 'The result updates live, or after you click evaluate', 'For long expressions, verifying the steps separately is worthwhile'],
    example: { label: 'Fill in a sample expression', text: 'sqrt(16) + 3 * (2 + 4)' },
  },

  '/mime-types': {
    intro: 'Looks up MIME types and file extensions from one another — useful when configuring a server or writing upload validation.',
    steps: ['Enter a MIME type or an extension', 'Read the corresponding form', 'Copy and use it'],
    example: { label: 'Fill in a sample type', text: 'application/json' },
  },

  '/numeronym-generator': {
    intro: 'Builds numeronyms such as i18n and k8s — first letter, letter count, last letter.',
    steps: ['Enter a long word', 'Get its numeronym', 'Copy and use it'],
    example: { label: 'Fill in a sample word', text: 'internationalization' },
  },

  '/og-meta-generator': {
    intro: 'Generates Open Graph and social-platform meta tags for share cards.',
    steps: ['Enter the title, description, image URL and link', 'Click generate', 'Paste the resulting meta tags into your page head'],
    notes: ['Platforms cache share cards, so you may need their debug tool to refresh the cache after a change'],
  },

  '/otp-generator': {
    intro: 'Generates and verifies time-based one-time passwords (TOTP) for two-factor authentication setups.',
    steps: ['Enter the secret (Base32)', 'Click generate to get the current code', 'To verify, enter the code the other party provided and compare'],
    notes: ['TOTP depends on the device clock — too large a time difference makes codes fail to match indefinitely'],
  },

  '/password-strength-analyser': {
    intro: 'Estimates password strength and approximate cracking time, to judge whether a password is good enough.',
    steps: ['Enter the password to evaluate', 'Read the strength bar and estimated cracking time', 'Lengthen it or add character classes as suggested'],
    notes: ['The calculation runs entirely in your browser; the password is never sent anywhere'],
    example: { label: 'Fill in a sample password', text: 'MyP@ssw0rd2024' },
  },

  '/pdf-signature-checker': {
    intro: 'Checks whether a PDF carries a digital signature and whether that signature is valid.',
    steps: ['Choose or drag in a PDF file', 'Wait for it to be parsed', 'Read the number of signatures and the verification result'],
    notes: ['Having a signature only means a signature field exists — trustworthiness also depends on the certificate chain'],
  },

  '/percentage-calculator': {
    intro: 'Computes percentages between two numbers, percentage increases or decreases, or works backwards from a percentage.',
    steps: ['Pick the mode matching your question', 'Enter the known values', 'Read the result'],
  },

  '/phone-parser-and-formatter': {
    intro: 'Parses a phone number, identifying the country code, area code and number type, and formats it to a standard form.',
    steps: ['Enter the phone number (including the country code improves accuracy)', 'Read the parsed details', 'Copy the formatted number'],
    notes: ['A number without a country code can only be parsed against a default region and is easily misidentified'],
    example: { label: 'Fill in a sample number', text: '+86 138 0013 8000' },
  },

  '/qrcode-generator': {
    intro: 'Turns text or a link into a QR code, with customisable colours and size, ready to download.',
    steps: ['Enter what to encode (a URL or any text)', 'Adjust the foreground colour, background colour and size as needed', 'Click download to save the image'],
    notes: ['Longer content makes a denser code; if it will not scan, shorten the content or increase the size'],
    example: { label: 'Fill in a sample link', text: 'https://digdevbox.com' },
  },

  '/random-port-generator': {
    intro: 'Generates a random port number above 1024, for starting local services or writing tests.',
    steps: ['Click generate to get a port', 'Copy and use it', 'Generate again if you need several'],
  },

  '/regex-memo': {
    intro: 'A cheat sheet of common regular expressions for when you have forgotten the syntax.',
    steps: ['Find the syntax you need by category', 'Copy the fragment', 'Verify it in the Regex Tester'],
  },

  '/regex-tester': {
    intro: 'Tests regular expression matches live, so you can verify as you write.',
    steps: ['Write the pattern in the top field (without the surrounding slashes)', 'Enter the text to match in the bottom field', 'Review the highlighted matches and capture groups'],
    notes: ['Add the g flag for global matching, otherwise only the first match is reported'],
    example: { label: 'Fill in a sample pattern', text: '\\d{3}-\\d{4}' },
  },

  '/roman-numeral-converter': {
    intro: 'Converts between Roman numerals and Arabic numbers — useful for ordinals and copyright years.',
    steps: ['Enter a number or a Roman numeral on either side', 'The other side updates automatically', 'Copy and use it'],
    example: { label: 'Fill in a sample number', text: '2024' },
  },

  '/rsa-key-pair-generator': {
    intro: 'Generates an RSA public/private key pair in PEM format, for encrypted transport or signature verification.',
    steps: ['Choose the key length (2048 bits and up)', 'Click generate', 'Save the private and public keys separately'],
    notes: ['A lost private key cannot be recovered, so store it safely — and never commit it to a repository'],
  },

  '/safelink-decoder': {
    intro: 'Recovers the real link hidden behind an Outlook SafeLink wrapper.',
    steps: ['Copy the very long SafeLink URL from the email', 'Paste it into the input', 'Click decode to get the original URL'],
    notes: ['Decoding only reveals the address — you still have to judge for yourself whether it is trustworthy'],
  },

  '/slugify-string': {
    intro: 'Turns a title or filename into a slug containing only lowercase letters, digits and hyphens, for URLs and file naming.',
    steps: ['Enter the original string', 'Read the generated slug', 'Copy and use it'],
    notes: ['Input longer than 100,000 characters is rejected outright — slug generation is skipped rather than blocking the page', 'Non-ASCII text is transliterated or handled by rule; English words make the best slugs'],
    example: { label: 'Fill in sample text', text: 'Hello World! 你好 2026' },
  },

  '/sql-prettify': {
    intro: 'Formats SQL that is crammed onto one line into a clearly indented structure — very useful for reading slow-query logs.',
    steps: ['Paste the SQL', 'Pick a dialect (optional)', 'Copy the formatted result'],
    example: { label: 'Fill in sample SQL', text: 'select id,name,created_at from users where status=1 order by created_at desc limit 10' },
  },

  '/string-obfuscator': {
    intro: 'Masks part of a string by rule — for showing order numbers or tokens while protecting the content.',
    steps: ['Enter the original string', 'Set how many leading and trailing characters to keep', 'Copy the masked result'],
    notes: ['This is display-level masking, not encryption. Do not rely on it to protect genuinely sensitive data'],
    example: { label: 'Fill in a sample string', text: 'my-secret-token-123456' },
  },

  '/svg-placeholder-generator': {
    intro: 'Generates an SVG placeholder of a given size — faster and more reliable than an external placeholder service when building skeleton screens.',
    steps: ['Enter the width and height', 'Set the text and colours as needed', 'Copy the SVG or its data URI'],
  },

  '/temperature-converter': {
    intro: 'Converts between Celsius, Fahrenheit, Kelvin and other temperature scales.',
    steps: ['Enter a value on any scale', 'The other scales update automatically', 'Copy the result you need'],
  },

  '/text-diff': {
    intro: 'Compares two blocks of text line by line to see exactly what changed.',
    steps: ['Paste the original text on the left', 'Paste the new text on the right', 'Review the highlighted additions and removals'],
    example: { label: 'Fill in sample text', text: 'First line\nSecond line\nThird line' },
  },

  '/text-statistics': {
    intro: 'Counts characters, words and byte size — useful when writing copy or checking an API limit.',
    steps: ['Paste the text', 'Read the statistics', 'Cross-check the byte count against the limit where relevant'],
    notes: ['In UTF-8 a CJK character is about 3 bytes, so the byte count differs from the character count'],
    example: { label: 'Fill in sample text', text: 'The quick brown fox jumps over the lazy dog.' },
  },

  '/text-to-binary': {
    intro: 'Converts text to and from ASCII binary — for inspecting low-level representations or teaching.',
    steps: ['Enter the text or the binary', 'The other side updates automatically', 'Copy and use it'],
    notes: ['Binary is grouped in 8-bit blocks; spaces between them are tolerated'],
    example: { label: 'Fill in sample text', text: 'Hi' },
  },

  '/text-to-nato-alphabet': {
    intro: 'Turns text into the NATO phonetic alphabet, so spelling something out over the phone is not misheard.',
    steps: ['Enter the text', 'Read the corresponding words', 'Copy them, or just read them out'],
    example: { label: 'Fill in sample text', text: 'SOS' },
  },

  '/text-to-unicode': {
    intro: 'Converts text to and from Unicode code points — useful for tracking down mojibake or writing escape sequences.',
    steps: ['Enter the text or the code point sequence', 'The other side shows the converted result', 'Copy and use it'],
    example: { label: 'Fill in sample text', text: 'Hello 你好' },
  },

  '/token-generator': {
    intro: 'Generates a random string from a chosen character set — for temporary passwords and invite codes.',
    steps: ['Set the length', 'Tick the character classes you need', 'Click generate and copy'],
    notes: ['This uses a regular random number generator; for security-sensitive cases use the platform cryptographic source'],
  },

  '/toml-to-json': {
    intro: 'Converts TOML configuration into JSON, so it can be consumed in code or over an API.',
    steps: ['Paste the TOML', 'Get the JSON result', 'Copy and use it'],
    example: { label: 'Fill in sample TOML', text: 'title = "demo"\n\n[server]\nport = 8080' },
  },

  '/toml-to-yaml': {
    intro: 'Converts TOML configuration into YAML, for migrating between configuration formats.',
    steps: ['Paste the TOML', 'Get the YAML result', 'Copy and use it'],
    example: { label: 'Fill in sample TOML', text: 'title = "demo"\n\n[server]\nport = 8080' },
  },

  '/ulid-generator': {
    intro: 'Generates ULIDs: unique like a UUID, but sortable by time — friendlier as a database primary key.',
    steps: ['Click generate to get a ULID', 'Generate repeatedly for more', 'Copy and use it'],
  },

  '/url-encoder': {
    intro: 'Encodes a string into percent-encoded form, or decodes it back — avoids the classic pitfalls when building query strings.',
    steps: ['Paste the raw or already-encoded string', 'Click encode or decode', 'Copy the result'],
    notes: ['Encoding a whole URL also escapes the :// — normally you should only encode the parameter values'],
    example: { label: 'Fill in sample text', text: 'https://example.com/search?q=hello world&page=1' },
  },

  '/url-parser': {
    intro: 'Breaks a URL down into its scheme, host, port, path and query parameters.',
    steps: ['Paste the full URL', 'Read the parsed fields', 'Query parameters are listed as a table for easy copying'],
    example: { label: 'Fill in a sample URL', text: 'https://user:pass@example.com:8443/path/to/page?a=1&b=2#section' },
  },

  '/user-agent-parser': {
    intro: 'Identifies the browser, engine, operating system and device type from a User-Agent string.',
    steps: ['Paste a UA string, or fill in the current browser in one click', 'Read the parsed information', 'Copy the fields you need'],
    notes: ['A UA string can be forged, so it suits statistics and display but never security decisions'],
    example: { label: 'Fill in a sample UA', text: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' },
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
  },

  '/wifi-qrcode-generator': {
    intro: 'Generates a Wi-Fi QR code so guests can join the network by scanning instead of typing the password.',
    steps: ['Enter the network name (SSID)', 'Enter the password and pick the security type', 'Generate, then scan or download'],
    notes: ['The QR code contains the password in plain form — be careful about posting it in public places'],
  },

  '/xml-formatter': {
    intro: 'Formats XML that has been compressed onto one line into an indented structure — very useful when reading API payloads.',
    steps: ['Paste the XML', 'Click format', 'Copy the result'],
    example: { label: 'Fill in sample XML', text: '<root><user id="1"><name>Alice</name></user></root>' },
  },

  '/xml-to-json': {
    intro: 'Converts XML into JSON for integrating with modern APIs.',
    steps: ['Paste the XML', 'Get the JSON result', 'Copy and use it'],
    notes: ['XML attributes and text nodes are represented by different fields in JSON — check the output after converting'],
    example: { label: 'Fill in sample XML', text: '<user id="1"><name>Alice</name></user>' },
  },

  '/yaml-prettify': {
    intro: 'Formats YAML so the indentation is consistent and easy to read and debug.',
    steps: ['Paste the YAML', 'Click format', 'Copy the result'],
    notes: ['YAML expresses hierarchy through indentation, and only spaces work — never tabs'],
    example: { label: 'Fill in sample YAML', text: 'name: devbox\nservices:\n- web\n- api' },
  },

  '/yaml-to-json-converter': {
    intro: 'Converts YAML into JSON, a common step when handling configuration files or API data.',
    steps: ['Paste the YAML', 'Get the JSON result', 'Copy and use it'],
    example: { label: 'Fill in sample YAML', text: 'name: devbox\nservices:\n  - web\n  - api' },
  },

  '/yaml-to-toml': {
    intro: 'Converts YAML into TOML format, for configuration migrations.',
    steps: ['Paste the YAML', 'Get the TOML result', 'Copy and use it'],
    example: { label: 'Fill in sample YAML', text: 'title: demo\nserver:\n  port: 8080' },
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
  },

  '/rmb-uppercase': {
    intro: 'Converts an amount into the uppercase Chinese numerals required on invoices and expense forms, so you do not miscount the places by hand.',
    steps: ['Enter the amount', 'Tick the RMB prefix and the 元/圆 wording as needed', 'Copy the uppercase Chinese result'],
    notes: ['Grouping units go up to trillions; double-check the result for unusually large amounts'],
    example: { label: 'Fill in a sample amount', text: '1409.05' },
  },

  '/fullwidth-converter': {
    intro: 'Converts characters between full-width and half-width forms, cleaning up full-width letters, digits or punctuation that crept into mixed CJK/Latin text.',
    steps: ['Paste the text to process', 'Pick a conversion mode: half-width → full-width, full-width → half-width, or punctuation only', 'Copy the converted result'],
    notes: [
      'Punctuation-only mode leaves letters and digits alone and replaces punctuation per the mapping table',
      'Half-width and full-width spaces (U+3000) are both converted',
    ],
    example: { label: 'Fill in sample text', text: 'ＡＢＣ１２３，全角标点。' },
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
  },

  '/px-rem-converter': {
    intro: 'Converts between px and rem in bulk against a root font size — for tuning responsive typography and spacing.',
    steps: [
      'Set the root font size — the font-size of the page html, 16px by default; adjust the decimal places as needed',
      'Choose the direction: px → rem or rem → px',
      'Enter the values (separated by spaces, commas or newlines; px and rem units are accepted)',
      'Copy the result. The relationship is rem = px ÷ root font size',
    ],
    notes: ['A wrong root font size shifts every result, so keep it in sync when you change the design baseline'],
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
  },

  '/json-to-get-params': {
    intro: 'Converts between JSON and GET query parameters: flatten nested objects into a query string such as a[b][0]=c, or rebuild JSON from it.',
    steps: ['Choose the direction: JSON → GET params or GET params → JSON', 'Paste the JSON or the query string', 'Copy the converted result'],
    notes: [
      'Nesting levels and array indices are both expressed with square brackets, e.g. items[0][name]',
      'Fields whose value is null, an empty array or an empty object produce an empty value',
    ],
    example: { label: 'Fill in sample JSON', text: '{"a":1,"b":{"c":2},"list":[1,2]}' },
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
  },

  '/unit-converter': {
    intro: 'Converts across 11 categories of units, including traditional Chinese units such as jin, liang, mu, chi and li.',
    steps: ['Pick a category', 'Enter the value and pick the source unit from the dropdown', 'Copy the converted result — every unit in the category is listed at once'],
    notes: [
      'Time is calculated as 30 days per month and 365 days per year',
      'Data storage uses powers of 1024 (KB = 1024 bytes)',
      'Temperature uses conversion formulas rather than a shared coefficient',
    ],
  },

  '/ascii-table': {
    intro: 'A reference for the standard ASCII table (0–127), listing the character alongside its decimal, hexadecimal, octal and binary forms, with a short description.',
    steps: ['Type a character (e.g. A) or a code value (e.g. 65, 0x41) in the search box', 'The list filters live', 'Compare against the bases listed for each row'],
    notes: ['Search matches the character, the description, and the decimal and hexadecimal values'],
    example: { label: 'Fill in a sample query', text: 'A' },
  },

  '/http-headers': {
    intro: 'A reference for common HTTP request and response headers — to consult when writing APIs or debugging caching and CORS.',
    steps: ['Type a field name (e.g. Cookie) or a purpose keyword (e.g. cache, CORS) in the search box', 'The list filters live', 'Each entry shows the field name, direction (request / response) and a short description'],
    notes: ['Search matches the field name, the description and the direction'],
    example: { label: 'Fill in a sample query', text: 'cache' },
  },

  '/linux-commands': {
    intro: 'A reference for common Linux commands covering files, text processing, processes and networking, each with an example you can adapt directly.',
    steps: ['Type a command (e.g. grep) or a scenario keyword (e.g. port, disk) in the search box', 'The list filters live', 'Adapt each example to your own paths and arguments'],
    notes: ['Search matches the command name, the description and the example command'],
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
  },

  '/today-in-history': {
    intro: 'Lists events that happened on this day in history, loading today\'s content automatically when the page opens.',
    steps: ['The page loads automatically when opened', 'Click reload to fetch it again'],
    notes: ['The data comes from this site\'s server-side endpoint, so the site must be deployed; local development will fail to load'],
  },
};
