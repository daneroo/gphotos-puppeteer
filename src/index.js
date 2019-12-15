
const dataDirs = require('./dataDirs.js')
const browserSetup = require('./browserSetup')
const sleep = require('./sleep')
const perf = require('./perf')
// const { downloadItems } = require('./flowWorker')
// const { extractItems } = require('./flowMain')
const { navToFirst, enterDetailPage, nextDetailPage, shiftD } = require('./flowMain')

const baseURL = 'https://photos.google.com/'

main()
  .catch(err => {
    console.error(err)
  })

async function main () {
  const headless = true
  const numWorkers = 0
  const { userDataDir, userDownloadDir } = await dataDirs.make('./data')
  const { browser, mainPage, workers } = await browserSetup.setup({
    headless,
    numWorkers,
    userDataDir,
    userDownloadDir
  })
  // console.log(`Found ${workers.length} workers`)

  // browser.on('targetchanged', t => {
  //   console.log(`>> target change: ${t.url()}`)
  // })

  await authenticate(mainPage)
  await sleep(1000)

  await mainPage._client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: userDownloadDir
  })
  console.log(`  set dlDir to: ${userDownloadDir}`)

  const href = await navToFirst(mainPage)
  if (href) {
    console.log(`FirstPhoto (href:${href})`)
    const url = await enterDetailPage(mainPage)
    // Here we expect url to match href
    if (url === href) {
      console.log(`FirstPhoto (url:${href})`)
      await sleep(500)

      const startRun = perf.now()
      let startBatch = perf.now() // will be reset every batchSize iterations
      const batchSize = 200
      const maxItems = 400

      let n = 0
      let currentUrl
      let previousUrl
      let sameCount = 0
      const unresolveds = []
      while (true) {
        currentUrl = mainPage.url()
        if (currentUrl === previousUrl) {
          sameCount++
        } else {
          sameCount = 0

          const id = photoIdFromURL(currentUrl)
          if (id) {
            const timeout = 5000
            const [responseHandler, responsePromise] = responseHandlerForId(n, id, timeout)
            mainPage.on('response', responseHandler)

            await shiftD(mainPage)

            // Promise.race between responsePromise and sleep
            // let [completed] = await Promise.race(queue.map(p => p.then(res => [p])));
            const responseWithTimeout = Promise.race([
              responsePromise,
              sleep(timeout, { timeout: timeout })
            ])
            const firstFinished = await responseWithTimeout
            if (firstFinished.timeout) {
              // we should queue up the unresolved responses here, but not the promise, as the handler will be removed.
              unresolveds.push({ n, id /*, responsePromise */ })
              console.log(`XX ${n} Response (${id}) was not resolved in ${firstFinished.timeout}ms`)
            } else { // our response resolved before timeout
              // const { /* id, */ filename, url, elapsed } = firstFinished
              // console.log('>>', n, filename, elapsed, id, url.substring(0, 80)) // .substring(27, 57)
              mainPage.removeListener('response', responseHandler)
            }
            //  since the handler is removed, it will not resolve later, better retry
            mainPage.removeListener('response', responseHandler)
          } else {
            console.log(`Current url does not look like a photo detail page. url:${currentUrl}`)
          }

          n++
          if (n % batchSize === 0) {
            const startReload = perf.now()
            await mainPage.reload({ waitUntil: ['networkidle0', 'domcontentloaded'] })
            perf.log(`reload n:${n}`, startReload, 1)

            // also printStats
            perf.log(`batch batch:${batchSize} n:${n} unresolved:${unresolveds.length}`, startBatch, batchSize)
            perf.log(`cumul batch:${batchSize} n:${n} unresolved:${unresolveds.length}`, startRun, n)
            startBatch = perf.now()
          }
        }

        if (n > maxItems) {
          break
        }
        if (sameCount > 3) {
          break
        }

        const nurl = await nextDetailPage(mainPage)
        if (!nurl) {
          console.log(`Looks like nextDetailPage failed: ${nurl}`)
        }
        previousUrl = currentUrl
      }
      // Now look at the unresolved items
      console.log(`There were ${unresolveds.length} unresolved items`)
      for (const unresolved of unresolveds) {
        const { n, id } = unresolved
        console.log(` - unresolved ${n} (${id})`)
      }
      //  we could check for promises whose handler resolved before it was removed, but...

      perf.log(`run batch:${batchSize} n:${n} unresolved:${unresolveds.length}`, startRun, n)
    } else {
      console.log('Active href on main does not match detail url')
      console.log(` Main active href: ${href}`)
      console.log(` Detail url: ${url}`)
    }
  } else {
    console.log('couldn\'t find first photo on main page')
  }

  // const numItems = 10
  // const items = await extractItems(mainPage, numItems)
  // await sleep(3000)
  // console.log(`Found ${items.length} photos`)

  // const doneItems = []
  // await downloadItems(workers, items, doneItems, userDownloadDir)

  await sleep(3000)

  console.log('Closing browser')
  await browser.close()
}

