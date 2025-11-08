# Tubi API Notes

While not publicly documented, Tubi’s web app loads JSON data dynamically.

## Common Endpoints (observed)
- `/oz/videos/<id>`
- `/uapi/series/<series_id>/episodes`

These endpoints typically return episode objects containing:
```
{
  "id": "200141180",
  "title": "Changing Places",
  "season_number": 1,
  "episode_number": 1,
  "path": "/tv-shows/200141180/s01-e01-changing-places"
}
```

The app will attempt to discover and reuse these requests using Puppeteer’s `page.on('response')` listener.
