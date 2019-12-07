# gphotos-puppeteer

Download Google Photos with puppeteer

## TODO

- `mkdir -p data/..`
- Manage Windows (n workers)
- Create Queue (done enqueing,done processing)
- Downloader (move file, report size, status)
- Report Speed for listing, downloading
- Tests (Queue,Metrics)
- Multiple Profiles
- State (DB...)
- Gatsby Site for monitoring, browsing
- Alternative for listing with Google [Photos Library API](https://developers.google.com/photos/library/reference/rest)

## Open new window

This works from the console!

I think we need both a size, and a unique name

```js
window.open(
  "https://photos.google.com/",
  "Worker1",
  "width=640,height=400"
)
window.open(
  "https://photos.google.com/",
  "Worker2",
  "width=640,height=400"
)

```
