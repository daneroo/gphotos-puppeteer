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
async function extractItems (page, direction = 'ArrowRight', maxDelay = 3000) {
  const items = []
  const { subject, tearDown } = await setupFocusListener(page)

  const pb = pbOps(`extractItems ${direction}`)
  pb.start()

  const start = perf.now()

  let consecutiveRetries = 0 // how about consecutive retries (timeouts).
  function syncUpdate (href) {
    items.push(href)
    pb.update(start, items, consecutiveRetries)
  }
  async function onNext () {
    await page.keyboard.press(direction)
  }

  while (true) {
    const count = await oneLoopUntilTimeout(maxDelay, subject, syncUpdate, onNext)
    if (count === 0) {
      consecutiveRetries++
    } else {
      consecutiveRetries = 0
    }
    pb.update(start, items, consecutiveRetries)
    if (consecutiveRetries > 2) {
      break
    }
  }
  pb.stop(start, items, consecutiveRetries)
  // perf.log(`Found ${items.length} photos (${direction}) retries:${consecutiveRetries}`, start, items.length)

  await tearDown() // remove handlers and function definitions
  return items // maybe this should be an iterator
}

// perform iteration, calling syncUpdate(href), until timeout, return count
// TODO(daneroo): early return if other condition? perHaps onNext could return done?
async function oneLoopUntilTimeout (maxDelay = 3000, subject, syncUpdate, onNext) {
  const { promise, resolver } = resolvable()
  let count = 0
  const sbs = subject
    .pipe(
      tap(syncUpdate),
      timeout(maxDelay)
    )
    .subscribe({
      next: async (href) => { // can href be null?
        count++
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

function pbOps (name) {
  const progressBar = new Progress.Bar({
    format: `${name} [{bar}] | n:{value} rate:{rate}/s elapsed:{duration}s retry:{retry} : {href}`
  })
  const update = (start, items, retries) => {
    const { rate } = perf.metrics('extractItems', start, items.length)
    if (items.length > progressBar.getTotal()) {
      progressBar.setTotal(progressBar.getTotal() + 1000)
    }
    const href = (items.length === 0) ? '--' : (items[items.length - 1]).split('/').slice(-1)
    progressBar.update(items.length, {
      rate: rate.toFixed(2),
      elapsed: (perf.since(start) / 1000).toFixed(2),
      retry: retries,
      href
    })
  }
  return {
    start: function () {
      progressBar.start(1000, 0, {
        rate: '--/s',
        elapsed: '--s',
        retry: [0, 0],
        href: 'AF1Qip...'
      })
    },
    update,
    stop: function (start, items, retries) {
      progressBar.setTotal(items.length)
      update(start, items, retries)
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
