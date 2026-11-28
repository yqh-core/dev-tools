export const codesByCategories: {
  category: string
  codes: {
    code: number
    name: string
    description: string
    type: 'HTTP' | 'WebDav'
  }[]
}[] = [
  {
    category: '1xx informational response',
    codes: [
      {
        code: 100,
        name: 'Continue',
        description: 'Waiting for the client to emit the body of the request.',
        type: 'HTTP',
      },
      {
        code: 101,
        name: 'Switching Protocols',
        description: 'The server has agreed to change protocol.',
        type: 'HTTP',
      },
      {
        code: 102,
        name: 'Processing',
        description: 'Legacy WebDAV interim response. It was removed from RFC 4918 because it lacked implementation; IANA retains the historical RFC 2518 registration.',
        type: 'WebDav',
      },
      {
        code: 103,
        name: 'Early Hints',
        description: 'The server returns some response headers before final HTTP message.',
        type: 'HTTP',
      },
      {
        code: 104,
        name: 'Upload Resumption Supported',
        description: 'Temporary IANA registration for resumable uploads. Check the current registry entry before relying on it; the published registry snapshot shows an expiry date that has passed.',
        type: 'HTTP',
      },
    ],
  },
  {
    category: '2xx success',
    codes: [
      {
        code: 200,
        name: 'OK',
        description: 'Standard response for successful HTTP requests.',
        type: 'HTTP',
      },
      {
        code: 201,
        name: 'Created',
        description: 'The request has been fulfilled, resulting in the creation of a new resource.',
        type: 'HTTP',
      },
      {
        code: 202,
        name: 'Accepted',
        description: 'The request has been accepted for processing, but the processing has not been completed.',
        type: 'HTTP',
      },
      {
        code: 203,
        name: 'Non-Authoritative Information',
        description:
          'The request is successful but the content of the original request has been modified by a transforming proxy.',
        type: 'HTTP',
      },
      {
        code: 204,
        name: 'No Content',
        description: 'The server successfully processed the request and is not returning any content.',
        type: 'HTTP',
      },
      {
        code: 205,
        name: 'Reset Content',
        description: 'The server indicates to reinitialize the document view which sent this request.',
        type: 'HTTP',
      },
      {
        code: 206,
        name: 'Partial Content',
        description: 'The server is delivering only part of the resource due to a range header sent by the client.',
        type: 'HTTP',
      },
      {
        code: 207,
        name: 'Multi-Status',
        description:
          'The message body that follows is an XML message and can contain a number of separate response codes.',
        type: 'WebDav',
      },
      {
        code: 208,
        name: 'Already Reported',
        description:
          'The members of a DAV binding have already been enumerated in a preceding part of the (multistatus) response.',
        type: 'WebDav',
      },
      {
        code: 226,
        name: 'IM Used',
        description:
          'The server has fulfilled a request for the resource, and the response is a representation of the result.',
        type: 'HTTP',
      },
    ],
  },
  {
    category: '3xx redirection',
    codes: [
      {
        code: 300,
        name: 'Multiple Choices',
        description: 'Indicates multiple options for the resource that the client may follow.',
        type: 'HTTP',
      },
      {
        code: 301,
        name: 'Moved Permanently',
        description: 'The target resource has a new permanent URI. User agents may change POST to GET when following this redirect; use 308 when the method must be preserved.',
        type: 'HTTP',
      },
      {
        code: 302,
        name: 'Found',
        description: 'The target resource is temporarily available at another URI. User agents may change POST to GET when following it; use 307 when the method must be preserved.',
        type: 'HTTP',
      },
      {
        code: 303,
        name: 'See Other',
        description: 'The response points to another URI containing an indirect response; the client retrieves it with GET (or HEAD when appropriate).',
        type: 'HTTP',
      },
      {
        code: 304,
        name: 'Not Modified',
        description:
          'Indicates that the resource has not been modified since the version specified by the request headers.',
        type: 'HTTP',
      },
      {
        code: 305,
        name: 'Use Proxy',
        description: 'Deprecated. This status code must not be generated because in-band proxy configuration creates security risks.',
        type: 'HTTP',
      },
      {
        code: 306,
        name: '(Unused)',
        description: 'Unused and reserved. It has no current standard semantics.',
        type: 'HTTP',
      },
      {
        code: 307,
        name: 'Temporary Redirect',
        description: 'The target resource is temporarily available at another URI. A user agent must not change the request method when automatically following this redirect.',
        type: 'HTTP',
      },
      {
        code: 308,
        name: 'Permanent Redirect',
        description: 'The target resource has a new permanent URI. A user agent must not change the request method when automatically following this redirect.',
        type: 'HTTP',
      },
    ],
  },
  {
    category: '4xx client error',
    codes: [
      {
        code: 400,
        name: 'Bad Request',
        description: 'The server cannot or will not process the request due to an apparent client error.',
        type: 'HTTP',
      },
      {
        code: 401,
        name: 'Unauthorized',
        description: 'The request lacks valid authentication credentials for the target resource. The server must send a WWW-Authenticate challenge.',
        type: 'HTTP',
      },
      {
        code: 402,
        name: 'Payment Required',
        description: 'Reserved for future use. Payment-related behavior implemented by a service is application-specific unless separately standardized.',
        type: 'HTTP',
      },
      {
        code: 403,
        name: 'Forbidden',
        description: 'The server understood the request but refuses to fulfill it. This does not by itself mean the user is authenticated.',
        type: 'HTTP',
      },
      {
        code: 404,
        name: 'Not Found',
        description: 'The requested resource could not be found but may be available in the future.',
        type: 'HTTP',
      },
      {
        code: 405,
        name: 'Method Not Allowed',
        description: 'A request method is not supported for the requested resource.',
        type: 'HTTP',
      },
      {
        code: 406,
        name: 'Not Acceptable',
        description:
          'The requested resource is capable of generating only content not acceptable according to the Accept headers sent in the request.',
        type: 'HTTP',
      },
      {
        code: 407,
        name: 'Proxy Authentication Required',
        description: 'The client must first authenticate itself with the proxy.',
        type: 'HTTP',
      },
      {
        code: 408,
        name: 'Request Timeout',
        description: 'The server timed out waiting for the request.',
        type: 'HTTP',
      },
      {
        code: 409,
        name: 'Conflict',
        description:
          'Indicates that the request could not be processed because of conflict in the request, such as an edit conflict.',
        type: 'HTTP',
      },
      {
        code: 410,
        name: 'Gone',
        description: 'Indicates that the resource requested is no longer available and will not be available again.',
        type: 'HTTP',
      },
      {
        code: 411,
        name: 'Length Required',
        description:
          'The request did not specify the length of its content, which is required by the requested resource.',
        type: 'HTTP',
      },
      {
        code: 412,
        name: 'Precondition Failed',
        description: 'The server does not meet one of the preconditions that the requester put on the request.',
        type: 'HTTP',
      },
      {
        code: 413,
        name: 'Content Too Large',
        description: 'The request content is larger than the server is willing or able to process. A temporary limit may be accompanied by Retry-After.',
        type: 'HTTP',
      },
      {
        code: 414,
        name: 'URI Too Long',
        description: 'The URI provided was too long for the server to process.',
        type: 'HTTP',
      },
      {
        code: 415,
        name: 'Unsupported Media Type',
        description: 'The request entity has a media type which the server or resource does not support.',
        type: 'HTTP',
      },
      {
        code: 416,
        name: 'Range Not Satisfiable',
        description: 'The client has asked for a portion of the file, but the server cannot supply that portion.',
        type: 'HTTP',
      },
      {
        code: 417,
        name: 'Expectation Failed',
        description: 'The server cannot meet the requirements of the Expect request-header field.',
        type: 'HTTP',
      },
      {
        code: 418,
        name: '(Unused)',
        description: 'Unused. The former “I\'m a teapot” wording was an April Fools\' joke and is not a current standard status meaning.',
        type: 'HTTP',
      },
      {
        code: 421,
        name: 'Misdirected Request',
        description: 'The request was directed at a server that is not able to produce a response.',
        type: 'HTTP',
      },
      {
        code: 422,
        name: 'Unprocessable Content',
        description: 'The server understands the content type and syntax, but cannot process the contained instructions.',
        type: 'HTTP',
      },
      {
        code: 423,
        name: 'Locked',
        description: 'The resource that is being accessed is locked.',
        type: 'WebDav',
      },
      {
        code: 424,
        name: 'Failed Dependency',
        description: 'The request failed due to failure of a previous request.',
        type: 'WebDav',
      },
      {
        code: 425,
        name: 'Too Early',
        description: 'Indicates that the server is unwilling to risk processing a request that might be replayed.',
        type: 'HTTP',
      },
      {
        code: 426,
        name: 'Upgrade Required',
        description: 'The client should switch to a different protocol such as TLS/1.0.',
        type: 'HTTP',
      },
      {
        code: 428,
        name: 'Precondition Required',
        description: 'The origin server requires the request to be conditional.',
        type: 'HTTP',
      },
      {
        code: 429,
        name: 'Too Many Requests',
        description: 'The client sent too many requests in a given period. The response may include Retry-After; honor it when present.',
        type: 'HTTP',
      },
      {
        code: 431,
        name: 'Request Header Fields Too Large',
        description:
          'The server is unwilling to process the request because either an individual header field, or all the header fields collectively, are too large.',
        type: 'HTTP',
      },
      {
        code: 451,
        name: 'Unavailable For Legal Reasons',
        description:
          'A server operator has received a legal demand to deny access to a resource or to a set of resources that includes the requested resource.',
        type: 'HTTP',
      },
    ],
  },
  {
    category: '5xx server error',
    codes: [
      {
        code: 500,
        name: 'Internal Server Error',
        description:
          'A generic error message, given when an unexpected condition was encountered and no more specific message is suitable.',
        type: 'HTTP',
      },
      {
        code: 501,
        name: 'Not Implemented',
        description:
          'The server either does not recognize the request method, or it lacks the ability to fulfill the request.',
        type: 'HTTP',
      },
      {
        code: 502,
        name: 'Bad Gateway',
        description:
          'The server was acting as a gateway or proxy and received an invalid response from the upstream server.',
        type: 'HTTP',
      },
      {
        code: 503,
        name: 'Service Unavailable',
        description: 'The server is currently unavailable (because it is overloaded or down for maintenance).',
        type: 'HTTP',
      },
      {
        code: 504,
        name: 'Gateway Timeout',
        description:
          'The server was acting as a gateway or proxy and did not receive a timely response from the upstream server.',
        type: 'HTTP',
      },
      {
        code: 505,
        name: 'HTTP Version Not Supported',
        description: 'The server does not support the HTTP protocol version used in the request.',
        type: 'HTTP',
      },
      {
        code: 506,
        name: 'Variant Also Negotiates',
        description: 'Transparent content negotiation for the request results in a circular reference.',
        type: 'HTTP',
      },
      {
        code: 507,
        name: 'Insufficient Storage',
        description: 'The server is unable to store the representation needed to complete the request.',
        type: 'WebDav',
      },
      {
        code: 508,
        name: 'Loop Detected',
        description: 'The server detected an infinite loop while processing the request.',
        type: 'WebDav',
      },
      {
        code: 510,
        name: 'Not Extended',
        description: 'Obsoleted. The former extension-mechanism status is no longer part of the current HTTP status-code registry.',
        type: 'HTTP',
      },
      {
        code: 511,
        name: 'Network Authentication Required',
        description: 'The client needs to authenticate to gain network access.',
        type: 'HTTP',
      },
    ],
  },
];


/** IANA/RFC lifecycle labels that are not implied by the numeric status class. */
export const registryStatusByCode: Record<number, 'temporary' | 'deprecated' | 'unused' | 'reserved' | 'obsolete' | 'legacy'> = {
  102: 'legacy',
  104: 'temporary',
  305: 'deprecated',
  306: 'unused',
  402: 'reserved',
  418: 'unused',
  510: 'obsolete',
};
