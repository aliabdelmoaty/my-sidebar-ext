/**
 * Background script for header stripping
 * Removes X-Frame-Options and CSP headers to allow embedding sites in iframe
 */

// Headers to remove for iframe embedding
const HEADERS_TO_REMOVE = [
  'x-frame-options',
  'content-security-policy',
  'x-content-security-policy'
];

/**
 * Listener for HTTP responses - strips restrictive headers
 */
browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    // Filter out headers that prevent iframe embedding
    const filteredHeaders = details.responseHeaders.filter(header => {
      const headerName = header.name.toLowerCase();
      return !HEADERS_TO_REMOVE.includes(headerName);
    });

    return { responseHeaders: filteredHeaders };
  },
  {
    urls: ['<all_urls>'],
    types: ['sub_frame'] // Only apply to iframes, not main frames
  },
  ['blocking', 'responseHeaders']
);

console.log('Sidebar Extension: Header stripping enabled');

