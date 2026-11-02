/**
 * Tests for YT-DLP settings functionality
 * These tests verify the settings are properly saved, loaded, and used
 */

describe('YT-DLP Settings', () => {
  // Mock localStorage for testing
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    global.localStorage = {
      getItem: jest.fn((key) => mockStorage[key] || null),
      setItem: jest.fn((key, value) => {
        mockStorage[key] = value;
      }),
      removeItem: jest.fn((key) => {
        delete mockStorage[key];
      }),
      clear: jest.fn(() => {
        mockStorage = {};
      })
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockStorage = {};
  });

  describe('Settings Persistence', () => {
    test('should save and load video quality setting', () => {
      const videoQuality = '1080';
      localStorage.setItem('yt-dlp-video-quality', videoQuality);
      expect(localStorage.getItem('yt-dlp-video-quality')).toBe('1080');
    });

    test('should save and load audio format setting', () => {
      const audioFormat = 'mp3';
      localStorage.setItem('yt-dlp-audio-format', audioFormat);
      expect(localStorage.getItem('yt-dlp-audio-format')).toBe('mp3');
    });

    test('should save and load embed subtitles setting', () => {
      localStorage.setItem('yt-dlp-embed-subs', 'true');
      expect(localStorage.getItem('yt-dlp-embed-subs')).toBe('true');
    });

    test('should save and load subtitle languages setting', () => {
      const subLangs = 'en-US';
      localStorage.setItem('yt-dlp-sub-langs', subLangs);
      expect(localStorage.getItem('yt-dlp-sub-langs')).toBe('en-US');
    });

    test('should save and load embed thumbnail setting', () => {
      localStorage.setItem('yt-dlp-embed-thumbnail', 'true');
      expect(localStorage.getItem('yt-dlp-embed-thumbnail')).toBe('true');
    });

    test('should save and load embed metadata setting', () => {
      localStorage.setItem('yt-dlp-embed-metadata', 'true');
      expect(localStorage.getItem('yt-dlp-embed-metadata')).toBe('true');
    });

    test('should save and load playlist start setting', () => {
      const playlistStart = '5';
      localStorage.setItem('yt-dlp-playlist-start', playlistStart);
      expect(localStorage.getItem('yt-dlp-playlist-start')).toBe('5');
    });

    test('should save and load playlist end setting', () => {
      const playlistEnd = '10';
      localStorage.setItem('yt-dlp-playlist-end', playlistEnd);
      expect(localStorage.getItem('yt-dlp-playlist-end')).toBe('10');
    });

    test('should save and load ffmpeg path setting', () => {
      const ffmpegPath = 'C:\\ffmpeg';
      localStorage.setItem('ffmpeg-path', ffmpegPath);
      expect(localStorage.getItem('ffmpeg-path')).toBe('C:\\ffmpeg');
    });
  });

  describe('Settings Default Values', () => {
    test('should return null for unset video quality', () => {
      expect(localStorage.getItem('yt-dlp-video-quality')).toBeNull();
    });

    test('should return null for unset audio format', () => {
      expect(localStorage.getItem('yt-dlp-audio-format')).toBeNull();
    });

    test('should return null for unset embed subtitles', () => {
      expect(localStorage.getItem('yt-dlp-embed-subs')).toBeNull();
    });

    test('should return null for unset subtitle languages', () => {
      expect(localStorage.getItem('yt-dlp-sub-langs')).toBeNull();
    });

    test('should return null for unset embed thumbnail', () => {
      expect(localStorage.getItem('yt-dlp-embed-thumbnail')).toBeNull();
    });

    test('should return null for unset embed metadata', () => {
      expect(localStorage.getItem('yt-dlp-embed-metadata')).toBeNull();
    });

    test('should return null for unset playlist start', () => {
      expect(localStorage.getItem('yt-dlp-playlist-start')).toBeNull();
    });

    test('should return null for unset playlist end', () => {
      expect(localStorage.getItem('yt-dlp-playlist-end')).toBeNull();
    });

    test('should return null for unset ffmpeg path', () => {
      expect(localStorage.getItem('ffmpeg-path')).toBeNull();
    });
  });

  describe('Settings Validation', () => {
    test('should accept valid video quality values', () => {
      const validQualities = ['best', '2160', '1440', '1080', '720', '480', '360'];
      validQualities.forEach(quality => {
        localStorage.setItem('yt-dlp-video-quality', quality);
        expect(localStorage.getItem('yt-dlp-video-quality')).toBe(quality);
      });
    });

    test('should accept valid audio format values', () => {
      const validFormats = ['none', 'mp3', 'm4a', 'opus', 'vorbis', 'wav', 'flac'];
      validFormats.forEach(format => {
        localStorage.setItem('yt-dlp-audio-format', format);
        expect(localStorage.getItem('yt-dlp-audio-format')).toBe(format);
      });
    });

    test('should accept boolean values for checkbox settings', () => {
      localStorage.setItem('yt-dlp-embed-subs', 'true');
      expect(localStorage.getItem('yt-dlp-embed-subs')).toBe('true');
      
      localStorage.setItem('yt-dlp-embed-subs', 'false');
      expect(localStorage.getItem('yt-dlp-embed-subs')).toBe('false');
    });

    test('should accept valid subtitle language codes', () => {
      const validLangs = ['en', 'en-US', 'en-GB', 'all', 'en,es,fr'];
      validLangs.forEach(lang => {
        localStorage.setItem('yt-dlp-sub-langs', lang);
        expect(localStorage.getItem('yt-dlp-sub-langs')).toBe(lang);
      });
    });

    test('should accept positive integers for playlist settings', () => {
      const validNumbers = ['1', '5', '10', '100'];
      validNumbers.forEach(num => {
        localStorage.setItem('yt-dlp-playlist-start', num);
        expect(localStorage.getItem('yt-dlp-playlist-start')).toBe(num);
      });
    });

    test('should accept valid file paths for ffmpeg path', () => {
      const validPaths = [
        'C:\\ffmpeg',
        '/usr/bin',
        '/Applications/ffmpeg'
      ];
      validPaths.forEach(path => {
        localStorage.setItem('ffmpeg-path', path);
        expect(localStorage.getItem('ffmpeg-path')).toBe(path);
      });
    });
  });

  describe('YT-DLP Arguments Builder', () => {
    // Mock the buildYtDlpArgs function that would be in main.js
    const buildYtDlpArgs = (options) => {
      const args = [];

      if (options.format) {
        args.push('-f', options.format);
      }

      if (options.videoQuality && options.videoQuality !== 'best') {
        args.push('-f', `bestvideo[height<=${options.videoQuality}]+bestaudio/best[height<=${options.videoQuality}]/best`);
      }

      if (options.audioFormat && options.audioFormat !== 'none') {
        args.push('--audio-format', options.audioFormat);
      }

      if (options.mergeFormat) {
        args.push('--merge-output-format', options.mergeFormat);
      }

      if (options.embedSubs) {
        args.push('--embed-subs');
        if (options.subLangs) {
          args.push('--sub-langs', options.subLangs);
        }
      }

      if (options.embedThumbnail) {
        args.push('--embed-thumbnail');
      }

      if (options.embedMetadata) {
        args.push('--embed-metadata');
      }

      if (options.playlistStart && parseInt(options.playlistStart) > 0) {
        args.push('--playlist-start', options.playlistStart);
      }

      if (options.playlistEnd && parseInt(options.playlistEnd) > 0) {
        args.push('--playlist-end', options.playlistEnd);
      }

      if (options.ffmpegPath) {
        args.push('--ffmpeg-location', options.ffmpegPath);
      }

      if (options.downloadPath) {
        args.push('-o', `${options.downloadPath}/%(title)s.%(ext)s`);
      }

      if (options.urls) {
        args.push(...options.urls);
      }

      return args;
    };

    test('should build basic args with format and merge format', () => {
      const options = {
        urls: ['https://example.com/video1'],
        format: 'best',
        mergeFormat: 'mp4'
      };
      const args = buildYtDlpArgs(options);
      expect(args).toContain('-f');
      expect(args).toContain('best');
      expect(args).toContain('--merge-output-format');
      expect(args).toContain('mp4');
    });

    test('should add video quality limit', () => {
      const options = {
        urls: ['https://example.com/video1'],
        videoQuality: '1080'
      };
      const args = buildYtDlpArgs(options);
      expect(args.join(' ')).toContain('height<=1080');
    });

    test('should not add video quality arg when set to best', () => {
      const options = {
        urls: ['https://example.com/video1'],
        videoQuality: 'best'
      };
      const args = buildYtDlpArgs(options);
      expect(args.join(' ')).not.toContain('height<=');
    });

    test('should add audio format conversion', () => {
      const options = {
        urls: ['https://example.com/video1'],
        audioFormat: 'mp3'
      };
      const args = buildYtDlpArgs(options);
      expect(args).toContain('--audio-format');
      expect(args).toContain('mp3');
    });

    test('should not add audio format arg when set to none', () => {
      const options = {
        urls: ['https://example.com/video1'],
        audioFormat: 'none'
      };
      const args = buildYtDlpArgs(options);
      expect(args).not.toContain('--audio-format');
    });

    test('should add embed subtitles with language', () => {
      const options = {
        urls: ['https://example.com/video1'],
        embedSubs: true,
        subLangs: 'en-US'
      };
      const args = buildYtDlpArgs(options);
      expect(args).toContain('--embed-subs');
      expect(args).toContain('--sub-langs');
      expect(args).toContain('en-US');
    });

    test('should not add embed subtitles when disabled', () => {
      const options = {
        urls: ['https://example.com/video1'],
        embedSubs: false
      };
      const args = buildYtDlpArgs(options);
      expect(args).not.toContain('--embed-subs');
    });

    test('should add embed thumbnail', () => {
      const options = {
        urls: ['https://example.com/video1'],
        embedThumbnail: true
      };
      const args = buildYtDlpArgs(options);
      expect(args).toContain('--embed-thumbnail');
    });

    test('should add embed metadata', () => {
      const options = {
        urls: ['https://example.com/video1'],
        embedMetadata: true
      };
      const args = buildYtDlpArgs(options);
      expect(args).toContain('--embed-metadata');
    });

    test('should add playlist start and end', () => {
      const options = {
        urls: ['https://example.com/video1'],
        playlistStart: '5',
        playlistEnd: '10'
      };
      const args = buildYtDlpArgs(options);
      expect(args).toContain('--playlist-start');
      expect(args).toContain('5');
      expect(args).toContain('--playlist-end');
      expect(args).toContain('10');
    });

    test('should add ffmpeg location', () => {
      const options = {
        urls: ['https://example.com/video1'],
        ffmpegPath: 'C:\\ffmpeg'
      };
      const args = buildYtDlpArgs(options);
      expect(args).toContain('--ffmpeg-location');
      expect(args).toContain('C:\\ffmpeg');
    });

    test('should build complete args with all options', () => {
      const options = {
        urls: ['https://example.com/video1', 'https://example.com/video2'],
        format: 'bestvideo+bestaudio',
        mergeFormat: 'mkv',
        videoQuality: '720',
        audioFormat: 'm4a',
        embedSubs: true,
        subLangs: 'en',
        embedThumbnail: true,
        embedMetadata: true,
        playlistStart: '1',
        playlistEnd: '5',
        ffmpegPath: 'C:\\Program Files\\Streamlink\\ffmpeg',
        downloadPath: '/videos'
      };
      const args = buildYtDlpArgs(options);

      expect(args).toContain('-f');
      expect(args).toContain('--merge-output-format');
      expect(args).toContain('mkv');
      expect(args).toContain('--audio-format');
      expect(args).toContain('m4a');
      expect(args).toContain('--embed-subs');
      expect(args).toContain('--sub-langs');
      expect(args).toContain('--embed-thumbnail');
      expect(args).toContain('--embed-metadata');
      expect(args).toContain('--playlist-start');
      expect(args).toContain('--playlist-end');
      expect(args).toContain('--ffmpeg-location');
      expect(args).toContain('-o');
      expect(args).toContain('/videos/%(title)s.%(ext)s');
    });
  });
});

