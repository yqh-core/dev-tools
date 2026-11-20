# Product-site SERP and competitor notes — 2026-11-20

Scope: US-first, English-language search. Qualitative SERP review only; no search-volume or difficulty claims. Re-check competitor features before publishing comparisons.

## DigImg — img.digdevbox.com

**Candidate keywords:** image compressor online; compress JPEG online; compress WebP online; AVIF image compressor; convert JPG to WebP; convert PNG to WebP; browser-based image compressor; compress images without uploading; image optimization for web; image file size reducer.

**SERP:** [ShrinkTo](https://shrinkto.com/) emphasizes exact target-KB compression; [Compressly](https://getcompressly.com/) emphasizes batch, modern formats and local WASM; [Asset Melt](https://assetmelt.com/) combines target-size and batch export; [Pic Compress](https://www.piccompress.com/) advertises broad format support and target-size presets. DigImg has a real differentiator in its reproducible same-image comparison against TinyPNG and ShortPixel, with byte counts and SSIM: [DEV Community comparison](https://dev.to/young_y/i-measured-digimg-vs-tinypng-vs-shortpixel-on-the-same-images-bytes-ssim-5h4i). A separate 100KB target-size comparison exists [here](https://dev.to/young_y/i-gave-3-image-compressors-a-hard-100kb-limit-only-one-hit-it-automatically-2oel), but claims must remain scoped to that test.

**Action:** lead with image compressor + formats actually supported + browser-local processing. Publish reproducible benchmark tables with source format, original/output bytes, output format, quality/SSIM method, browser and limitations. Do not claim target-size UI support unless confirmed in the live DigImg app. Avoid duplicate format pages without distinct tested workflows.

## ImageForge — draw.digdevbox.com

**Candidate keywords:** free online image editor; online photo editor; browser-based image editor; image editor with layers; online image editor no install; free photo editor no signup; edit images in browser; browser-based photo retouching; online image editor with filters; add text to image online.

**SERP:** [Picstea](https://www.picstea.com/) positions as a free layer-based browser editor; [Lamella Studio](https://lamella-studio.com/) competes on layers/masks, PSD and local editing; [Pictius](https://pictius.com/) adds AI positioning; [Go Pixer](https://gopixer.com/) competes with templates and an editor. ImageForge's README describes a miniPaint-based browser editor with layers, filters, shapes, text, retouching and local editing. It is not an AI image generator. Its brand.config.json already provides the tagline “Free Online Photo & Image Editor”, a feature-specific description and keywords such as free online image editor, online photo editor, browser image editor, photo retouching and no-upload image editor.

**Action:** the metadata foundation is already aligned; do not rewrite the title just to chase another synonym. Focus on visible static copy, a real editor screenshot, supported actions and export formats above the fold. Claim local processing only for functions verified to stay local. Do not claim PSD/layer-preserving export unless tested.

## StreamPlay — play.digdevbox.com

**Candidate keywords:** M3U8 player; HLS player online; play M3U8 URL; HLS stream tester; M3U8 playlist analyzer; HLS manifest analyzer; inspect M3U8 variants; HLS segment inspector; embed M3U8 player; MP4 player online.

**SERP:** [Castr](https://castr.com/hlsplayer/) pairs playback with live diagnostics, ABR rendition ladder, bitrate, buffer health and dropped frames. [Livepush](https://livepush.io/hlsplayer/index.html) and [DCAST](https://dcast.tv/tools/hls-player) also combine playback and diagnostics. [LivePlayer](https://www.liveplayer.org/) markets player, analyzer, downloader, converter and embed builder. StreamPlay's repository describes HLS/M3U8 playback, native MP4 playback, deep links/iframe and explicit error states; current project baseline also records manifest inspection and embed generation. Its current index.html already has a focused title (“M3U8 & HLS Player — Analyze, Play & Embed”), a task-oriented description, canonical URL and WebApplication JSON-LD feature list.

**Action:** keep the current title/description; they already match the main intent. Strengthen the page with real test streams, sample manifests, detected variants/segments and embed examples. Explain CORS, expired tokens, DRM and codec limits. Do not claim live bitrate/buffer diagnostics unless the current UI exposes them; that is a possible feature gap, not copywriting.

## TTS Reader — ttsreader.digdevbox.com

**Candidate keywords:** text to speech reader online; long text to speech; read text aloud online; text reader with voice; listen to long articles; text to speech for documents; online TTS reader; text to speech web app.

**SERP:** the established [TTSReader.com](https://ttsreader.com/) already owns the exact brand-like query and markets text, documents, books, webpages, voices and audio export. [ElevenReader](https://elevenreader.io/) emphasizes long documents and natural voices; [NaturalReader](https://www.naturalreaders.com/) is an established document reader; [Speechma](https://speechma.com/pdf-reader) and [ReadLoudly](https://readloudly.com/) compete on PDF/document reading.

**Action:** do not rely on the ambiguous branded query “TTSReader”. Target task-specific generic long-text workflows. The DigDevBox repo description says long-text reader with seven modules; verify actual imports, voices, exports and limits before adding metadata or FAQs. Do not claim OCR, PDF/EPUB, MP3 export, premium voices, unlimited use or offline export unless the current app confirms it.

## Geek Typing — geek-typing.digdevbox.com (README also links the Pages.dev preview)

**Candidate keywords:** English typing practice; vocabulary typing practice; learn English vocabulary by typing; typing practice with word lists; English word typing game; English typing accuracy practice; offline English typing practice; developer vocabulary typing practice; IELTS vocabulary typing practice; TOEFL vocabulary typing practice.

**SERP:** [EnglishTypingPractice.com](https://englishtypingpractice.com/) combines typing with vocabulary, topic/exam packs, audio and spaced review; [TypingBuddy](https://www.typingbuddy.com/english-typing-playground.html) targets open-text typing/WPM; [Typeloop](https://www.typeloop.dev/en) targets sentence/word practice, timed tests and mistake review. Geek Typing's README describes vocabulary-through-typing, exam/technical word banks, review queues, learning analytics and offline PWA behavior; repository baseline states 13 packages / 9,438 entries. However, the current index.html uses zh-CN metadata and the SEO landing block is Chinese. The app UI is bilingual, but US/EU search targeting should be deferred until an English SEO landing page and correct language/canonical/hreflang strategy are implemented.

**Action:** do not become another generic typing-speed-test page. Own vocabulary-through-typing, topic/exam word banks, review and offline use. Publish pack-specific pages only for packs that are live and accessible. Do not republish word-bank content outside its license terms.

## IP Locator — ip.digdevbox.com

**Candidate keywords:** IP address lookup; IP geolocation lookup; public IP lookup; IPv4 subnet calculator; CIDR calculator; IPv6 address lookup; IPv6 CIDR calculator; reverse DNS lookup; DNS lookup by IP; IP address range calculator.

**SERP:** [IPinfo](https://ipinfo.io/), [ip-api](https://ip-api.com/), [IPGeolocation.io](https://ipgeolocation.io/) and [IPregistry](https://ipregistry.co/) are data/API-oriented competitors. Their feature tiers distinguish basic location/ASN from paid VPN/proxy/Tor, company and abuse fields. References: [ipapi.is competitor overview](https://ipapi.is/competitors.html), [Geekflare IP API comparison](https://geekflare.com/guides/geolocation-ip-api/).

**Action:** position DigDevBox as a free lookup utility only for fields actually returned. Do not claim city-level precision, VPN detection, threat intelligence or a production API if absent. Separate IP lookup, subnet/CIDR and DNS/rDNS intents when distinct workflows exist. Explain geolocation uncertainty; IP location is not a person's precise physical location.

## Market exclusions and cross-site cannibalization

- Fangdai is outside the current US/EU growth strategy; no English keyword expansion in this phase.
- Main-site image resize/crop and DigImg compression/format conversion must have distinct primary intents.
- Main Dev Tools and StreamPlay should not compete for the same M3U8 player primary query.
- TTS Reader should not use TTSReader.com brand queries as its main acquisition strategy.
- Forge Notes is the editorial layer: each guide answers a distinct question and links to one relevant tool; no duplicate tool landing pages.

## Sources

- DigImg comparison: https://dev.to/young_y/i-measured-digimg-vs-tinypng-vs-shortpixel-on-the-same-images-bytes-ssim-5h4i
- DigImg 100KB comparison: https://dev.to/young_y/i-gave-3-image-compressors-a-hard-100kb-limit-only-one-hit-it-automatically-2oel
- ImageForge repository: https://github.com/yqh-core/imageforge
- StreamPlay repository: https://github.com/yqh-core/streamplay
- Geek Typing repository: https://github.com/yqh-core/geek-typing
- TTSReader.com: https://ttsreader.com/
