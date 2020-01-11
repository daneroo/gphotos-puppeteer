const path = require('path')
const fs = require('fs')
const Progress = require('cli-progress')
const perkeep = require('./perkeep')
const perf = require('./perf')
const sleep = require('./sleep')
const { moveDownloadedFile, downloadHandlerWithTimeout } = require('./download')

module.exports = {
  getMode,
  modeNames,
  loopDetailPages,
  extractItems,
  navToFirstDetailPage,
  navToFirst,
  enterDetailPage,
  initiateDownload,
  nextDetailPage,
  navRight,
  navLeft,
  shiftD,
  currentActiveElement
}

const modes = {
  list: {
    exists: async (id, downloadDir) => true
  },
  files: {
    exists: async (id, downloadDir) => fs.existsSync(path.join(downloadDir, id)),
    initiateDownload: async (page, n, id) => initiateDownload(page, n, id),
    finalizeDownload: async (filename, id, downloadDir) => moveDownloadedFile(filename, id, downloadDir)
  },
  perkeep: {
    exists: async (id, downloadDir) => perkeep.exists(id),
    initiateDownload: async (page, n, id) => initiateDownload(page, n, id),
    finalizeDownload: async (filename, id, downloadDir) => {
      await moveDownloadedFile(filename, id, downloadDir)
      const newPath = path.join(downloadDir, id, filename)
      // TODO(daneroo): unhandled Rejection>
      await perkeep.putLocked(newPath, id)
    }
  }
}

function modeNames () {
  return Object.keys(modes)
}
function getMode (modeName) {
  return modes[modeName]
}
// loopDetailPages is the main loop for detail page iterator
// - It assumes it is on the first detail page
// - Iteration advances nextDetailPage() (which return null if failed)
// - Termination criteria: page.url() is unchanged after 2 iterations (sameCount)
// iner loop:
// if alreadyExists(id) -> do nothing
// if !alreadyExists(id) -> initiateDownload; if !timeout moveDownloadedFile (but dont await)
// if n%batchSize -> reload, print progress
async function loopDetailPages (page, downloadDir, modeName = 'list') {
  const mode = getMode(modeName)
  const startRun = perf.now()
  let startBatch = perf.now() // will be reset every batchSize iterations
  const batchSize = 200 // reoptimize this
  const maxItems = 1e6
  const progressBar = new Progress.Bar({
    format: `${modeName} [{bar}] | n:{value} exists:{exists} unresolved:{unresolved} elapsed:{duration}s reloads:{reloads} rates: batch:{rateBatch} total:{rateTotal}`,
    clearOnComplete: false // false is te default
  })
  const counts = {
    exists: 0,
    unresolved: 0,
    reloads: 0,
    rateBatch: '-/s',
    rateTotal: '-/s'
  }
  progressBar.start(batchSize, 0, counts)

  let n = 0
  let currentUrl
  let previousUrl
  let sameCount = 0
  const unresolveds = [] // the timed-out initiated downloads
  while (true) {
    currentUrl = page.url()
    if (currentUrl === previousUrl) {
      sameCount++
    } else {
      sameCount = 0

      const id = photoIdFromURL(currentUrl)
      if (id) {
        const alreadyExists = await mode.exists(id, downloadDir)
        if (!alreadyExists) {
          const eitherResponseOrTimeout = await mode.initiateDownload(page, n, id)
          if (eitherResponseOrTimeout.timeout) { // the value test for timeout vs download response
            // n,id are also in the timeoutValue (eitherResponseOrTimeout)
            counts.unresolved++
            unresolveds.push({ n, id })
            console.log(`XX ${n} Response (${id}) was not resolved in ${eitherResponseOrTimeout.timeout}ms`)
          } else { // our response resolved before timeout, the download is initiated
            const { /* id, */ filename /*, url, elapsed */ } = eitherResponseOrTimeout
            // console.log('>>', n, filename, elapsed, id, url.substring(0, 80)) // .substring(27, 57)
            // no need to await, move happens in it's own time. Althoug we might queue them up for waiting on them later
            // /* await */ dataDirs.moveDownloadedFile(filename, id, downloadDir)
            /* await */ mode.finalizeDownload(filename, id, downloadDir)
          }
        } else {
          counts.exists++
          // console.log(`photoId (${id}) already exists, skipping`)
        }
      } else {
        console.log(`Current url does not look like a photo detail page. url:${currentUrl}`)
      }

      n++
      if (n % batchSize === 0) {
        progressBar.setTotal(n + batchSize)
        // const start = perf.now()
        await page.reload({ waitUntil: ['load'] }) // about 3s
        counts.reloads++
        // counts.reloads = perf.since(start).toFixed(2) + 'ms'
        const { rate: rateBatch } = perf.metrics('batch', startBatch, batchSize)
        counts.rateBatch = rateBatch.toFixed(2) + '/s'
        const { rate: rateTotal } = perf.metrics('cumul', startRun, n)
        counts.rateTotal = rateTotal.toFixed(2) + '/s'
        // also printStats
        // perf.log(`batch batch:${batchSize} n:${n} unresolved:${unresolveds.length}`, startBatch, batchSize)
        // perf.log(`cumul batch:${batchSize} n:${n} unresolved:${unresolveds.length}`, startRun, n)
        startBatch = perf.now() // reset batch start time
      }
      progressBar.update(n + 1, counts)
    }

    if (n > maxItems) { break }
    if (sameCount > 1) { break }

    const nurl = await nextDetailPage(page)
    if (!nurl) {
      // console.log(`Looks like nextDetailPage failed: ${nurl}`)
    }
    previousUrl = currentUrl
  }
  progressBar.setTotal(n)
  progressBar.stop()
  // Now look at the unresolved items
  // console.log(`There were ${unresolveds.length} unresolved items`)

  for (const unresolved of unresolveds) {
    const { n, id } = unresolved
    console.log(` - unresolved ${n} (${id})`)
  }
  //  we could check for promises whose handler resolved before it was removed, but...

  perf.log(`run batch:${batchSize} n:${n} unresolved:${unresolveds.length}`, startRun, n)
}

