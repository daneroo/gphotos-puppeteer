
const dataDirs = require('./dataDirs.js')
const browserSetup = require('./browserSetup')
const sleep = require('./sleep')
// const { downloadItems } = require('./flowWorker')
// const { extractItems } = require('./flowMain')
const { navToFirst, enterDetailPage, nextDetailPage, shiftD } = require('./flowMain')
const { performance, PerformanceObserver } = require('perf_hooks')

const baseURL = 'https://photos.google.com/'

main()
  .catch(err => {
    console.error(err)
  })

async function main() {
  const headless = false
  const numWorkers = 0
  const { userDataDir, userDownloadDir } = await dataDirs.make('./data')
  const { browser, mainPage, workers } = await browserSetup.setup({
    headless,
    numWorkers,
    userDataDir
  })
  // console.log(`Found ${workers.length} workers`)

  // browser.on('targetchanged', t => {
  //   console.log(`>> target change: ${t.url()}`)
  // })

  await authenticate(mainPage)
  await sleep(1000)

  const obs = new PerformanceObserver((list) => {
    const entry = list.getEntries()[0]
    console.log(`${entry.duration}ms : ('${entry.name}')`)
  })
  obs.observe({ entryTypes: ['measure'], buffered: false }) // we want to react to full measurements and not individual marks

  await mainPage._client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: userDownloadDir
  })
  console.log(`  set dlDir to: ${userDownloadDir}`)

  // performance.mark('start')
  // performance.mark('end')
  // performance.measure(`nextDetailPage(${n}) : ${nurl}`, 'start', 'end')

  const href = await navToFirst(mainPage)
  if (href) {
    console.log(`FirstPhoto (href:${href})`)
    const url = await enterDetailPage(mainPage)
    // Here we expect url to match href
    if (url === href) {
      console.log(`FirstPhoto (url:${href})`)
      await sleep(1000)

      let n = 10
      let currentUrl
      while (n > 0) {
        currentUrl = mainPage.url()
        const id = photoIdFromURL(currentUrl)
        if (id) {
          const responseHandler = responseHandlerForId(id)
          mainPage.on('response', responseHandler)
          await shiftD(mainPage)

          await sleep(5000)

          mainPage.removeListener('response', responseHandler)
        } else {
          console.log(`Current does not look like a photo detail page irl:${currentUrl}`)
        }

        const nurl = await nextDetailPage(mainPage)
        if (!nurl) {
          console.log(`Looks like nextDetailPage failed: ${nurl}`)
        }

        n--
      }
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

function responseHandlerForId(id) {
  // parameter; id is included in closure
  const responseHandler = response => {
    const url = response._url
    const headers = response.headers()
    const contentDisposition = headers['content-disposition']
    const filename = filenameFromContentDisposition(contentDisposition)
    const contentLength = headers['content-length']
    if (filename && url.includes('usercontent')) {
      console.log('>>', filename, contentLength, id, url.substring(27, 57))
      // console.log('\n', url, '\n')
    }
  }
  return responseHandler
}

function photoIdFromURL(url) {
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

function filenameFromContentDisposition(contentDisposition) {
  if (!contentDisposition) {
    return null
  }
  // attachment;filename="IMG_9487.JPG"
  const re = /attachment;filename="(.*)"/
  const found = contentDisposition.match(re)
  // console.log({ found })
  if (found && found.length === 2) {
    return found[1]
  }
  return null
}

// authenticate returns the result of getActiveUser(),
// or waits forever for authentication
// flag to return early (if we are headless)
async function authenticate(page) {
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
async function getActiveUser(page) {
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
