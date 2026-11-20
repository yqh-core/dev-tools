# US/EU SEO Keyword Portfolio — 2026-11-20

Status: research baseline / implementation backlog. This document is not a claim that search volume or ranking has been independently measured.

## Operating rules

- Market: United States first; English-first. Europe is a secondary expansion market.
- Search demand evidence hierarchy: (1) GSC query/page/country exports; (2) Bing Webmaster query/page data; (3) SERP inspection and competitor pages; (4) keyword-tool volume/difficulty; (5) analyst hypotheses. Do not label a phrase "validated volume" without a dated source.
- Existing observed signals must be protected. Do not change a page title solely because a phrase sounds attractive.
- One dominant search intent per canonical URL. Supporting phrases belong in useful sections/FAQs, not separate near-duplicate pages.
- Build pages only when the product can satisfy the intent with a real feature, original explanation, examples, and tested output.
- Never generate doorway pages, location variants, spun FAQs, or mass AI pages.
- Every published guide must link to its matching tool; every tool must link to its genuinely useful guide(s); use descriptive anchors and breadcrumbs/category links.
- Measure impressions, clicks, CTR, average position, indexed status, engagement and tool completion separately. Technical PASS is not ranking or traffic PASS.

## Evidence available at baseline

| Evidence | Observation | Interpretation |
|---|---|---|
| GSC domain property, last 90 days (2026-11-20 snapshot supplied by project) | 391 impressions, 4 clicks, 1.02% CTR, average position 18.14 | Small baseline; too little data for broad causal claims |
| GSC US filter, last 90 days | 65 impressions, 0 clicks, average position 27.15 | US visibility is weak; US-specific demand validation is the priority |
| GSC known query strings | `regular expression tester`, `regex expression tester` | Directly observed query family; protect and expand the existing Regex Tester page |
| Percentage Calculator canonical page | 149 impressions, 0 clicks, average position about 9.21; slashless variant 74 impressions, position about 8.26 and redirects to canonical | Improve snippet/intent match only after query export; keep one canonical URL |
| Bing Webmaster, 28-day signals (prior project snapshot) | Basic Auth Generator 33 impressions; SafeLink Decoder 23; HTTP Status Checker 3; IP Locator 2; IP Locator Docs 2; Text to Binary 1; StreamPlay 1; 77 crawl errors | Low volume, but useful page-level discovery signals; re-check before prioritization |
| Product inventory | Main site README describes 120 tools across crypto, converter, web, image/video, development, network, math, measurement, text and data | Broad candidate set; prioritize clusters with distinct intent and strong feature differentiation |

The GSC snapshot above was reported as cached by the connector around 2026-11-20 07:04 UTC, not a fresh Google recalculation. Treat it as a dated baseline.

## Priority tiers

- **P0 — observed demand / protect:** Regex Tester, Percentage Calculator, Basic Auth Generator, SafeLink Decoder, IP Locator. Pull exact GSC/Bing query rows before changing titles or publishing competing URLs.
- **P1 — strong product-to-query fit:** JSON Formatter/Validator, JWT Decoder, Base64 Encoder/Decoder, Unix Timestamp Converter, Image Compressor, HTTP Status Checker, Crontab Generator, Docker Run to Compose.
- **P2 — long-tail expansion:** specialist converters, network calculators, accessibility/security utilities, developer references, and the separate product sites.
- **P3 — defer:** topics for which the current product does not yet satisfy the intent, high-risk YMYL/security claims, and generic head terms dominated by large brands.

## Nine-site product map and market fit (verified hosts where available)