function photoIdFromURL (url) {
  if (!url) {
    return null
  }
  // https://photos.google.com/photo/AF1QipMbbciIAZnvYhBJgSHsxsn3-56dpzzx-n7y8RiG
  const re = /https:\/\/photos.google.com\/photo\/(.*)/
  const found = url.match(re)
  // console.log({ found })
  if (found.length === 2) {
    return found[1]
  }
  return null
}
// Extract all photo hrefs from Main/Album page
// TODO(daneroo): ensure first seletion is counted
// TODO(daneroo): turn this into an iterator?
// Idea: Use the focusin DOM event to detect that navigation has changed focus to new element
// Tricky callback structure:
// 1- page.exposeFunction : define a function in the browser that calls our local callback
//  - this local callback (backToPuppeteerXXXXX) has a reference to href in its closure, which it mutates
//  - this local callback is given a unqe name, because it cannot be "UNexposed" or removed,
//    and this prevents us from calling this functiona second time unless we make the name unique
// 2- add an event listener for 'focusin' event type (which bubbles up, whereas 'focus' does not)
//  - the event listener then calls our local backToPuppeteerXXXXX
//  - the event listener is given a name (window.focusinHandler) so it can be removed later
// 3- Start the iteration:
//  - send the navigation key (direction=ArrowRight,ArrowLeft)
//  - watch the 'href' variable, waiting for the callback to mutaste it's value
//  - if we are at the end, focus will not change, therefore callback will not be invoked
//    and so we have a max timeout to detect this situation, maxDelay is set long enough to account
//    for sometime very long delays and pauses in the browser navigation...
// 4- remove the listener,...
async function extractItems (page, direction = 'ArrowRight', maxItems = 1e6, maxDelay = 3000) {
  let href // ** This variable is bound to the exposed backToPuppeteerXXX() callback
  let prevHref
  const items = []

  // Looks like this can't be reversed (unexposed)
  // if we nee to call this twice, generate a unique name for the function
  const backToPuppeteerName = `backToPuppeteer${+new Date()}`
  await page.exposeFunction(backToPuppeteerName, innerHref => {
    href = innerHref
  })
  await page.evaluate((backToPuppeteerName) => {
    // Give this a name so we can remove the listener later
    window.focusinHandler = e => window[backToPuppeteerName](e.target.href)
    document.addEventListener('focusin', window.focusinHandler)
  }, backToPuppeteerName)

  const removeListener = async () => {
    await page.evaluate(type => {
      document.removeEventListener('focusin', window.focusinHandler)
      delete window.focusinHandler
    })
    // page.exposeFunction has no inverse
    // await page.UNexposeFunction(backToPuppeteerName,..)
  }

  const miniTick = 3 // ms, tight loop but don't lock the process!
  const start = perf.now()
  for (let i = 0; i < maxItems; i++) {
    href = null // resets every outer iteration - will be set in callback
    await page.keyboard.press(direction)

    const start = perf.now()
    while (true) {
      await sleep(miniTick)
      const elapsed = perf.since(start)
      if (elapsed > maxDelay) { break }
      if (href) { break }
    }
    // console.log(`Current active element href is ${href} in ${perf.since(start)}ms`)
    if (href) {
      items.push(href)
    }
    if (href === prevHref) { break }
    prevHref = href
  }
  perf.log(`Found ${items.length} photos`, start, items.length)

  await removeListener() // remove handlers and function definitions
  return items
}

