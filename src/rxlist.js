const Progress = require('cli-progress')
const { Subject } = require('rxjs')
const { timeout } = require('rxjs/operators')
const perf = require('./perf')
const resolvable = require('./resolvable')
const sleep = require('./sleep')

module.exports = {
  listDetail,
  listAlbum,
  nLoopsUntilConsecutiveZeroCounts,
  oneLoopUntilTimeout
}

async function listDetail (page, direction = 'ArrowRight', maxDelay = 3000, maxConsecutiveZeroCounts = 2, reloadBatchSize = 200) {
  async function setupTargetChangedListener (page) {
    const subject = new Subject()
    const listener = t => {
      const url = t.url()
      if (url) {
        subject.next(url)
      }
    }
    // add the listener to the browser
    const browser = page.browser()
    browser.on('targetchanged', listener)
    const tearDown = async () => {
      // remove the listener - seems to be synchronous
      browser.removeListener('targetchanged', listener)
    }
    return {
      subject,
      tearDown
    }
  }
  const { subject, tearDown } = await setupTargetChangedListener(page)

  const pb = pbOps('Detail List', direction)
  pb.start()

  // rewrite pb.update so we don't need to accumulate items..
  let items = 0
  async function onItem (href) {
    // wait for page.url() to catch up to tagetchanged.url()
    const miniTick = 3 // ms, tight loop but don't lock the process!
    while (href !== page.url()) {
      await sleep(miniTick)
    }
    if (items % reloadBatchSize === 0) {
      await page.reload({ waitUntil: ['load'] })
      // counts.reloads++
    }
    items++
    pb.update(items, { href })
  }
  function onLoop (extra) {
    pb.update(extra.count, extra)
  }
  async function onNext () {
    await page.keyboard.press(direction)
  }

  const extra = await nLoopsUntilConsecutiveZeroCounts(maxConsecutiveZeroCounts, maxDelay, subject, onItem, onNext, onLoop)
  pb.stop(extra.count, extra)
  // perf.log(`Found ${items.length} photos (${direction}) timeouts:${consecutiveZeroCounts}`, start, items.length)

  await tearDown() // remove handlers and function definitions
}

// Extract all photo hrefs from Main/Album page
// TODO(daneroo): ensure first seletion is counted
// TODO(daneroo): turn this into an iterator?
// Idea: Use the focusin DOM event to detect that navigation has changed focus to new element
async function listAlbum (page, direction = 'ArrowRight', maxDelay = 3000, maxConsecutiveZeroCounts = 2) {
  const { subject, tearDown } = await setupFocusListener(page)

  const pb = pbOps('Album List', direction)
  pb.start()

  // rewrite pb.update so we don't need to accumulate items..
  let items = 0
  async function onItem (href) {
    items++
    pb.update(items, { href })
  }
  function onLoop (extra) {
    pb.update(extra.count, extra)
  }
  async function onNext () {
    await page.keyboard.press(direction)
  }

  const extra = await nLoopsUntilConsecutiveZeroCounts(maxConsecutiveZeroCounts, maxDelay, subject, onItem, onNext, onLoop)

  pb.stop(extra.count, extra)
  // perf.log(`Found ${items.length} photos (${direction}) timeouts:${consecutiveZeroCounts}`, start, items.length)

  await tearDown() // remove handlers and function definitions
}

async function nLoopsUntilConsecutiveZeroCounts (maxConsecutiveZeroCounts = 2, maxDelay = 3000, subject, onItem, onNext, onLoop) {
  let count = 0
  let loops = 0
  let consecutiveZeroCounts = 0
  while (true) {
    const loopCount = await oneLoopUntilTimeout(maxDelay, subject, onItem, onNext)
    count += loopCount
    loops++
    if (loopCount === 0) {
      consecutiveZeroCounts++
    } else {
      consecutiveZeroCounts = 0
    }
    await onLoop({ count, consecutiveZeroCounts, loops, loopCount })
    if (consecutiveZeroCounts >= maxConsecutiveZeroCounts) {
      break
    }
  }
  return {
    count,
    consecutiveZeroCounts,
    loops
  }
}