| Site | Verified host / product | Search-intent focus | Current action |
|---|---|---|---|
| Main Dev Tools | digdevbox.com | Developer utilities: regex, percentage, Basic Auth, Safe Links, JSON, JWT, converters, network/DevOps | GSC + Bing query-led page work; keep one canonical target per intent |
| DigImg | img.digdevbox.com | Browser-local image compression, JPEG/WebP/AVIF output, image size reduction, measured quality/byte comparisons | Prioritize image-compressor and format-conversion terms; use real byte/SSIM evidence. Do not promise exact target-KB support until confirmed |
| IP Locator | ip.digdevbox.com | IP lookup/geolocation, IPv4/IPv6, CIDR/subnet, DNS/rDNS | Target only implemented fields and supported geographies; distinguish lookup from subnet calculation |
| StreamPlay | play.digdevbox.com | M3U8/HLS player, stream testing, playlist/variant/segment inspection, embed/deep-link workflows | Separate player intent from analyzer intent; disclose browser/codec/CORS constraints |
| TTS Reader | ttsreader.digdevbox.com | Long-text text-to-speech reader | Build around long text and reading workflows; verify exact supported file imports, voices and export modules before publishing claims |
| ImageForge | draw.digdevbox.com | Free browser-based image editor: layers, filters, shapes, text, retouching and local editing | Compete on online image editor / photo editor intent, not AI image generation |
| Forge Notes | notes.digdevbox.com | Original developer tutorials, debugging guides, worked examples and comparisons | Editorial support layer; each article links to one relevant tool and answers a distinct question |
| Geek Typing | geek-typing.pages.dev | English typing practice through vocabulary, topic/exam word banks, review and offline practice | Target English typing + vocabulary-learning intent; avoid generic typing-test promises that don't match the product |
| Fangdai | Separate Chinese-market mortgage product | Not aligned with the current US/EU growth strategy | Excluded from current keyword expansion; retain technical health monitoring only |

The hosts above are grounded in the product READMEs/repository descriptions and current project inventory. The exact DigImg host is img.digdevbox.com; TTS Reader is ttsreader.digdevbox.com; Geek Typing is geek-typing.pages.dev. Production sitemaps still need to be fetched to finalize every canonical path on each host.

### Cross-site keyword clusters to expand

**DigImg**
- image compressor online
- compress JPEG online
- compress WebP online
- AVIF image compressor
- convert JPG to WebP
- convert PNG to WebP
- browser-based image compressor
- compress images without uploading
- image optimization for web
- image file size reducer

**IP Locator**
- IP address lookup
- IP geolocation lookup
- public IP lookup
- IPv4 subnet calculator
- CIDR calculator
- IPv6 address lookup
- IPv6 CIDR calculator
- reverse DNS lookup
- DNS lookup by IP
- IP address range calculator

**StreamPlay**
- M3U8 player
- HLS player online
- play M3U8 URL
- HLS stream tester
- M3U8 playlist analyzer
- HLS manifest analyzer
- inspect M3U8 variants
- HLS segment inspector
- embed M3U8 player
- MP4 video player online

**TTS Reader**
- text to speech reader online
- long text to speech
- read text aloud online
- text reader with voice
- listen to long articles
- text to speech for documents
- online TTS reader
- text to speech web app

**ImageForge**
- free online image editor
- online photo editor
- browser-based image editor
- image editor with layers
- online image editor no install
- free photo editor no signup
- edit images in browser
- browser-based photo retouching
- online image editor with filters
- add text to image online

**Geek Typing**
- English typing practice
- vocabulary typing practice
- learn English vocabulary by typing
- typing practice with word lists
- English word typing game
- IELTS vocabulary typing practice (only if the relevant pack is live and clearly accessible)
- TOEFL vocabulary typing practice (same validation)
- offline English typing practice
- developer vocabulary typing practice

**Forge Notes**
- how to test a regular expression in JavaScript
- how to generate an HTTP Basic Authorization header
- how to decode an Outlook Safe Links URL
- percentage change formula with examples
- Unix timestamp seconds vs milliseconds
- how to inspect an HLS M3U8 playlist
- how to troubleshoot HLS CORS and codec errors
- how to compare image compression quality and file size
- CIDR and IPv6 subnet examples
- Docker run command to Compose conversion

These are candidate phrases to validate, not reported search volumes. Do not publish all phrases as separate pages; group them into the smallest set of pages that fully answers each intent.

## Keyword-to-page map (candidate phrases, not volume claims)

The primary phrase is the proposed page focus. Supporting phrases are candidate variants to validate in GSC/Bing/SERP data. The target URL is the existing canonical page from the public project inventory wherever verified.

