/**
 * Utility functions for Tubi Crawler
 * Extracted from main.js and renderer.js for testing
 */

/**
 * Validates if a URL is a valid Tubi series URL
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if valid Tubi series URL
 */
function validateTubiUrl(url) {
  if (!url || url.trim() === '') {
    return false;
  }

  const tubiPatterns = [
    /tubitv\.com\/series/i,
    /tubitv\.com\/\d+\/series/i,
    /tubitv\.com\/tv-shows\/\d+/i
  ];

  return tubiPatterns.some(pattern => pattern.test(url));
}

/**
 * Extracts series ID from a Tubi URL
 * @param {string} url - The Tubi URL
 * @returns {string|null} - The series ID or null if not found
 */
function extractSeriesId(url) {
  if (!url) return null;
  
  // Only extract from tubitv.com domains
  if (!url.includes('tubitv.com')) return null;
  
  const matches = 
    url.match(/tv-shows\/(\d+)/) || 
    url.match(/series\/(\d+)/) ||
    url.match(/\/(\d+)\/series/);
  
  return matches ? matches[1] : null;
}

/**
 * Normalizes a URL to full format
 * @param {string} href - The href attribute value
 * @returns {string|null} - The full URL or null if invalid
 */
function normalizeUrl(href) {
  if (!href) return null;
  return href.startsWith('http') ? href : `https://tubitv.com${href}`;
}

/**
 * Formats elapsed time into human readable string
 * @param {number} elapsedMs - Elapsed time in milliseconds
 * @returns {string} - Formatted time string
 */
function formatElapsedTime(elapsedMs) {
  const seconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Removes duplicate URLs from an array
 * @param {string[]} urls - Array of URLs
 * @returns {string[]} - Array of unique URLs
 */
function removeDuplicateUrls(urls) {
  return Array.from(new Set(urls.filter(Boolean)));
}

/**
 * Parses URLs from text content (one per line or space-separated)
 * @param {string} text - Text content containing URLs
 * @returns {string[]} - Array of URLs
 */
function parseUrlsFromText(text) {
  if (!text || text.trim() === '') {
    return [];
  }
  return text.trim().split(/\n+/).filter(u => u.length > 0);
}

/**
 * Counts unique URLs from text content
 * @param {string} text - Text content containing URLs
 * @returns {number} - Count of unique URLs
 */
function countUniqueUrls(text) {
  const urls = parseUrlsFromText(text);
  return removeDuplicateUrls(urls).length;
}

module.exports = {
  validateTubiUrl,
  extractSeriesId,
  normalizeUrl,
  formatElapsedTime,
  removeDuplicateUrls,
  parseUrlsFromText,
  countUniqueUrls
};
