const {
  validateTubiUrl,
  extractSeriesId,
  normalizeUrl,
  formatElapsedTime,
  removeDuplicateUrls,
  parseUrlsFromText,
  countUniqueUrls
} = require('../app/utils');

describe('validateTubiUrl', () => {
  test('should return true for valid series URLs', () => {
    expect(validateTubiUrl('https://tubitv.com/series/300005112/the-rifleman')).toBe(true);
    expect(validateTubiUrl('https://tubitv.com/tv-shows/12345')).toBe(true);
    expect(validateTubiUrl('http://tubitv.com/series/123/test')).toBe(true);
    expect(validateTubiUrl('tubitv.com/series/123')).toBe(true);
  });

  test('should return true for valid tv-shows URLs', () => {
    expect(validateTubiUrl('https://tubitv.com/tv-shows/123456')).toBe(true);
    expect(validateTubiUrl('https://www.tubitv.com/tv-shows/789')).toBe(true);
  });

  test('should return false for invalid URLs', () => {
    expect(validateTubiUrl('')).toBe(false);
    expect(validateTubiUrl('   ')).toBe(false);
    expect(validateTubiUrl('https://example.com')).toBe(false);
    expect(validateTubiUrl('https://youtube.com')).toBe(false);
    expect(validateTubiUrl('not-a-url')).toBe(false);
  });

  test('should return false for null or undefined', () => {
    expect(validateTubiUrl(null)).toBe(false);
    expect(validateTubiUrl(undefined)).toBe(false);
  });

  test('should be case insensitive', () => {
    expect(validateTubiUrl('https://TUBITV.COM/SERIES/123')).toBe(true);
    expect(validateTubiUrl('https://TubiTV.com/Tv-Shows/456')).toBe(true);
  });
});

describe('extractSeriesId', () => {
  test('should extract series ID from tv-shows URLs', () => {
    expect(extractSeriesId('https://tubitv.com/tv-shows/12345')).toBe('12345');
    expect(extractSeriesId('https://tubitv.com/tv-shows/999999/test')).toBe('999999');
  });

  test('should extract series ID from series URLs', () => {
    expect(extractSeriesId('https://tubitv.com/series/300005112/the-rifleman')).toBe('300005112');
    expect(extractSeriesId('https://tubitv.com/series/123')).toBe('123');
  });

  test('should extract series ID from numbered series URLs', () => {
    expect(extractSeriesId('https://tubitv.com/12345/series/show-name')).toBe('12345');
  });

  test('should return null for URLs without series ID', () => {
    expect(extractSeriesId('https://tubitv.com')).toBe(null);
    expect(extractSeriesId('https://example.com/series/123')).toBe(null);
    expect(extractSeriesId('')).toBe(null);
    expect(extractSeriesId(null)).toBe(null);
  });
});

describe('normalizeUrl', () => {
  test('should return full URLs as-is', () => {
    expect(normalizeUrl('https://tubitv.com/tv-shows/123'))
      .toBe('https://tubitv.com/tv-shows/123');
    expect(normalizeUrl('http://example.com/path'))
      .toBe('http://example.com/path');
  });

  test('should prepend domain to relative URLs', () => {
    expect(normalizeUrl('/tv-shows/123')).toBe('https://tubitv.com/tv-shows/123');
    expect(normalizeUrl('/series/456/show')).toBe('https://tubitv.com/series/456/show');
    expect(normalizeUrl('/watch/789')).toBe('https://tubitv.com/watch/789');
  });

  test('should return null for null or undefined', () => {
    expect(normalizeUrl(null)).toBe(null);
    expect(normalizeUrl(undefined)).toBe(null);
    expect(normalizeUrl('')).toBe(null);
  });
});

