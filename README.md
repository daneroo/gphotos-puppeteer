# gphotos-puppeteer

Download Google Photos with puppeteer

## TODO

- refactor navN
- dowload deny?
- include bandwidth in metrics?
- yargs headless, num, verify, list, optimistic
- See also: <https://github.com/daneroo/chromedp-manytabs>
- `mkdir -p data/workers/n`
- Manage Windows (n workers)
- Create Queue (done enqueing,done processing)
- Downloader (move file, report size, status)
- CI (github actions), evergreen et all
- Benchmarks (Queue,Metrics)
- Multiple Profiles
- State (DB...)
- Gatsby Site for monitoring, browsing
- Alternative for listing with Google [Photos Library API](https://developers.google.com/photos/library/reference/rest)

## Stability

### nojunk (30386 items)

```bash
::run n:30387 unresolved:29 elapsed:13958.320s (232 minutes, batchSize=1000)
::run batch:200 n:30387 unresolved:50:: rate:2.72 elapsed:11165.720s (186 minutes, batchSize=200)
::run batch:200 n:30387 unresolved:87:: rate:2.55/s avg:392.70ms n:30387 elapsed:11933.0139s

21891 uniqe files..
```

## Queue Operation

The requirement of the que structure is that any puppeteer interactions must happen on the same *thread*.
Wether that is navigating in the main window to find tasks, as well as performing the downloads in the worker windows. Otherwise puppeteer gets very confused.

When the consumer (i.e. downloader) navigates to a page ans initiates the download that must happen to the exclusion of other puppeteer interactions, but waiting for, and processing the download may happen concurrently.
Furthermore when a new download task is iitiated we must track to which worker it is assigned, making sure that busy workers are left alone.

Similarly when the Main window is searching for new work, that also must happen to the exclusion of any other puppeteer activity.

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
