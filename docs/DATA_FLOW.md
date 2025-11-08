# Data Flow

```
[User Enters Series URL]
        ↓
[Electron Renderer]
        ↓
[Main Process → Puppeteer]
        ↓
[Fetch Series Data → API or Rendered DOM]
        ↓
[Extract Episode Details]
        ↓
[Write to Output File]
```

## Data Fields
- `series_title`
- `season_number`
- `episode_title`
- `episode_url`
