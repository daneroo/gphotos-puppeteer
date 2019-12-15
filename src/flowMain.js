const sleep = require('./sleep')

module.exports = {
  extractItems,
  navToFirst,
  enterDetailPage,
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
async function enterDetailPage (page, maxDelay = 3000) {
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

// from main/album page, enter detail page
// return url of detail page: e.g. https://photos.google.com/photo/AF1QipMOl0XXrO9WPSv5muLRBFpbyzGsdnrqUqtF8f73
// or null if not successful
// send a single `\n`, and wait for the url to change from origUrl.
async function nextDetailPage (page, maxDelay = 3000) {
  const origUrl = page.url()
  await sleep(10) // be a good citizen
  // console.log(`..orig url:       ${origUrl}`)

  const start = +new Date()
  await navRight(page)
  while (true) {
    await sleep(90) // Needs a better solution...
    const url = page.url()
    // console.log(`..current url:    ${url}`)
    if (url !== origUrl) { return url }
    const elapsed = +new Date() - start
    if (elapsed > maxDelay) { return null }
  }
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
