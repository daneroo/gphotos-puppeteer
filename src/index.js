
const dataDirs = require('./dataDirs.js')
const browserSetup = require('./browserSetup')
const sleep = require('./sleep')

const baseURL = 'https://photos.google.com/'

mainWithTry()

async function mainWithTry () {
  try {
    main()
  } catch (err) {
    console.error(err)
  }
}

async function main () {
  const headless = false
  const numWorkers = 2
  const { userDataDir, userDownloadDir } = await dataDirs.make('./data')
  const { browser, mainPage, workers } = await browserSetup.setup({
    headless,
    numWorkers,
    userDataDir
  })

  console.log(`Found ${workers.length} workers`)

  await authenticate(mainPage)
  await sleep(1000)

  const numItems = 10
  const items = await extractItems(mainPage, numItems)
  await sleep(3000)

  // const dlpage = await browser.newPage()
  const doneItems = []
  await downloadItems(workers, items, doneItems, userDownloadDir)
  // await downloadItems(workers[0], items, doneItems, userDownloadDir)
  // await downloadItems(workers[1], items, doneItems, userDownloadDir)

  // const p0 = downloadItems(workers[0], items, doneItems, userDownloadDir)
  // await sleep(10000)
  // const p1 = downloadItems(workers[1], items, doneItems, userDownloadDir)

  // await [p0, p1]
  await sleep(3000)

  if (mainPage) {
    await browser.close()
    return
  }

  console.log('Closing browser')
  await browser.close()
}

async function authenticate (page) {
  await page.goto(baseURL)
  await sleep(1000)
  console.log('Navigated to $(baseURL)')

  // Until we are authenticated (wait forever)
  while (true) {
    const url = page.url()
    if (url === baseURL) {
      console.log('Authenticated!')
      break
    }
    console.log(`Current URL is ${url}. Awaiting auth`)
    await sleep(2000)
  }
}

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

async function downloadItems (workers, items, doneItems, userDownloadDir) {
  // TODO(daneroo): move this to setup...
  for (let w = 0; w < workers.length; w++) {
    const { id, page } = workers[w]
    console.log(`Downloading items with worker: ${id}`)
    await page._client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: userDownloadDir
    })
    console.log(`  set dlDir to: ${userDownloadDir}`)
  }
  await sleep(1000)
  while (items.length > 0) { // TODO(daneroo): Queue not done...
    const { id, page } = workers[items.length % workers.length]
    const item = items.shift() // take first item from items queue
    console.log(`Worker(${id}): Going to page: ${item}`)
    await page.goto(item)
    console.log(`Worker(${id}): Landed on page:${item}`)
    await page.keyboard.down('Shift')
    await page.keyboard.press('KeyD')
    await page.keyboard.up('Shift')
    await sleep(3000)
    doneItems.push(item)
  }
}
