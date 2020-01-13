const perf = require('./perf')
const sleep = require('./sleep')
const { baseURL } = require('./browserSetup')

module.exports = {
  pingPong, // temporary
  navToStart,
  navToEnd,
  currentActiveElement,
  navToDetailPage
}

async function pingPong (page) {
  const h2id = (href) => href.split('/').slice(-1)[0]

  const n = 1
  const start = perf.now()
  for (let i = 0; i < n; i++) {
    // await page.goto(baseURL, { waitUntil: ['load'] })

    // for (let i = 0; i < 30; i++) {
    //   await page.keyboard.press('PageDown')
    //   await sleep(100)
    // }

    // const first = await navToStart(page, { iKnowItsAFreshPage: true })
    // console.log(i, h2id(first))

    const { first, last } = await navToEnd(page)
    console.log(i, h2id(first), h2id(last))

    // to observe
    // await sleep(5000)
  }
  perf.log('pingPong', start, n)
}

// navToStart returns href of First Photo on Main Album Page
// - also leaves the first item selected on the main page.
async function navToStart (page, { maxIterations = 1000, resendEvery = 100 } = {}) {
  const miniTick = 3 // ms, tight loop but don't lock the process!

  // we used to have checks for the state of url and currentActiveElement
  // This is much simpler, just force reload the page, and assume nothing
  // if ... throw new Error(`navToStart: should be on home page. url:${url}`)
  // if ... throw new Error(`navToStart: should not have an active element:${currentActive}`)

  await page.goto(baseURL, { waitUntil: ['load'] })

  // send the navigation key, every `resendEvery` iterations
  // return the first currentActiveElement: href of first Photo
  // throw after maxIterations
  for (let it = 0; it < maxIterations; it++) {
    if (it % resendEvery === 0) { await page.keyboard.press('ArrowLeft') }
    const href = await currentActiveElement(page)
    if (href) {
      return href
    }
    await sleep(miniTick)
  }
  throw new Error(`navToStart timeout max iterations: ${maxIterations} * tick:${miniTick}ms`)
}

// navToEnd returns {firsts,last} the href of First and Last photo on Main Album page
// - also leaves the last item selected on the main page.
// - throws if not on main album page or has an active selected element
// - calls navToStart to position on first element
// The timing (tick=500) is critical in the sense that after the scroll
// event `End`, the active element in the page becomes null
// and if we send the ArrowRight event too quickly it simply selects the next item
// if the delay is sufficient, it will select the first photo after the scrolled to position
// in tah case, the subsequent scroll (End) event will have no effect,
// but the ArrowRight events will iterate to the last item on the page.
// the termination criteria is when the iteration stops advancing
// for `minTerminationRepeats` consecutive iterations.
// Also throws after maxIterations (for safety)
async function navToEnd (page, { minTerminationRepeats = 3, maxIterations = 100 } = {}) {
  const tick = 500

  const first = await navToStart(page)
  let prev
  for (let it = 0, lastRepeated = 0; it < maxIterations; it++) {
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('End')

    await sleep(tick)

    const href = await currentActiveElement(page)
    if (!href) {
      await sleep(tick)
      continue
    }
    if (href === prev) {
      lastRepeated++
    } else {
      lastRepeated = 0
    }
    if (lastRepeated >= minTerminationRepeats) {
      const last = href
      return { first, last }
    }
    prev = href
  }
  throw new Error(`navToEnd timeout max iterations: ${maxIterations} * tick:${tick}ms`)
}

// currentActiveElement: for use in Album/Main page
// returns the href of the current active element (selected photo in main page)
// returns undefined if none selected
// performance: >1500 invocation/s
async function currentActiveElement (page) {
  const href = await page.evaluate(() => document.activeElement.href)
  return href
}

// navToDetailPage is equivalent to page.goto(href, { waitUntil: ['load'] })
// returns the href===page.url()
// It's purpose it to accelerate "entering" a detail page when it is selected in the main page.
// Optimizations
// - if the detail page is already selected: noop
// - if we are on the main page, and the current active element has the right href
//  we use `\n` keyboard press to "enter" detail page, this is much faster (30ms)
//  than page.goto(..,waitUntil[load]) (1000ms)
// - Throws on timeout
//   timeout occurs when after a \n to enter page, or after page.goto,
//   we enter a tight loop (miniTick 3ms) until page.url() reflects desired href
//   maxIterations=1000 implies about a 3s timeout, which should never happen
//   as both \n and page.goto are very stable
async function navToDetailPage (page, href, { maxIterations = 1000 } = {}) {
  const origUrl = page.url()
  // if we are already at the desired page, simply return
  if (href === origUrl) {
    return href
  }
  // if we are on main/album page, and currentActive element is correct use \n
  if (baseURL === origUrl && href === await currentActiveElement(page)) {
    await page.keyboard.press('\n')
  } else {
    await page.goto(href, { waitUntil: ['load'] })
  }

  const miniTick = 3 // ms, tight loop but don't lock the process!
  for (let it = 0; it < maxIterations; it++) {
    if (href === page.url()) {
      return href
    }
    await sleep(miniTick)
  }

  // This should never happen, but instead of throwing, I'll just page.goto
  throw new Error(`navToDetailPage timeout max iterations: ${maxIterations} * tick:${miniTick}ms`)

  // if we don't want this to throw, this is a really safe fallback:
  // await page.goto(href, { waitUntil: ['load'] })
  // return href
}
