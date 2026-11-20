# Bing query and SERP competitor research — 2026-11-20

## Bing Webmaster live pull

Property: https://digdevbox.com/  
Source: authenticated Bing Webmaster Tools via Supermetrics data source BW.  
Window: last 28 days, queried 2026-11-20. QueryStats and PageStats were both returned successfully; the 90-day QueryStats request was served from cache at 2026-11-20T07:30:23Z and returned the same rows, so this note treats the uncached 28-day query/page pull as the reliable current slice.

### PageStats (28 days)

| Page | Impressions | Clicks | Average impression position |
|---|---:|---:|---:|
| https://digdevbox.com/basic-auth-generator/ | 33 | 0 | 6.24 |
| https://digdevbox.com/safelink-decoder/ | 23 | 0 | 7.00 |
| https://digdevbox.com/http-status-checker/ | 3 | 0 | 8.33 |
| https://ip.digdevbox.com/ | 2 | 0 | 4.00 |
| https://ip.digdevbox.com/docs | 2 | 0 | 8.00 |
| https://digdevbox.com/text-to-binary/ | 1 | 0 | 8.00 |
| https://play.digdevbox.com/ | 1 | 0 | 7.00 |

### QueryStats (28 days)

| Query | Impressions | Clicks | Average impression position |
|---|---:|---:|---:|
| basic auth generator | 17 | 0 | 5.41 |
| outlook safelink decoder | 3 | 0 | 9.00 |
| basic auth generateor (typo) | 2 | 0 | 6.00 |
| basic auth token generator | 2 | 0 | 5.00 |
| basic authorization generator | 2 | 0 | 9.00 |
| generator basic authentication | 2 | 0 | 8.50 |
| how to open the outlook safelink original url | 2 | 0 | 10.00 |
| http status checker | 2 | 0 | 9.00 |
| web basic auth generator | 2 | 0 | 7.00 |
| safelink decoder | 1 | 0 | 9.00 |
| decode outlook safelink | 1 | 0 | 4.00 |
| convert outlook safelinke to url | 1 | 0 | 6.00 |
| decode link outlook | 1 | 0 | 6.00 |
| get around outlook safelink | 1 | 0 | 3.00 |
| generate basic auth | 1 | 0 | 8.00 |
| html status code checker | 1 | 0 | 8.00 |

Note: the typo query is evidence of a user query, not a phrase to place in titles or copy. Preserve natural spelling and use it only as a query-matching clue.

## What this changes

1. Basic Auth Generator is the strongest immediate Bing opportunity: 33 page impressions, 17 exact-query impressions, average positions 6.24 / 5.41, and zero clicks. This is a snippet/CTR diagnosis before a ranking project.
2. SafeLink Decoder is also a clear quick-win candidate: 23 page impressions, with Outlook Safe Links-related queries around positions 3–10, but zero clicks. The page needs a compelling, trustworthy snippet and concise answer to the user's job: reveal the original destination without opening it.
3. HTTP Status Checker has a small but directly relevant signal (3 page impressions, 2 for “http status checker”); retain as P1/P2, not a broad campaign.
4. IP Locator has only 2 Bing page impressions in this 28-day pull, despite more GSC 90-day impressions. Do not over-prioritize from a single small sample.
5. StreamPlay homepage has one impression; its /docs page is absent from this PageStats top rows, and GSC returned only a few docs impressions. Need sitemap and page-level inspection before content expansion.

## SERP / competitor observations (qualitative, not volume data)

### Basic Auth header generator

Search results show competing tools that combine generation with decoding, explain the Authorization: Basic format, and clarify that Base64 is encoding rather than encryption. Some include username-colon limitations, UTF-8 handling, curl examples and browser-local processing. Examples:

- Free.Tools, Basic Auth Header Generator: https://free.tools/tools/basic-auth-header/
- Boneyard Tools, HTTP Basic Auth Header Generator: https://boneyardtools.com/dev/basic-auth-generator
- W3Schools Basic Auth Header Generator: https://www.w3schools.com/tools/tool_basic_auth.php