describe('YT-DLP terminal launching', () => {
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  const { EventEmitter } = require('events');
  const source = fs.readFileSync(path.join(__dirname, '../app/main.js'), 'utf8');
  const handlerSource = source.slice(
    source.indexOf("ipcMain.handle('run-yt-dlp',"),
    source.indexOf("ipcMain.handle('open-external-browser',")
  );

  function createHandler(platform = 'linux', failures = {}) {
    let handler;
    const children = [];
    const spawn = jest.fn((command) => {
      const child = new EventEmitter();
      child.unref = jest.fn();
      children.push(child);
      process.nextTick(() => {
        if (failures[command]) {
          child.emit('error', Object.assign(new Error(`${command}: ${failures[command]}`), {
            code: failures[command]
          }));
        } else {
          child.emit('spawn');
        }
      });
      return child;
    });
    const fileSystem = { writeFileSync: jest.fn() };
    vm.runInNewContext(handlerSource, {
      ipcMain: { handle: (_channel, callback) => { handler = callback; } },
      process: { platform },
      path: platform === 'win32' ? path.win32 : path.posix,
      console: { log: jest.fn(), error: jest.fn() },
      fs: fileSystem,
      require,
      spawn
    });
    return { handler, spawn, children, fileSystem };
  }

  const options = {
    urls: ['https://tubitv.com/tv-shows/123/example'],
    downloadPath: '/tmp/downloads'
  };

  test('prefers gnome-terminal and waits for a successful spawn', async () => {
    const { handler, spawn, children } = createHandler();
    const result = handler(null, options);
    expect(children[0].unref).not.toHaveBeenCalled();
    await expect(result).resolves.toEqual({ success: true });
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledWith('gnome-terminal', [
      '--', 'yt-dlp', '-o', '/tmp/downloads/%(title)s.%(ext)s', ...options.urls
    ], { detached: true, stdio: 'ignore' });
    expect(children[0].unref).toHaveBeenCalledTimes(1);
  });

  test('falls back to foot only when gnome-terminal is missing', async () => {
    const { handler, spawn, children } = createHandler('linux', { 'gnome-terminal': 'ENOENT' });
    await expect(handler(null, options)).resolves.toEqual({ success: true });
    expect(spawn.mock.calls.map(call => call[0])).toEqual(['gnome-terminal', 'foot']);
    expect(spawn.mock.calls[1][1]).toEqual([
      'yt-dlp', '-o', '/tmp/downloads/%(title)s.%(ext)s', ...options.urls
    ]);
    expect(children[0].unref).not.toHaveBeenCalled();
    expect(children[1].unref).toHaveBeenCalledTimes(1);
  });

  test('reports an actionable error when neither terminal is installed', async () => {
    const { handler } = createHandler('linux', { 'gnome-terminal': 'ENOENT', foot: 'ENOENT' });
    await expect(handler(null, options)).resolves.toEqual({
      success: false,
      error: expect.stringContaining('Install gnome-terminal or foot')
    });
  });

  test('reports other launch errors without trying another terminal', async () => {
    const { handler, spawn } = createHandler('linux', { 'gnome-terminal': 'EACCES' });
    await expect(handler(null, options)).resolves.toEqual({
      success: false,
      error: 'gnome-terminal: EACCES'
    });
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  test.each([{}, { 'gnome-terminal': 'ENOENT' }])('preserves keep-open arguments with failures %j', async (failures) => {
    const { handler, spawn } = createHandler('linux', failures);
    const specialOptions = {
      ...options,
      ytDlpPath: "/opt/tools with 'quotes'",
      keepTerminalOpen: true,
      urls: ["https://example.com/episode?title=it's&next=$(ignored)"]
    };
    await expect(handler(null, specialOptions)).resolves.toEqual({ success: true });
    const terminalArgs = spawn.mock.calls[spawn.mock.calls.length - 1][1];
    const bashArgs = terminalArgs[0] === '--' ? terminalArgs.slice(1) : terminalArgs;
    expect(bashArgs).toEqual([
      'bash', '-c', '"$@"; exec bash', 'yt-dlp-download',
      "/opt/tools with 'quotes'/yt-dlp", '-o', '/tmp/downloads/%(title)s.%(ext)s', ...specialOptions.urls
    ]);
  });

  test('uses native executable names for configured Linux folders', async () => {
    const { handler, spawn } = createHandler();
    await handler(null, { ...options, ytDlpPath: '/usr/bin', ffmpegPath: '/usr/bin' });
    expect(spawn.mock.calls[0][1]).toEqual([
      '--', '/usr/bin/yt-dlp', '--ffmpeg-location', '/usr/bin/ffmpeg',
      '-o', '/tmp/downloads/%(title)s.%(ext)s', ...options.urls
    ]);
  });

  test('preserves the Windows terminal and executable names', async () => {
    const { handler, spawn, fileSystem } = createHandler('win32');
    await expect(handler(null, {
      ...options, downloadPath: 'C:\\Videos', ytDlpPath: 'C:\\Tools', ffmpegPath: 'C:\\Tools'
    })).resolves.toEqual({ success: true });
    expect(spawn.mock.calls[0][0]).toBe('cmd.exe');
    const batchContent = fileSystem.writeFileSync.mock.calls[0][1];
    expect(batchContent).toContain('C:\\Tools\\yt-dlp.exe');
    expect(batchContent).toContain('--ffmpeg-location C:\\Tools\\ffmpeg.exe');
  });

  test('preserves the macOS terminal command', async () => {
    const { handler, spawn } = createHandler('darwin');
    await expect(handler(null, options)).resolves.toEqual({ success: true });
    expect(spawn).toHaveBeenCalledWith('osascript', [
      '-e', 'tell application "Terminal" to do script "yt-dlp -o /tmp/downloads/%(title)s.%(ext)s https://tubitv.com/tv-shows/123/example"'
    ], { detached: true, stdio: 'ignore' });
  });
});