// perform iteration, calling `onItem(href)` with every item, until timeout(maxDelay),
//  also call `await onNext()` after each observed href
//  the iteration is started by calling `await onNext()`
//  return count
// TODO(daneroo): early return if other condition? perhaps onNext could return done?
async function oneLoopUntilTimeout (maxDelay = 3000, subject, onItem, onNext) {
  const { promise, resolver } = resolvable()
  let count = 0
  const sbs = subject
    .pipe(
      // tap(onItem), // moved to subscribe.next below to make it async
      timeout(maxDelay)
    )
    .subscribe({
      next: async (href) => { // can href be null?
        count++
        await onItem(href)
        // await sleep(100)
        // propagate event chain! (should cause subject.next(href))
        await onNext()
      },
      error: async (e) => { // timeout
        resolver() // can only be timeout,so we are done
      }
    })

  await onNext() // initiate the event chain!
  await promise // resolved on timeout
  sbs.unsubscribe()
  return count
}

function pbOps (name, direction) {
  const start = perf.now()
  const progressBar = new Progress.Bar({
    format: `${name} [{bar}] | n:{value} direction:{direction} rate:{rate}/s elapsed:{elapsed}s id:{id}`
    // to debug loop stuff
    // format: `${name} [{bar}] | n:{value} direction:{direction} rate:{rate}/s elapsed:{elapsed}s  id:{id} loop[consecZCounts:{consecutiveZeroCounts} loops:{loops} loopCount:{loopCount} count:{count}]`
  })
  let payload = {
    direction,
    rate: '--',
    elapsed: '--',
    id: 'AF1Qip...',
    loops: 0,
    consecutiveZeroCounts: 0,
    loopCount: 0,
    count: '-'
  }
  const update = (count, extra) => {
    const { rate } = perf.metrics('extractItems', start, count)
    if (count > progressBar.getTotal()) {
      progressBar.setTotal(progressBar.getTotal() + 1000)
    }
    const id = (extra && extra.href) ? { id: (extra.href).split('/').slice(-1) } : {}
    payload = {
      ...payload,
      rate: rate.toFixed(2),
      elapsed: (perf.since(start) / 1000).toFixed(2),
      ...id,
      ...extra
    }
    progressBar.update(count, payload)
  }
  return {
    start: function () {
      progressBar.start(1000, 0, payload)
    },
    update,
    stop: function (count, extra) {
      progressBar.setTotal(count)
      update(count, extra)
      progressBar.stop()
    }
  }
}

// setupFocusListener sets up a local listener for focusin events
// it returns a rx subect to which we may subscribe
// also returns a tearDown function to remove the listers we added.
// Tricky callback structure:
// 1- page.exposeFunction : define a function in the browser that calls our local callback
//  - this local callback (backToPuppeteerXXXXX) has a reference to an RXjs 'subject' in its closure,
//    to which thie values are pushed (`subject.next(href)`)
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
async function setupFocusListener (page) {
  // Looks like this can't be reversed (unexposed)
  // since we may need to call this multimple times, generate a unique name for the function
  const subject = new Subject()// ** This variable is bound to the exposed backToPuppeteerXXX() callback
  const backToPuppeteerName = `backToPuppeteer${+new Date()}`
  await page.exposeFunction(backToPuppeteerName, href => {
    subject.next(href) // can this be null?
  })
  await page.evaluate((backToPuppeteerName) => {
    // Give this a name so we can remove the listener later
    window.focusinHandler = e => window[backToPuppeteerName](e.target.href)
    document.addEventListener('focusin', window.focusinHandler)
  }, backToPuppeteerName)

  // return the function that removes the listener we just added
  // if it were possible we would also unExspose the backToPuppeteerXXX function
  const tearDown = async () => {
    await page.evaluate(type => {
      document.removeEventListener('focusin', window.focusinHandler)
      delete window.focusinHandler
    })
    // page.exposeFunction has no inverse
    // await page.UNexposeFunction(backToPuppeteerName,..)
  }
  return {
    subject,
    tearDown
  }
}