Opportunity: use a clear task-first title/description and first-screen explanation; if the existing product already supports both generation and decoding, expose both actions clearly. Add precise examples for curl and Authorization header construction. Explain Base64 is not encryption and recommend HTTPS. Do not claim secrets are safe merely because the page is browser-based; advise against pasting production credentials into third-party pages. Confirm UTF-8 and colon behavior from tests before documenting them.

### Outlook Safe Links decoder

Search results emphasize Outlook / Microsoft 365, original destination, decoding without opening, and a warning that decoding does not establish link safety. Microsoft documentation confirms Safe Links wraps/rewrites URLs and can scan a link when clicked: https://learn.microsoft.com/en-us/defender-office-365/safe-links-about

Competing examples:
- ToolsKit Safe Links decoder: https://toolskit.cc/tools/safelinks-decoder
- RedirectSniffer Outlook Safe Links decoder: https://redirectsniffer.com/outlook-safe-links-decoder
- ToolsForThat SafeLink decoder: https://www.toolsforthat.com/tools/safelink-decoder

Opportunity: the page should answer “how do I get the original URL from an Outlook Safe Links URL?” immediately. Explain that decoding is not a safety verdict and does not replace Microsoft's click-time protection. State exactly which host patterns and nested wrapper depths the product supports, based on tests. Do not encourage bypassing Safe Links or clicking a suspicious destination.

### Percentage calculator

Competitor pages present a compact group of common tasks: percent of a number, what percent one number is of another, percentage change, percentage difference, adding/subtracting a percentage, reverse percentage, and percentage points. Examples:
- ToolkitJar: https://toolkitjar.com/tools/percentage-calculator
- JYE LABS: https://jyelabs.com/en/tools/percentage-calculator/
- Every Boring Tool: https://everyboringtool.com/calculators/percentage-calculator

Opportunity: DigDevBox's README describes four live calculators. Do not claim feature parity with six-function competitors unless new functions are implemented and tested. Make the existing four use cases unmistakable above the fold; show formulas, examples, rounding rules and the difference between percentage change and percentage points only if supported. Because GSC shows 224 impressions and no clicks across canonical/slashless variants, compare the live title and snippet with the actual query set before editing.

### Regex tester

Current SERP competitors position around JavaScript-specific testing, live highlighting, capture groups, replace preview, cheat sheets, and privacy. More comprehensive tools such as regex101 cover many regex engines and debugging features. Examples:
- iTechGuides 2026 comparison: https://www.itechguides.com/best/regular-expression-testers/
- Shiklo Regex Tester: https://tools.shiklo.com/regex-tester/
- FreeDevTool Regex Tester: https://freedevtool.org/regex-tester

Opportunity: do not compete on multi-language regex flavors unless the product supports them. Position honestly as a quick JavaScript RegExp tester, explain browser-native behavior and supported flags/capture groups, and provide tested copy-paste examples. Improve guide-to-tool linking and answer common debugging questions.

## Next actions by priority

- P0: Basic Auth Generator — inspect title/meta/H1/current first-screen UX and test encode/decode, Unicode, username colon and curl examples. Improve snippet only after checking current SERP and GSC/Bing query match.
- P0: SafeLink Decoder — inspect supported wrapper patterns, nested decoding, privacy/network behavior and safety wording; then optimize title/meta around Outlook Safe Links decoder / original URL intent.
- P0: Percentage Calculator — inspect the four existing calculator modes, title/meta, formula examples and current SERP; don't add unsupported features or create a second URL.
- P1: HTTP Status Checker — improve examples for status and response headers, preserving exact live-request limitations.
- P1: Regex Tester — expand examples/guide coverage, but do not describe it as a high-ranking page or multi-engine competitor.

## Sources

- Google Search Console query/page/country exports: docs/seo/gsc-live-snapshot-2026-11-20.md
- DigDevBox public tool inventory: https://github.com/yqh-core/dev-tools/blob/main/README.md
- Microsoft Safe Links official explanation: https://learn.microsoft.com/en-us/defender-office-365/safe-links-about
- Competitor and SERP pages are listed inline above. SERP observations are qualitative; no competitor traffic or keyword volume is claimed.
