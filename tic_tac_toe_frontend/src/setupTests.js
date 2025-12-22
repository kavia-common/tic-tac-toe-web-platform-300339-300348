/* eslint-disable no-undef */
// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

/**
 * Polyfill for File.prototype.text (and Blob.prototype.text as fallback) in jsdom.
 * - Only defines if not present.
 * - Uses FileReader when available; falls back to reading via Response/Blob.
 * - Works with both File and Blob instances created in tests.
 */
(function applyFileTextPolyfill() {
  // Guard if File or Blob is not available in the environment
  const hasFile = typeof File !== 'undefined';
  const hasBlob = typeof Blob !== 'undefined';

  // Helper: create a Promise that resolves with text content from a Blob/File.
  const readBlobAsText = (blob) => {
    // Prefer FileReader if available and functional
    if (typeof FileReader !== 'undefined') {
      try {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error || new Error('Failed to read blob as text'));
          // Some environments require readAsText; FileReader supports reading Blobs
          reader.readAsText(blob);
        });
      } catch (_e) {
        // Fall through to Response-based approach below
      }
    }
    // Fallback: use fetch/Response to read text
    try {
      // Construct a Response from the blob and call .text()
      return Promise.resolve(new Response(blob).text());
    } catch (e) {
      return Promise.reject(e);
    }
  };

  // Install on Blob.prototype if missing
  if (hasBlob && !Blob.prototype.text) {
    Object.defineProperty(Blob.prototype, 'text', {
      configurable: true,
      enumerable: false,
      writable: true,
      // Must not be arrow to preserve 'this'
      value: function text() {
        // 'this' is expected to be a Blob-like
        return readBlobAsText(this);
      },
    });
  }

  // Install on File.prototype if available and missing
  if (hasFile && !File.prototype.text) {
    Object.defineProperty(File.prototype, 'text', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: function text() {
        // File is a Blob subtype; reuse the same reader
        return readBlobAsText(this);
      },
    });
  }
})();