describe('formatElapsedTime', () => {
  test('should format seconds correctly', () => {
    expect(formatElapsedTime(1000)).toBe('1s');
    expect(formatElapsedTime(5000)).toBe('5s');
    expect(formatElapsedTime(59000)).toBe('59s');
  });

  test('should format minutes and seconds correctly', () => {
    expect(formatElapsedTime(60000)).toBe('1m 0s');
    expect(formatElapsedTime(65000)).toBe('1m 5s');
    expect(formatElapsedTime(125000)).toBe('2m 5s');
    expect(formatElapsedTime(300000)).toBe('5m 0s');
  });

  test('should handle zero and small values', () => {
    expect(formatElapsedTime(0)).toBe('0s');
    expect(formatElapsedTime(500)).toBe('0s');
    expect(formatElapsedTime(999)).toBe('0s');
  });
});

describe('removeDuplicateUrls', () => {
  test('should remove duplicate URLs', () => {
    const urls = [
      'https://tubitv.com/tv-shows/123',
      'https://tubitv.com/tv-shows/456',
      'https://tubitv.com/tv-shows/123',
      'https://tubitv.com/tv-shows/456'
    ];
    const result = removeDuplicateUrls(urls);
    expect(result).toHaveLength(2);
    expect(result).toContain('https://tubitv.com/tv-shows/123');
    expect(result).toContain('https://tubitv.com/tv-shows/456');
  });

  test('should filter out null and undefined values', () => {
    const urls = [
      'https://tubitv.com/tv-shows/123',
      null,
      'https://tubitv.com/tv-shows/456',
      undefined,
      ''
    ];
    const result = removeDuplicateUrls(urls);
    expect(result).toHaveLength(2);
  });

  test('should return empty array for empty input', () => {
    expect(removeDuplicateUrls([])).toEqual([]);
  });

  test('should preserve order of first occurrence', () => {
    const urls = [
      'https://tubitv.com/tv-shows/1',
      'https://tubitv.com/tv-shows/2',
      'https://tubitv.com/tv-shows/1',
      'https://tubitv.com/tv-shows/3'
    ];
    const result = removeDuplicateUrls(urls);
    expect(result).toEqual([
      'https://tubitv.com/tv-shows/1',
      'https://tubitv.com/tv-shows/2',
      'https://tubitv.com/tv-shows/3'
    ]);
  });
});

describe('parseUrlsFromText', () => {
  test('should parse space-separated URLs', () => {
    const text = 'https://tubitv.com/tv-shows/123 https://tubitv.com/tv-shows/456';
    expect(parseUrlsFromText(text)).toEqual([
      'https://tubitv.com/tv-shows/123',
      'https://tubitv.com/tv-shows/456'
    ]);
  });

  test('should parse newline-separated URLs', () => {
    const text = 'https://tubitv.com/tv-shows/123\nhttps://tubitv.com/tv-shows/456';
    expect(parseUrlsFromText(text)).toEqual([
      'https://tubitv.com/tv-shows/123',
      'https://tubitv.com/tv-shows/456'
    ]);
  });

  test('should handle mixed whitespace', () => {
    const text = '  https://tubitv.com/tv-shows/123   \n  https://tubitv.com/tv-shows/456  ';
    expect(parseUrlsFromText(text)).toEqual([
      'https://tubitv.com/tv-shows/123',
      'https://tubitv.com/tv-shows/456'
    ]);
  });

  test('should return empty array for empty or whitespace-only text', () => {
    expect(parseUrlsFromText('')).toEqual([]);
    expect(parseUrlsFromText('   ')).toEqual([]);
    expect(parseUrlsFromText('\n\n')).toEqual([]);
  });
});

describe('countUniqueUrls', () => {
  test('should count unique URLs', () => {
    const text = 'https://tubitv.com/tv-shows/123 https://tubitv.com/tv-shows/456';
    expect(countUniqueUrls(text)).toBe(2);
  });

  test('should not count duplicates', () => {
    const text = 'https://tubitv.com/tv-shows/123 https://tubitv.com/tv-shows/123';
    expect(countUniqueUrls(text)).toBe(1);
  });

  test('should return 0 for empty text', () => {
    expect(countUniqueUrls('')).toBe(0);
    expect(countUniqueUrls('   ')).toBe(0);
  });
});
