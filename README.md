# gphotos-puppeteer

Download Google Photos with puppeteer

## TODO

- replace stability charts below with screencaptures
- finish flow->rxlist->flow
- position First,Last, EnterDetail
- (firstnewest,lastoldest)
  - find from Main
  - iterator on Main/Detail
- off by one error counts (n, exists) -> persisted,deduped?
- explore <https://github.com/Qard/channel-surfer> as well as RxJS Subject - for Go architecture..
- Retry on failed download: XX nnnn Response (AF1Qi...)  was not resolved in 5000ms
- include bandwidth in metrics?
- See also: <https://github.com/daneroo/chromedp-manytabs>
- Manage Windows (n workers)
- CI (github actions)
  - renovate (vs greenkeeper, vs updatr)
- State (DB(kv),downloads,perkeep)
- Gatsby Site for monitoring, browsing
- Alternative for listing with Google [Photos Library API](https://developers.google.com/photos/library/reference/rest)

## Starting puppeteer's Chromium manually

One of my accounts does not allow me to log in to google with puppeteer's default options configured, the following invocation was sufficient to create a profile (manually) that could then be re-used with puppeteer's default options:

```bash
mkdir -p data/coco/user-data-dir

# Minimal:
/Users/daniel/Code/iMetrical/gphotos-puppeteer/node_modules/puppeteer/.local-chromium/mac-706915/chrome-mac/Chromium.app/Contents/MacOS/Chromium \
  --no-first-run \
  --password-store=basic \
  --use-mock-keychain \
  --user-data-dir=data/coco/user-data-dir \
  https://photos.google.com/
```

## Google Photos API

This is a *real mess*.

The Google Photo API does not allow downloading original media (stripped GEO in exif),
it does however return a `productUrl` in it's `mediaItems` results.

Fetching this productUrl actually redirects to a regular google photos url
e.g. `https://photos.google.com/lr/photo/AF0wucKA2Oypb0UBLHNLSuPadtZiwpLKG-Go0BoMqkg9xLha7UVfkU0zLLkOIIdbNedRHBMQsy1rfiJdEdwYAPcj4ss4003nhQ` redirects to `https://photos.google.com/photo/AF1QipPH5vnIJzbiPCXCNxtE3ZmpUJLeHL4VTmrcM57J`

Even by batching these `HEAD` requests (up to 30-40 at a time), we cannot achieve a rate faster than `20-30 url/s`
This can be done this way through puppeteer (using a batch of 2 here):

```js
const productUrls = [
  'https://photos.google.com/lr/photo/AF0wucKA2Oypb0UBLHNLSuPadtZiwpLKG-Go0BoMqkg9xLha7UVfkU0zLLkOIIdbNedRHBMQsy1rfiJdEdwYAPcj4ss4003nhQ',
  'https://photos.google.com/lr/photo/AF0wucLfuXfIhk8XYP1r4wN6F_IFhgSiygzwC7iftuitsGTNPKZfRMZefDJev6URAh66HBECdaBkNXs2qhJy6-zrIkgMGqa-sA'
]
const urls = await mainPage.evaluate(async (us) => {
  const ps = us.map(u => window.fetch(u, { method: 'HEAD' }))
  const rs = await Promise.all(ps)
  return rs.map(r => r.url)
}, productUrls)
console.log({ urls })
// urls: [
//   'https://photos.google.com/photo/AF1QipPH5vnIJzbiPCXCNxtE3ZmpUJLeHL4VTmrcM57J',
//   'https://photos.google.com/photo/AF1QipMOl0XXrO9WPSv5muLRBFpbyzGsdnrqUqtF8f73'
// ]
```

## Stability

### main (6959 items)

```bash
on dirac:
::run batch:200 n:6959 unresolved:31:: rate:2.52/s avg:396.93ms n:6959 elapsed:2762.2221s
::run batch:200 n:6959 unresolved:33:: rate:2.28/s avg:438.30ms n:6959 elapsed:3050.1437s

6947 files, 15600 MB
```

### nojunk (30386 items)

```bash
# on dirac:
::run n:30387 unresolved:29 elapsed:13958.320s (232 minutes, batchSize=1000)
::run batch:200 n:30387 unresolved:50:: rate:2.72 elapsed:11165.720s (186 minutes, batchSize=200)
::run batch:200 n:30387 unresolved:87:: rate:2.55/s avg:392.70ms n:30387 elapsed:11933.0139s
::run batch:200 n:30387 unresolved:25:: rate:2.04/s avg:489.25ms n:30387 elapsed:14866.7884s (with move)
::run batch:200 n:30387 unresolved:22:: rate:2.85/s avg:351.39ms n:30387 elapsed:10677.7708s
# new nextDetailPage
::run batch:200 n:30387 unresolved:43:: rate:2.45/s avg:407.63ms n:30387 elapsed:12386.6491s
::run batch:200 n:30387 unresolved:47:: rate:3.49/s avg:286.51ms n:30387 elapsed:8706.0997s
::run batch:200 n:30387 unresolved:45:: rate:3.07/s avg:325.94ms n:30387 elapsed:9904.2262s
::run batch:200 n:30387 unresolved:54:: rate:2.59/s avg:386.13ms n:30387 elapsed:11733.3302s
::run batch:200 n:30387 unresolved:8:: rate:3.58/s avg:279.07ms n:30387 elapsed:8480.0763s
# with perkeep
::run batch:200 n:30387 unresolved:80:: rate:2.19/s avg:457.46ms n:30387 elapsed:13900.8981s (actually 34469.192s)
::run batch:200 n:30387 unresolved:2:: rate:8.96/s avg:111.65ms n:30387 elapsed:3392.6336s
::run batch:200 n:30387 unresolved:0:: rate:10.18/s avg:98.24ms n:30387 elapsed:2985.1668s

30323 files, 28594 MB with move
```

## peru (714 items)

```bash
# on goedel:
::run batch:200 n:714 unresolved:0:: rate:3.89/s avg:257.37ms n:714 elapsed:183.7657s
::run batch:200 n:714 unresolved:0:: rate:3.76/s avg:266.10ms n:714 elapsed:189.9984s
::run batch:200 n:714 unresolved:0:: rate:4.07/s avg:245.64ms n:714 elapsed:175.3901s
::run batch:200 n:714 unresolved:0:: rate:3.93/s avg:254.38ms n:714 elapsed:181.6267s
::run batch:200 n:714 unresolved:2:: rate:3.72/s avg:269.12ms n:714 elapsed:192.1495s
# new nextDetailPage
::run batch:1000 n:714 unresolved:1:: rate:6.37/s avg:157.09ms n:714 elapsed:112.1613s
::run batch:200 n:714 unresolved:1:: rate:5.81/s avg:172.09ms n:714 elapsed:122.8737s

714 files, 96 MB with move
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
