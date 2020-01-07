const Progress = require('cli-progress')
const { Subject } = require('rxjs')
const { timeout, tap } = require('rxjs/operators')

const perf = require('./perf')

module.exports = {
  extractItems
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
  const subject = new Subject()// ** This variable is bound to the exposed backToPuppeteerXXX() callback

  const items = []

  // Looks like this can't be reversed (unexposed)
  // if we nee to call this twice, generate a unique name for the function
  const backToPuppeteerName = `backToPuppeteer${+new Date()}`
  await page.exposeFunction(backToPuppeteerName, href => {
    subject.next(href) // can this be null?
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

  const progressBar = new Progress.Bar({
    format: `extractItems ${direction} [{bar}] | n:{value} rate:{rate}/s elapsed:{duration}s retry:{retry} : {href}`
  })
  progressBar.start(1000, 0, {
    rate: '--/s',
    elapsed: '--s'
  })

  const start = perf.now()

  let retriedAt = [] // how about consecutive retries (timeouts).
  // break on retriedAt.filter(x => x === items.length) > 2
  while (true) {
    let resolver
    const p = new Promise((resolve) => {
      resolver = resolve
    })
    const sbs = subject.pipe(
      tap(href => { // accumutate items as a side effect
        items.push(href)
      }),
      tap(href => { // report/log rate
        // console.log(`focusin: ${href}`)
        const { rate } = perf.metrics('extractItems', start, items.length)
        progressBar.update(items.length, {
          rate: rate.toFixed(2),
          elapsed: (perf.since(start) / 1000).toFixed(2),
          retry: JSON.stringify(retriedAt),
          href
        })
        if (items.length > progressBar.getTotal()) {
          progressBar.setTotal(progressBar.getTotal() + 1000)
        }
      }),
      timeout(maxDelay))
      .subscribe({
        next: async (href) => { // can href be null?
          // propagate event chain!
          await page.keyboard.press(direction)
        },
        error: async (e) => { // timeout
          retriedAt.push(items.length)
          const { rate } = perf.metrics('extractItems', start, items.length)
          progressBar.update(items.length, {
            rate: rate.toFixed(2),
            elapsed: (perf.since(start) / 1000).toFixed(2),
            retry: JSON.stringify(retriedAt),
            href: items[items.length - 1]
          })
          resolver() // can only be timeout,so we are done
        }
      })

    // initiate the event chain!
    await page.keyboard.press(direction)

    await p // resoved on timeout
    sbs.unsubscribe()

    // consecutive timeouts: how many times is items.length at the end of the retried array?
    retriedAt = retriedAt.filter(x => x === items.length)
    if (retriedAt.length > 2) {
      break
    }
  }
  progressBar.setTotal(items.length)
  const { rate } = perf.metrics('extractItems', start, items.length)
  progressBar.update(items.length, {
    rate: rate.toFixed(2),
    elapsed: (perf.since(start) / 1000).toFixed(2),
    retry: JSON.stringify(retriedAt),
    href: items[items.length - 1]
  })
  progressBar.stop()
  perf.log(`Found ${items.length} photos (${direction}) |${JSON.stringify(retriedAt)}|:${retriedAt.filter(x => x === items.length).length}`, start, items.length)
  // console.log(retriedAt.filter(x => x === items.length).length)

  await removeListener() // remove handlers and function definitions
  return items // maybe this should be an iterator
}