// TODO: this is what is meant to be called, generalize first,last
// Returns (current) url of detail page, Throws if not OK
async function navToFirstDetailPage (page, maxDelay = 1000) {
  const href = await navToFirst(page)
  if (href) {
    const url = await enterDetailPage(page)
    // Here we expect url to match href
    if (url === href) {
      return url
    } else {
      throw new Error(`Active href (${href}) on main page does not match detail page url (${url})`)
    }
  } else {
    throw new Error('navToFirstDetailPage: Couldn\'t find first photo on main page')
  }
}

// assumes we are at a fresh album page with no active element
// - navLeft, then wait for currentActiveElement do be truthy
async function navToFirst (page, maxDelay = 1000) {
  const start = +new Date()
  await navLeft(page)
  while (true) {
    await sleep(10) // be a good citizen
    const href = await currentActiveElement(page)
    // console.debug(`..current active element href is ${href}`)
    if (href) { return href }
    const elapsed = +new Date() - start
    if (elapsed > maxDelay) { return href }
  }
}

// from main/album page, enter detail page
// return url of detail page: e.g. https://photos.google.com/photo/AF1QipMOl0XXrO9WPSv5muLRBFpbyzGsdnrqUqtF8f73
// or null if not successful
// send a single `\n`, and wait for the url to change from origUrl.
async function enterDetailPage (page, maxDelay = 5000) {
  const origUrl = page.url()
  // console.log(`..orig url: ${origUrl}`)
  const start = +new Date()
  await page.keyboard.press('\n')
  while (true) {
    await sleep(10) // be a good citizen
    const url = page.url()
    // console.debug(`..current url: ${url}`)
    if (url !== origUrl) { return url }
    const elapsed = +new Date() - start
    if (elapsed > maxDelay) { return null }
  }
}

// initiateDownload returns a promis of either:
//  - timeout: {n,id,timeout}
//  - download initiated response: { n, id, filename, contentLength, url, elapsed }
// shiftD could be injected?
async function initiateDownload (page, n, id) {
  const timeout = 5000
  const [responseHandler, responseWithTimeoutPromise] = downloadHandlerWithTimeout(n, id, timeout)
  page.on('response', responseHandler)

  await shiftD(page) // coupled to the handler..

  // await before we remove the listener
  const eitherResponseOrTimeout = await responseWithTimeoutPromise

  //  since the handler is removed, it will not resolve later.
  page.removeListener('response', responseHandler)
  return eitherResponseOrTimeout
}

// nextDetailPage navigates to the next (navRight) page
// Return url of detail page: e.g. https://photos.google.com/photo/AF1QipMOl0XXrO9WPSv5muLRBFpbyzGsdnrqUqtF8f73
//    or null if not successful
// This was optimized for throughput (to be used for simply iterating all detail pages)
// 1- Add a listener for 'targetchanged' events, which signify the page has navigated
//    this listener changes a local variable (`url`) in it's closure
// 2- We observe this variable in a tight loop, until navigation has occured.
// 3- Even though the targetchanged event has been sent,
//    the `page` object has not yet updated it's url(), so we wait fo that to occur
// The two tight loops (observing the url variable change, and the page.url() value),
// need a small delay (`miniTick`) so as to complete as fast as possible,
// but we don't want to pin the cpu and prevent the browser processes to advance
async function nextDetailPage (page, maxDelay = 3000) {
  const miniTick = 3 // ms, tight loop but don't lock the process!
  const browser = page.browser()

  let url = null // this variable is bound into the listener closure
  const listener = t => { url = t.url() }

  // add the listener to the browser
  browser.on('targetchanged', listener)

  const start = perf.now()
  await navRight(page)

  // wait for the litener to set the `url` variable
  while (true) {
    await sleep(miniTick)
    if (url) { break }
    const elapsed = perf.since(start)
    if (elapsed > maxDelay) { break }
  }

  // remove the listener
  browser.removeListener('targetchanged', listener)

  // wait for page.url() to catch up to tagetchanged.url()
  if (url) { // unless the listener was never triggerd (url==null)
    while (url !== page.url()) {
      await sleep(miniTick)
    }
  }
  // perf.log('nextDetailPage', start, 1)
  return url
}

// initially for main/album page
// send RightArrow, and waits for a condition?
async function navRight (page) {
  await page.keyboard.press('ArrowRight')
}

async function navLeft (page) {
  await page.keyboard.press('ArrowLeft')
}

async function shiftD (page) {
  await page.keyboard.down('Shift')
  await page.keyboard.press('KeyD')
  await page.keyboard.up('Shift')
}

// meant for main/album page
// returns the href of the current active element (selected photo in main page)
// return undefined if none selected
async function currentActiveElement (page) {
  const activeHrefJSHandle = await page.evaluateHandle(() => document.activeElement.href)
  const href = await activeHrefJSHandle.jsonValue()
  return href
}