| Cluster | Primary phrase | Supporting phrase candidates | Target / action | Priority |
|---|---|---|---|---|
| Regex | regular expression tester | regex tester online; regex tester; online regex checker; test regex; regex pattern tester; regex match tester; regex expression tester; JavaScript regex tester; regex playground; regex debugger | /regex-tester — preserve current query footprint; improve examples, flags/capture-group explanation and snippet | P0 |
| Regex guide | how to test a regular expression | regex examples; regex groups; regex flags; regex match examples; JavaScript regex guide; regex troubleshooting | /regex-memo plus Forge Notes regex-testing guide; strengthen reciprocal links and unique examples | P1 |
| Percentage | percentage calculator | percent calculator; calculate percentage; percentage change calculator; percent increase calculator; percent decrease calculator; what percent of calculator; percentage difference calculator; percentage off calculator; calculate X percent of Y | /percentage-calculator — preserve canonical; improve title/meta only after query-level review | P0 |
| Basic Auth | basic auth header generator | HTTP Basic Auth header; generate basic authorization header; Basic Auth generator; base64 basic auth; curl authorization header; create authorization header | /basic-auth-generator — add safe, precise curl/API examples and explain Base64 is not encryption | P0 |
| Safe Links | SafeLink decoder | Outlook Safe Links decoder; decode safelinks URL; unwrap safelink; expand Outlook safe link; original URL from safelink | /safelink-decoder — clearly state decoding does not open destination; add examples and privacy explanation | P0 |
| IP lookup | IP locator | IP address lookup; IP lookup tool; locate IP address; IP geolocation lookup; public IP lookup; IP address information | IP Locator product page — validate exact canonical URL and geolocation data scope before metadata edits | P0 |
| IP subnet | IPv4 subnet calculator | CIDR calculator; subnet calculator; calculate subnet mask; /24 subnet calculator; usable IP range calculator; network address calculator; wildcard mask calculator | /ipv4-subnet-calculator — add worked CIDR examples and IPv4/IPv6 boundaries | P1 |
| IPv6 | IPv6 subnet calculator | IPv6 CIDR calculator; IPv6 range calculator; IPv6 address range; IPv6 prefix calculator | IP Locator / relevant main-site network tool — confirm implemented scope; do not imply full subnet planner if absent | P2 |
| HTTP status | HTTP status checker | check HTTP status code; URL status checker; website status code checker; HTTP response headers checker; check URL response; redirect checker | /http-status-checker — explain live network request, redirects, response headers and limitations | P1 |
| HTTP reference | HTTP status codes | HTTP status code list; 200 301 302 400 401 403 404 500 meaning; HTTP error codes; status code meanings | /http-status-codes plus Forge Notes guide; table with actionable retry/owner guidance | P1 |
| JWT | JWT decoder | decode JWT online; JWT parser; JSON web token decoder; inspect JWT claims; JWT expiration checker; decode JWT payload; JWT header decoder | /jwt-parser — emphasize decode ≠ signature verification; client-side privacy; claim examples | P1 |
| Base64 | Base64 encoder decoder | Base64 decode online; Base64 encode online; Base64 decoder; Base64 encoder; Base64URL decoder; URL safe Base64; decode Base64 string | /base64-string-converter — cover padding, URL-safe alphabet and binary-safe handling | P1 |
| Base64 files | Base64 to file converter | Base64 image decoder; data URI to image; Base64 file decoder; convert Base64 to image; image to Base64 | /base64-file-converter — distinguish file bytes from text-string encoding | P2 |
| Unix time | Unix timestamp converter | epoch converter; epoch to date; timestamp to date; Unix time converter; convert date to timestamp; milliseconds to date; seconds to date | /unix-timestamp-converter — add seconds vs milliseconds examples and UTC/local output details | P1 |
| Date/time | date format converter | ISO 8601 converter; RFC 3339 converter; UTC timestamp converter; date to ISO string; Unix epoch date format | /date-converter — organize formats by developer task and link timestamp guide | P2 |
| JSON formatter | JSON formatter | JSON formatter online; JSON beautifier; pretty print JSON; format JSON; JSON validator; validate JSON online; JSON syntax checker | /json-prettify — separate format/validate/minify intent in page sections; add valid/invalid examples | P1 |
| JSON workspace | JSON editor online | JSON viewer; JSON tree viewer; JSONPath tester; JSON schema generator; JSON query tool; JSON explorer | /json-workspace — differentiate from simple formatter using tree, JSONPath and schema features | P1 |
| JSON diff | JSON diff tool | compare JSON files; JSON compare online; JSON object diff; compare two JSON objects; JSON difference checker | /json-diff — show nested object/array examples and diff semantics | P2 |
| JSON convert | JSON to CSV converter | convert JSON to CSV; JSON array to CSV; JSON to YAML; YAML to JSON; JSON to XML; XML to JSON | Relevant converter pages — one intent per URL; build a converter hub with links, not duplicate pages | P2 |
| YAML | YAML validator | YAML formatter; YAML parser online; validate YAML; YAML syntax checker; YAML to JSON converter; YAML prettifier | /yaml-prettify and /yaml-to-json-converter — explain parser/version edge cases with tested examples | P1 |
| SQL | SQL formatter | SQL beautifier; format SQL online; SQL pretty printer; SQL query formatter; SQL minifier | /sql-prettify — list supported dialects accurately; show before/after examples | P2 |
| Cron | crontab generator | cron expression generator; cron schedule generator; cron expression parser; cron expression validator; cron job tester; GitHub Actions cron generator | /crontab-generator — emphasize human-readable preview and supported syntax; include common schedules | P1 |
| Docker | docker run to compose converter | docker run to docker-compose; convert docker run command; docker compose generator; docker run command converter | /docker-run-to-docker-compose-converter — add tested flag mapping examples and unsupported edge cases | P1 |
| Chmod | chmod calculator | Linux permissions calculator; Unix permissions calculator; chmod 755 meaning; chmod 644 calculator; octal permissions calculator; chmod command generator | /chmod-calculator — include 755/644/600/2750 examples and special bits | P2 |
| Password | password generator | secure password generator; random password generator; strong password generator; password generator no signup; cryptographic password generator | /password-generator — communicate entropy controls accurately; no unsupported security guarantees | P2 |
| Password strength | password strength checker | password strength test; password security checker; password crack time calculator | /password-strength-analyser — describe estimation limitations; do not imply breach database checking | P2 |
| Hash | hash generator | SHA256 hash generator; MD5 hash generator; SHA-1 hash online; text to SHA256; generate checksum; SHA3 hash | /hash-text — explain algorithms and avoid implying hashes are encryption | P2 |
| HMAC | HMAC generator | HMAC SHA256 generator; generate webhook signature; HMAC SHA512; verify HMAC signature | /hmac-generator — add webhook signing examples and browser-local key handling details | P2 |
| UUID | UUID generator | UUID v4 generator; generate UUID online; random GUID generator; UUID v1 v3 v5 generator; bulk UUID generator | /uuid-generator — describe versions and collision assumptions accurately | P2 |
| ULID | ULID generator | generate ULID; sortable unique ID generator; time ordered ID generator | /ulid-generator — explain lexical ordering and timestamp component | P2 |
| URL | URL encoder | URL encode online; URL decoder; percent encoding; encodeURIComponent; URL percent encoder; query string encoder | /url-encoder — add reserved-character examples and distinguish component vs full URL encoding | P2 |
| URL parser | URL parser online | parse URL; URL query parameter parser; split URL into parts; URL components parser | /url-parser — show scheme/host/path/query/fragment extraction examples | P2 |
| HTML entities | HTML entity encoder | HTML escape online; HTML unescape; escape HTML characters; HTML entity decoder | /html-entities — include XSS-context caveat; do not claim sanitizer functionality | P2 |
| Color contrast | color contrast checker | WCAG contrast checker; accessibility contrast checker; WCAG AA contrast; WCAG AAA contrast; contrast ratio calculator | /color-contrast-checker — show thresholds and live preview; make conformance scope explicit | P1 |
| Image compression | image compressor | compress image online; image size reducer; reduce image file size; JPEG compressor; WebP compressor; AVIF converter; reduce image file size to target KB (validate target-size support before targeting) | DigImg — target separate intent pages only where the app actually supports them; publish measured same-image comparisons | P1 |
| Image format | convert image to WebP | convert JPG to WebP; PNG to WebP; AVIF converter; image format converter; WebP converter online | DigImg — add format-specific guides only with real browser support and measured outputs | P2 |
| Image resize | image resizer | resize image online; resize image to pixels; change image dimensions; bulk image resize | Main /image-resize and DigImg if capability overlaps — avoid cannibalization; define distinct feature scope | P2 |
| Image crop | image cropper | crop image online; crop photo to exact size; crop image to aspect ratio | /image-crop — demonstrate pixel-accurate crop and aspect ratio behavior | P2 |
| M3U8 | M3U8 player | HLS player online; play M3U8 URL; M3U8 stream player; HLS playlist analyzer; inspect M3U8 playlist | StreamPlay — separate playback vs playlist analysis intent; verify supported browser/codec constraints | P1 |
| HLS analysis | M3U8 analyzer | HLS manifest analyzer; inspect HLS variants; parse M3U8 playlist; HLS segment analyzer; stream playlist inspector | StreamPlay — leverage actual variant/segment inspection; show sample manifest and explain results | P1 |
| TTS | text to speech online | free text to speech; read text aloud; online TTS reader; text reader with voice; listen to text | TTS Reader — confirm voices, language, download/export and browser support before claims | P1 |
| Long-form TTS | long text to speech reader | read long text aloud; text to speech for long articles; online text reader; listen to documents | TTS Reader (ttsreader.digdevbox.com) — validate the seven modules and exact supported import/export formats before making page claims | P1 |
| English typing practice | English typing practice | typing practice with vocabulary; learn English words by typing; English vocabulary typing; typing practice word lists; vocabulary typing game; English typing accuracy practice | Geek Typing (geek-typing.pages.dev) — focus on vocabulary-through-typing, word-bank and review differentiation; do not promise timed test modes unless verified | P1 |
| Typing practice | typing practice online | typing practice test; improve typing speed; typing accuracy practice; keyboard speed test | Geek Typing — publish practice content only if matching modes exist | P2 |
| Image editing | free online image editor | browser image editor; online photo editor; image editor with layers; free photo editor no signup; edit images in browser; image editor without install; image editor no upload | ImageForge (draw.digdevbox.com) — target its real miniPaint-based editor features: layers, filters, shapes, text, retouching and browser-local editing; do not target AI image generation | P1 |
| Dev tools hub | developer tools online | free online developer tools; browser developer utilities; developer toolbox; online coding tools | Main homepage — category architecture and internal links; avoid generic keyword stuffing | P2 |
| Privacy/local processing | browser based tools | client side tools; private online developer tools; tools that run in browser; no upload image compressor | Main site / DigImg — substantiate each privacy statement by implementation and network tests | P2 |