// Not sure I shoud have the id here
function responseHandlerForId (n, id, timeout) {
  // parameter; id is included in closure
  const start = +new Date()
  let resolver
  const responsePromise = new Promise(function (resolve, reject) {
    resolver = resolve
  })

  const responseHandler = response => {
    const url = response._url
    const headers = response.headers()
    const contentDisposition = headers['content-disposition']
    const filename = filenameFromContentDisposition(contentDisposition)
    const contentLength = headers['content-length']
    // if (filename && url.includes('usercontent')) {
    if (filename) {
      // console.log('>>', filename, contentLength, id, url.substring(27, 57))
      // could return all the headers
      const elapsed = +new Date() - start
      resolver({ n, id, filename, contentLength, url, elapsed })
      if (elapsed > timeout) {
        console.log(`** Resolved after ${elapsed}ms > ${timeout}ms (${id}`)
        console.log(`   url: (${url}`)
      }
    }
  }
  return [responseHandler, responsePromise]
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

function filenameFromContentDisposition (contentDisposition) {
  if (!contentDisposition) {
    return null
  }
  // tests
  // attachment;filename="IMG_9487.JPG"
  // attachment; filename="MVI_5560.AVI"  // notice there can be differing whitespa after the semi-colon
  // attachment; filename="response.bin"; filename*=UTF-8''response.bin  // should be excluded
  const re = /attachment;\s*filename="(.*)"$/
  const found = contentDisposition.match(re)
  // console.log({ found })
  if (found && found.length === 2) {
    return found[1]
  } else {
    // for debugging
    // console.log('Content-Disposition not matched:', contentDisposition)
  }
  return null
}

// authenticate returns the result of getActiveUser(),
// or waits forever for authentication
// flag to return early (if we are headless)
async function authenticate (page) {
  await page.goto(baseURL)
  await sleep(1000) // wait for something else?
  // console.log(`..navigated to ${baseURL}`)

  // Until we are authenticated (wait forever)
  while (true) {
    const url = page.url()
    if (url === baseURL) {
      const activeUser = await getActiveUser(page)
      const { name, userId } = activeUser
      console.log(`Authenticated as ${name} (${userId || ''})`)
      return activeUser
    }
    // This should remain as prompt
    console.log(`Current URL is ${url}. Awaiting auth`)
    await sleep(2000)
  }
}

// TODO(daneroo): what if querySelector returns null...
// TODO(daneroo): araia-label may have different prefix text in other locales, better RegExp?
// return {name,userId} if found
// return {name:'Unknown',userId:null} if NOT found
async function getActiveUser (page) {
  // document.querySelector('a[href^="https://accounts.google.com/SignOutOptions"]').getAttribute('aria-label')
  // "Google Account: Daniel Lauzon
  // (daniel.lauzon@gmail.com)"
  // Alternate selector:
  const activeHrefJSHandle = await page.evaluateHandle(() => document.querySelector('a[href^="https://accounts.google.com/SignOutOptions"]').getAttribute('aria-label'))
  const activeUser = await activeHrefJSHandle.jsonValue()
  // const activeUser = `Google Account: Daniel Lauzon
  // (daniel.lauzon@gmail.com)`
  const re = /Google Account:\s+(.*[^\s])\s+\((.*)\)/
  const found = activeUser.match(re)
  const [, name, userId] = found
  if (found.length === 3) {
    return { name, userId }
  } else {
    return { name: 'Unknown', userId: null }
  }
}
