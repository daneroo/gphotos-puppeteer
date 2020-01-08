const Progress = require('cli-progress')
const { Subject } = require('rxjs')
const { timeout, tap } = require('rxjs/operators')
const perf = require('./perf')
const resolvable = require('./resolvable')

module.exports = {
  extractItems
}

// Extract all photo hrefs from Main/Album page
// TODO(daneroo): ensure first seletion is counted
// TODO(daneroo): turn this into an iterator?
// Idea: Use the focusin DOM event to detect that navigation has changed focus to new element
async function extractItems (page, direction = 'ArrowRight', maxItems = 1e6, maxDelay = 3000) {
  const items = []
  const { subject, tearDown } = await setupFocusListener(page)

  const progressBar = new Progress.Bar({
    format: `extractItems ${direction} [{bar}] | n:{value} rate:{rate}/s elapsed:{duration}s retry:{retry} : {href}`
  })
  progressBar.start(1000, 0, {
    rate: '--/s',
    elapsed: '--s',
    retry: [0, 0],
    href: 'AF1Qip...'
  })

  const start = perf.now()

  let retriedAt = [] // how about consecutive retries (timeouts).
  // break on retriedAt.filter(x => x === items.length) > 2
  while (true) {
    const { promise, resolver } = resolvable()
    const sbs = subject
      .pipe(
        tap(href => { // accumutate items as a side effect
          items.push(href)
        }),
        tap(href => { // report/log rate
          pbUpdate(progressBar, start, items, retriedAt)
          if (items.length > progressBar.getTotal()) {
            progressBar.setTotal(progressBar.getTotal() + 1000)
          }
        }),
        timeout(maxDelay)
      )
      .subscribe({
        next: async (href) => { // can href be null?
          // propagate event chain!
          await page.keyboard.press(direction)
        },
        error: async (e) => { // timeout
          retriedAt.push(items.length)
          pbUpdate(progressBar, start, items, retriedAt)
          resolver() // can only be timeout,so we are done
        }
      })

    // initiate the event chain!
    await page.keyboard.press(direction)

    await promise // resoved on timeout
    sbs.unsubscribe()

    // consecutive timeouts: how many times is items.length at the end of the retried array?
    retriedAt = retriedAt.filter(x => x === items.length)
    if (retriedAt.length > 2) {
      break
    }
  }
  progressBar.setTotal(items.length)
  pbUpdate(progressBar, start, items, retriedAt)
  progressBar.stop()
  perf.log(`Found ${items.length} photos (${direction}) |${JSON.stringify(retriedAt)}|:${retriedAt.filter(x => x === items.length).length}`, start, items.length)
  // console.log(retriedAt.filter(x => x === items.length).length)

  await tearDown() // remove handlers and function definitions
  return items // maybe this should be an iterator
}

// extracted common code to update progressbar - this should all be externalized
function pbUpdate (progressBar, start, items, retriedAt, href) {
  const { rate } = perf.metrics('extractItems', start, items.length)
  progressBar.update(items.length, {
    rate: rate.toFixed(2),
    elapsed: (perf.since(start) / 1000).toFixed(2),
    retry: JSON.stringify(retriedAt),
    href: (items[items.length - 1]).split('/').slice(-1)
  })
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
