/**
 * Common HTML character entities reference — merged from the retired
 * `/legacy/htmlescapechar/` page (2026-10-17 C6). The escape/unescape boxes above
 * cover "convert my string"; this table covers "what is the entity for this char",
 * which the legacy page was actually for, so the legacy URL 301s here.
 *
 * char / named / decimal / hex are the four forms people cross-reference;
 * keep them ASCII-correct (the source table is HTML5 named character references).
 */
export interface HtmlEntityEntry {
  char: string
  named: string
  decimal: string
  hex: string
  desc: string
}

export const htmlEntityEntries: HtmlEntityEntry[] = [
  { char: '"', named: '&quot;', decimal: '&#34;', hex: '&#x22;', desc: 'Double quotation mark' },
  { char: '&', named: '&amp;', decimal: '&#38;', hex: '&#x26;', desc: 'Ampersand — must be escaped in HTML and attribute values' },
  { char: '<', named: '&lt;', decimal: '&#60;', hex: '&#x3C;', desc: 'Less-than sign — starts a tag, so escape it in text' },
  { char: '>', named: '&gt;', decimal: '&#62;', hex: '&#x3E;', desc: 'Greater-than sign — closes a tag' },
  { char: '\'', named: '&apos;', decimal: '&#39;', hex: '&#x27;', desc: 'Apostrophe / single quotation mark' },
  { char: ' ', named: '&nbsp;', decimal: '&#160;', hex: '&#xA0;', desc: 'Non-breaking space' },
  { char: '¡', named: '&iexcl;', decimal: '&#161;', hex: '&#xA1;', desc: 'Inverted exclamation mark' },
  { char: '«', named: '&laquo;', decimal: '&#171;', hex: '&#xAB;', desc: 'Left-pointing double angle quotation mark' },
  { char: '»', named: '&raquo;', decimal: '&#187;', hex: '&#xBB;', desc: 'Right-pointing double angle quotation mark' },
  { char: '×', named: '&times;', decimal: '&#215;', hex: '&#xD7;', desc: 'Multiplication sign' },
  { char: '÷', named: '&divide;', decimal: '&#247;', hex: '&#xF7;', desc: 'Division sign' },
  { char: '–', named: '&ndash;', decimal: '&#8211;', hex: '&#x2013;', desc: 'En dash' },
  { char: '—', named: '&mdash;', decimal: '&#8212;', hex: '&#x2014;', desc: 'Em dash' },
  { char: '‘', named: '&lsquo;', decimal: '&#8216;', hex: '&#x2018;', desc: 'Left single quotation mark' },
  { char: '’', named: '&rsquo;', decimal: '&#8217;', hex: '&#x2019;', desc: 'Right single quotation mark' },
  { char: '“', named: '&ldquo;', decimal: '&#8220;', hex: '&#x201C;', desc: 'Left double quotation mark' },
  { char: '”', named: '&rdquo;', decimal: '&#8221;', hex: '&#x201D;', desc: 'Right double quotation mark' },
  { char: '•', named: '&bull;', decimal: '&#8226;', hex: '&#x2022;', desc: 'Bullet' },
  { char: '…', named: '&hellip;', decimal: '&#8230;', hex: '&#x2026;', desc: 'Horizontal ellipsis' },
  { char: '™', named: '&trade;', decimal: '&#8482;', hex: '&#x2122;', desc: 'Trademark sign' },
  { char: '€', named: '&euro;', decimal: '&#8364;', hex: '&#x20AC;', desc: 'Euro sign' },
  { char: '©', named: '&copy;', decimal: '&#169;', hex: '&#xA9;', desc: 'Copyright sign' },
  { char: '®', named: '&reg;', decimal: '&#174;', hex: '&#xAE;', desc: 'Registered sign' },
  { char: '°', named: '&deg;', decimal: '&#176;', hex: '&#xB0;', desc: 'Degree sign' },
  { char: '±', named: '&plusmn;', decimal: '&#177;', hex: '&#xB1;', desc: 'Plus-minus sign' },
  { char: 'µ', named: '&micro;', decimal: '&#181;', hex: '&#xB5;', desc: 'Micro sign' },
  { char: '¶', named: '&para;', decimal: '&#182;', hex: '&#xB6;', desc: 'Pilcrow / paragraph sign' },
  { char: '¹', named: '&sup1;', decimal: '&#185;', hex: '&#xB9;', desc: 'Superscript one' },
  { char: '½', named: '&frac12;', decimal: '&#189;', hex: '&#xBD;', desc: 'Vulgar fraction one half' },
  { char: '£', named: '&pound;', decimal: '&#163;', hex: '&#xA3;', desc: 'Pound sign' },
  { char: '§', named: '&sect;', decimal: '&#167;', hex: '&#xA7;', desc: 'Section sign' },
  { char: 'α', named: '&alpha;', decimal: '&#945;', hex: '&#x3B1;', desc: 'Greek small letter alpha' },
  { char: 'π', named: '&pi;', decimal: '&#960;', hex: '&#x3C0;', desc: 'Greek small letter pi' },
  { char: 'Σ', named: '&Sigma;', decimal: '&#931;', hex: '&#x3A3;', desc: 'Greek capital letter sigma' },
  { char: '∞', named: '&infin;', decimal: '&#8734;', hex: '&#x221E;', desc: 'Infinity' },
  { char: '≠', named: '&ne;', decimal: '&#8800;', hex: '&#x2260;', desc: 'Not equal to' },
  { char: '≤', named: '&le;', decimal: '&#8804;', hex: '&#x2264;', desc: 'Less-than or equal to' },
  { char: '≥', named: '&ge;', decimal: '&#8805;', hex: '&#x2265;', desc: 'Greater-than or equal to' },
];
