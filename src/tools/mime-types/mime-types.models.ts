export interface MimeServerSnippets {
  nginx: string
  apache: string
  headers: string
}

/** Build server-specific rules from the mime-types extension mapping. */
export function createMimeServerSnippets(mimeType: string, extensions: string[]): MimeServerSnippets {
  const normalizedExtensions = [...new Set(
    extensions
      .map(extension => extension.trim().replace(/^\\.+/, ''))
      .filter(Boolean),
  )];

  if (normalizedExtensions.length === 0) {
    const empty = '# No known file extensions for ' + mimeType;
    return { nginx: empty, apache: empty, headers: empty };
  }

  return {
    nginx: ['types {', '    ' + mimeType + ' ' + normalizedExtensions.join(' ') + ';', '}'].join('\\n'),
    apache: 'AddType ' + mimeType + ' ' + normalizedExtensions.map(extension => '.' + extension).join(' '),
    headers: normalizedExtensions
      .map(extension => '/*.' + extension + '\\n  Content-Type: ' + mimeType)
      .join('\\n\\n'),
  };
}
