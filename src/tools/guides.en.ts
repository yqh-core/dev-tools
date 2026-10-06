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
    about: 'Base64 and files meet in both directions here. Paste a Base64 string — a full data URI or a bare payload — and the tool rebuilds the original file: common types (PNG, JPEG, GIF, PDF) are recognised from their signatures, the extension field fills itself in, images can be previewed inline, and Download saves the result under the name you choose. The other way around, drop or pick a file and its Base64 string appears below, ready to copy. Both conversions run in your browser, so the practical limit is memory: comfortable for images and documents, less so for large videos.',
    faqs: [
      { q: 'Why did the Extension field fill itself in?', a: 'When your input starts with a data URI prefix or matches a known signature (PNG, JPEG, GIF, PDF), the tool infers the file type and sets the extension for you. Unknown types keep whatever you typed — edit the field manually if the guess is wrong.' },
      { q: 'How do I get the Base64 string of a file?', a: 'Use the File to Base64 card: drag a file onto the upload area or click to select one, and the string appears in the readonly box below. The Copy button puts it on your clipboard.' },
      { q: 'Is there a file size limit?', a: 'Nothing is enforced, but the conversion happens in browser memory. Images and documents are comfortable; very large files can get slow or hit memory limits — and remember the Base64 text is about a third larger than the original file.' },
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
    example: { label: 'Paste a sample date', text: '2026-10-05T08:00:00Z' },
    about: 'A date is one moment wearing many coats, and this tool converts between them: Unix timestamps (seconds or milliseconds), ISO 8601, RFC 3339, UTC strings and locale-formatted strings. Where a format does not state a timezone, your browser\'s local zone is applied — so "now" on this page is the same moment your logs call a different name. The everyday uses: turning a timestamp from a log line into readable local time, checking whether an expiry (a JWT exp, an ISO field from a database) is already in the past, and generating timestamp values for test fixtures.',
    faqs: [
      { q: 'Is my timestamp in seconds or milliseconds?', a: 'Count the digits: 10 digits is seconds (good until the year 2286), 13 digits is milliseconds. Pasting seconds where milliseconds are expected lands you centuries in the future — the wrong scale is usually obvious as soon as you convert.' },
      { q: 'Why does the converted time shift by hours?', a: 'Timezone interpretation. ISO strings like 2026-10-05T08:00:00Z name an exact moment (Z = UTC), but "2026-10-05 08:00" without a zone is ambiguous and gets read as your local time. A +8h shift almost always means one side treated a zone-less string as UTC and the other as local.' },
      { q: 'Which timestamp format should I store in my database?', a: 'Either UTC ISO 8601 strings or integer Unix timestamps — both are unambiguous. What you must avoid is zone-less datetime strings in local time: they break the moment a server, a user or daylight saving changes the timezone.' },
    ],
  },

  '/device-information': {
    intro: 'Shows the current device screen size, pixel ratio, User-Agent and more — useful evidence when debugging compatibility issues.',
    steps: ['Open the page to see all the information', 'Copy the fields you need'],
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
    example: { label: 'Fill in a sample query', text: 'smile' },
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
    intro: 'Converts characters such as <, > and & into HTML entities, or reverses the process — used to insert text into a page safely.',
    steps: ['Paste the original text', 'Click escape or unescape', 'Copy the result'],
    example: { label: 'Fill in sample text', text: '<div class="box">Hello & "World"</div>' },
  },

  '/html-wysiwyg-editor': {
    intro: 'A WYSIWYG rich-text editor whose HTML source you can grab once you are done editing.',
    steps: ['Type or paste into the editing area', 'Use the toolbar to adjust formatting', 'Switch to the source view and copy the HTML'],
  },

  '/http-status-codes': {
    intro: 'A reference for the meaning of every HTTP status code, for when you hit an unfamiliar one.',
    steps: ['Find the code by category or search', 'Read its official name and the usual scenario'],
    example: { label: 'Fill in a sample query', text: '404' },
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
    about: 'Comparing two JSON documents by eye does not scale: a changed port or a missing comma hides easily among hundreds of lines. A JSON diff parses both sides and reports the differences structurally — values that were added, removed, or changed — instead of diffing raw text lines. That means JSON that was merely reformatted compares as equal, while a real value change stands out.',
    faqs: [
      { q: 'Does key order affect the result?', a: 'No. JSON objects are unordered key-value pairs, so { "a": 1, "b": 2 } equals { "b": 2, "a": 1 }. Arrays are ordered by definition — reordering array elements is reported as a change.' },
      { q: 'Why do two values that look identical show as different?', a: 'Usually the type changed: 1 (number) and "1" (string), or true and "true", render similarly but are different JSON values. A textual diff hides that; a structural diff points at the type mismatch.' },
      { q: 'Can I compare large documents?', a: 'Everything runs in your browser, so the practical limit is tab memory — documents of a few megabytes are fine.' },
    ],
    example: { label: 'Fill in sample JSON', text: '{ "name": "DigDevBox", "version": 1, "tags": ["a", "b"] }' },
  },

  '/json-minify': {
    intro: 'Strips the whitespace and newlines out of JSON, compressing it onto one line to save transfer size.',
    steps: ['Paste the formatted JSON', 'Get the minified result', 'Copy and use it'],
    example: { label: 'Fill in sample JSON', text: '{\n  "name": "DigDevBox",\n  "list": [1, 2, 3]\n}' },
    about: 'Minifying JSON removes everything the machine does not need: indentation, spaces, newlines. The parsed value stays exactly the same, but the file gets smaller and fits on one line — useful for embedding JSON into environment variables, command-line flags, HTML templates or URLs, where whitespace breaks things.',
    faqs: [
      { q: 'How much smaller does the file get?', a: 'For formatted JSON typically 20-40%: whitespace is pure overhead. Minifying does not shorten keys or values the way a binary format would — for transfer size, gzip on the transport layer is the next step.' },
      { q: 'Is minified JSON still valid?', a: 'Yes. Whitespace between tokens is not part of the JSON data model. Minifying requires parsing first, so invalid input errors out instead of producing broken output.' },
      { q: 'How do I get it back into readable form?', a: 'Paste it into the JSON formatter and it is re-indented. Minify and format are inverse operations at the presentation level — the data itself never changes.' },
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
    about: 'Regex syntax is easy to forget precisely because it is dense: character classes, quantifiers, anchors and groups are all written in punctuation. This cheat sheet collects the constructs you actually reach for — ready-made patterns for emails, URLs and dates, the common character classes, and lookahead examples — so you copy a working starting point instead of rebuilding it from memory.',
    faqs: [
      { q: 'Are these patterns production-ready?', a: 'They are solid starting points for common cases. The classic example: fully RFC-compliant email validation is practically impossible in pure regex — the patterns here cover the pragmatic 99%, not the adversarial 1%.' },
      { q: 'Will these patterns work in every language?', a: 'The core syntax (classes, quantifiers, groups, anchors) is nearly universal. Advanced features like lookbehind or named groups vary by engine — verify JavaScript behavior in the Regex Tester.' },
      { q: 'How do I adapt a pattern to my case?', a: 'Copy it into the Regex Tester, paste a sample of your real text, then tighten the pattern until only the parts you want are highlighted.' },
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
    ],
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
    example: { label: 'Fill in a sample key size', text: '4096' },
  },

  '/safelink-decoder': {
    intro: 'Recovers the real link hidden behind an Outlook SafeLink wrapper.',
    steps: ['Copy the very long SafeLink URL from the email', 'Paste it into the input', 'Click decode to get the original URL'],
    notes: ['Decoding only reveals the address — you still have to judge for yourself whether it is trustworthy'],
    example: { label: 'Fill in a sample SafeLink URL', text: 'https://nam.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fdocs' },
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
    example: { label: 'Show a sample token', text: 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2W3x4Y5z6a7B8c9D0e1F2g3H4i5J6k7' },
    about: 'A token here is a random string built from a character set you choose — uppercase, lowercase, digits and optional symbols — at any length from 1 to 512. It is handy for temporary passwords, invite codes, placeholder secrets and other non-critical identifiers. The string is generated in the browser from a pseudo-random source: fine for uniqueness, but for security-sensitive secrets (password-reset links, API keys) prefer a cryptographically strong generator that an attacker cannot predict.',
    faqs: [
      { q: 'Are generated tokens sent anywhere?', a: 'No. The token is produced locally in your browser and never leaves the page, so nothing is uploaded or logged by this tool.' },
      { q: 'Can I use this for password-reset tokens or API keys?', a: 'For low-stakes cases — a temporary password, an invite code, a test fixture — yes. For anything security-sensitive, use a cryptographically strong source instead: this tool uses a regular random number generator, which is good for uniqueness but not for unpredictability against a determined attacker.' },
      { q: 'How do I make a token harder to guess?', a: 'Increase the length and enable more character classes. Entropy grows with length multiplied by alphabet size, so a longer token that mixes letters, digits and symbols is far harder to brute-force than a short one.' },
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
  },

  '/ulid-generator': {
    intro: 'Generates ULIDs: unique like a UUID, but sortable by time — friendlier as a database primary key.',
    steps: ['Click generate to get a ULID', 'Generate repeatedly for more', 'Copy and use it'],
    example: { label: 'Show a sample ULID', text: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
    about: 'A ULID is a 128-bit identifier that is lexicographically sortable: the first 10 characters encode a millisecond timestamp, so sorting ULIDs as strings puts them in creation order. That makes them a drop-in upgrade over a random UUID when the identifier is also used as a database primary key or a sort key — new rows land at the end instead of being scattered. The remaining 16 characters are 80 bits of randomness, so collisions are not a practical concern. ULIDs use Crockford base32 (no I, L, O or U) and are conventionally written uppercase.',
    faqs: [
      { q: 'How is a ULID different from a UUID v4?', a: 'A UUID v4 is random, so its byte order carries no meaning and sorting it tells you nothing about creation time. A ULID puts a millisecond timestamp in its first 10 characters, so lexicographic order equals chronological order — which is exactly what you want from a primary or sort key.' },
      { q: 'Can two ULIDs collide?', a: 'Within a single millisecond a ULID still has 80 random bits (the last 16 characters), giving about 2^80 values before a collision is even theoretically likely. Real systems generate far fewer than that per millisecond, so collisions are not a concern in practice.' },
      { q: 'Is a ULID case-sensitive?', a: 'ULID uses Crockford base32 and is conventionally uppercase; the canonical form keeps it uppercase. Some libraries accept lowercase on input, but store and compare the canonical uppercase string to avoid mismatches.' },
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
    example: { label: 'Show a sample v4 UUID', text: '9f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f' },
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
    example: { label: 'Fill in a sample SSID', text: 'Home-WiFi' },
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
    example: { label: 'Fill in a sample value', text: '100' },
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
