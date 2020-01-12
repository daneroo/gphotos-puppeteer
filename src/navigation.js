const perf = require('./perf')
const sleep = require('./sleep')

module.exports = {
  pingPong
}

// Optimizing navigation:
// - currentActiveElement : 1500/s

async function pingPong (page) {
  const n = 10
  const start = perf.now()
  for (let i = 0; i < n; i++) {
    await page.reload({ waitUntil: ['load'] })
    // if (Math.random() < 0.05) {
    //   console.log('Injecting error')
    //   await page.keyboard.press('ArrowRight')
    //   await sleep(200)
    // }
    // const first = await navToStart(page)
    // console.log(i, first)
    const { first, last } = await navToEnd(page)
    console.log(i, first, last)
  }
  perf.log('reload', start, n)
}

// selects and return href of FirstPhoto on Main Album Page
// Should I reload to guarantee pre-conditions
async function navToStart (page) {
  const miniTick = 3 // ms, tight loop but don't lock the process!
  const initial = await currentActiveElement(page)
  if (initial) {
    throw new Error(`Precondition for navToStart not met active:${initial}`)
  }
  for (let z = 0; z < 1000; z++) {
    if (z % 100 === 0) { await page.keyboard.press('ArrowLeft') }
    const href = await currentActiveElement(page)
    if (href) { return href }
    await sleep(miniTick)
  }
  throw new Error('navToStart timeout')
}

// await mainPage.reload({ waitUntil: ['load'] })
// const href = await currentActiveElement(page)
// await page.keyboard.press('ArrowLeft')
// await page.keyboard.press('ArrowRight')
// await page.keyboard.press('End')

// Go Port: 6.4, 7.3, 8.1
async function navToEnd (page) {
  const tick = 500

  const first = await navToStart(page)
  let prev
  let lastRepeated = 0
  while (true) {
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
    // console.log(JSON.stringify({ lastRepeated, href: href.split('/').slice(-1)[0] }))
    if (lastRepeated >= 3) {
      break
    }
    prev = href
  }
  const last = prev
  return { first, last }
}

// currentActiveElement: for use in Album/Main page
// returns the href of the current active element (selected photo in main page)
// returns undefined if none selected
// speed: >1500/s
async function currentActiveElement (page) {
  const href = await page.evaluate(() => document.activeElement.href)
  return href
}