## Additional long-tail backlog (supporting topics; map to an existing page unless a genuinely distinct feature warrants a new page)

### Crypto, identity and security utilities
1. generate random token online
2. secure random string generator
3. bcrypt hash generator
4. bcrypt password checker
5. htpasswd generator
6. Apache htpasswd generator
7. Nginx htpasswd generator
8. RSA key pair generator
9. generate RSA private public key
10. PEM key generator
11. HMAC webhook signature generator
12. OTP code generator
13. TOTP generator
14. BIP39 passphrase generator
15. PDF signature checker
16. encrypt text online
17. decrypt text online
18. AES encrypt decrypt online
19. password generator with symbols
20. password generator exclude ambiguous characters

### Developer conversion and formatting
21. JSON minifier
22. JSON to TypeScript converter
23. JSON to Java class
24. JSON to C# class
25. JSON to Go struct
26. CSV to JSON converter
27. XML formatter
28. XML minifier
29. TOML to JSON converter
30. TOML to YAML converter
31. YAML to TOML converter
32. Markdown to HTML converter
33. Markdown preview online
34. text to binary converter
35. binary to text converter
36. decimal to hex converter
37. hex to decimal converter
38. integer base converter
39. Roman numeral converter
40. Unix timestamp milliseconds vs seconds

