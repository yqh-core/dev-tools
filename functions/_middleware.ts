interface PagesContext {
  request: Request
  next: () => Promise<Response>
}

/**
 * Redirect the apex host and HTTP requests to the single HTTPS www origin.
 * Path and query are preserved; unrelated hosts pass through untouched.
 */
export async function onRequest(context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url)
  const host = url.hostname.toLowerCase()

  if (host === 'digdevbox.com') {
    url.hostname = 'www.digdevbox.com'
    url.protocol = 'https:'
    return Response.redirect(url.toString(), 301)
  }

  if (host === 'www.digdevbox.com' && url.protocol === 'http:') {
    url.protocol = 'https:'
    return Response.redirect(url.toString(), 301)
  }

  return context.next()
}
