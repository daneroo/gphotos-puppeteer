const sleep = require('./sleep')
const perf = require('./perf')

const { downloadHandlerWithTimeout } = require('./handler')

module.exports = {
  extractItems,
  navToFirst,
  enterDetailPage,
  initiateDownload,
  nextDetailPage,
  navRight,
  navLeft,
  shiftD,
  currentActiveElement
}

// works on main/Album page
async function extractItems (page, numItems) {
  const items = []
  for (let i = 0; i < numItems; i++) {
    await page.keyboard.press('ArrowRight')
    await sleep(100)
    const activeHrefJSHandle = await page.evaluateHandle(() => document.activeElement.href)
    const href = await activeHrefJSHandle.jsonValue()
    console.log(`Current active element href is ${href}`)
    items.push(href)
  }
  console.log(`Found ${items.length} photos`)
  return items
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
// but we don't want to pin the cpu and prevent the broser processes to advance
async function nextDetailPage (page, maxDelay = 3000) {
  const miniTick = 1 // ms, tight loop but don't lock the process!
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