### Web, API and networking
41. generate HTTP Basic authorization header
42. HTTP header reference
43. HTTP request methods list
44. HTTP response headers checker
45. check website redirect chain
46. inspect URL response headers
47. parse user agent string
48. user agent lookup
49. MIME type lookup
50. MIME type to extension
51. WHOIS lookup online
52. RDAP domain lookup
53. MAC address vendor lookup
54. MAC address generator
55. IPv4 to decimal converter
56. IPv4 to hexadecimal converter
57. IPv4 range calculator
58. expand IPv4 range to CIDR
59. IPv6 ULA generator
60. public IP information lookup

### Images, media and browser utilities
61. image compressor no upload
62. compress JPEG in browser
63. compress WebP in browser
64. image compressor target file size
65. image resizer exact dimensions
66. image color picker from image
67. favicon ICO generator
68. generate Apple touch icon
69. images to PDF converter
70. merge images into PDF
71. PDF merge online
72. split PDF online
73. PDF watermark tool
74. compress PDF online
75. webcam recorder online
76. record webcam video in browser
77. QR code generator
78. WiFi QR code generator
79. SVG placeholder generator

### Text, accessibility, math and measurement
80. text diff checker
81. compare two text files online
82. find and replace text online
83. regex text replacer
84. word counter and character counter
85. text statistics tool
86. Lorem Ipsum generator
87. emoji picker
88. Morse code translator
89. NATO phonetic alphabet converter
90. numeronym generator
91. px to rem converter
92. rem to px converter
93. unit converter online
94. temperature converter
95. reaction time test online
96. online stopwatch
97. benchmark execution time
98. ETA calculator
99. calculate download time
100. phone number parser
101. validate IBAN online
102. format phone number internationally

These 102 supporting phrases are a discovery backlog, not a recommendation to create 102 pages. Group synonyms and answer the intent on the strongest existing URL.

## Content cluster architecture

1. **Developer debugging:** Regex Tester ↔ regex reference/testing guide; JWT Parser ↔ JWT guide ↔ Unix Timestamp Converter; JSON Formatter ↔ JSON Workspace ↔ JSON guide; Base64 converter ↔ Base64 guide.
2. **API/network operations:** Basic Auth Generator ↔ HTTP headers reference ↔ HTTP status checker ↔ HTTP status codes guide; IP Locator ↔ subnet calculator ↔ WHOIS/RDAP guide.
3. **DevOps configuration:** Crontab Generator ↔ Chmod Calculator ↔ Docker Run-to-Compose ↔ YAML Formatter ↔ DevOps guide.
4. **Image workflow:** DigImg compressor ↔ format/size guides ↔ measured comparison article; main-site resize/crop utilities should have clear differentiators and avoid competing with DigImg for the same phrase.
5. **Media playback:** StreamPlay M3U8 player ↔ HLS/M3U8 analyzer ↔ troubleshooting guide.
6. **Speech and typing:** TTS Reader ↔ text-to-speech use-case guides; Geek Typing ↔ typing speed/accuracy test guides.
7. **Editorial hub:** Forge Notes should be the explanatory layer, not a second copy of each tool landing page. Each article should answer a specific debugging question and point to the exact tool.

## Implementation sequence

### Batch 1 — query-led page improvements
- Export GSC queries/pages/countries for 28 days, 90 days and 12 months; preserve exact date ranges and property.
- Export Bing Webmaster query/page data for the same available windows.
- For Regex Tester, Percentage Calculator, Basic Auth Generator, SafeLink Decoder and IP Locator: map every visible query to the canonical URL; classify branded/non-branded, informational/transactional, country, position band and CTR.
- Do not rewrite title/H1 until query rows and current SERP snippets are recorded.
- Check canonical, indexability, rendered text, page links and mobile snippet for each target.

### Batch 2 — strengthen existing pages
- Add useful examples, edge cases, limitations, output explanations and concise FAQs where they answer actual queries.
- Add links from guide → tool and tool → guide; add contextual links between closely related tools.
- Keep one primary phrase per page; place natural variants in explanatory copy and headings only when they fit.
- Add original screenshots or reproducible test examples only when they demonstrate the actual product.

### Batch 3 — product-site clusters
- DigImg: image compression, target size, format conversion and privacy claims backed by reproducible byte/quality tests.
- IP Locator: IP lookup, IPv4/IPv6, CIDR and DNS/RDNS only within implemented feature scope.
- StreamPlay: M3U8/HLS playback and manifest analysis, with browser/codec limitations.
- TTS Reader and Geek Typing: validate product features before creating use-case pages.
- ImageForge: confirm generation model, commercial terms, output limits and real product flow before targeting AI image terms.
- Do not guess canonical hosts or paths; pull them from each production sitemap before implementation.

### Batch 4 — measurement and pruning
- Annotate deployment dates and changed URLs.
- Review GSC weekly for impressions/clicks/query coverage and monthly for indexation; use 28-day and 90-day comparisons, not day-to-day noise.
- Track organic landing-page engagement and actual tool starts/completions in GA4/Amplitude separately from search visibility.
- Merge or redirect only when two URLs demonstrably satisfy the same intent and migration is safe.
- Stop expanding a cluster when it lacks evidence of demand or the product cannot satisfy the query.

## Research gaps / no unsupported claims

- Search volume, keyword difficulty, CPC and competitor traffic are not available in the supplied GSC/Bing snapshots. Ahrefs access was previously blocked by plan limits; no volume numbers are fabricated here.
- GSC Pages and Sitemaps reports were not available in the previous audit. Sitemap reachability and crawler PASS do not prove Google indexation.
- Need current production sitemaps for all nine sites to finalize exact URL mapping and prevent cross-site cannibalization.
- Need fresh GSC query exports before editing high-ranking titles, especially Percentage Calculator.
- Need live SERP checks for each P0/P1 cluster before creating new pages or claiming a competitor gap.

## Acceptance criteria

- Every keyword has a canonical target URL, intent, evidence class and priority.
- No two pages are assigned the same primary intent without an explicit differentiation note.
- All new content is fact-checked against the actual tool and includes original value.
- Internal links are crawlable HTML links, not JS-only navigation.
- Sitemap/canonical/robots/HTTP status and rendered page content pass production crawl.
- GSC/Bing changes are measured after deployment; no traffic-growth claim is made from technical checks alone.
