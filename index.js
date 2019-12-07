const puppeteer = require('puppeteer')

const userDataDir = './data/user-data-dir'
const userDownloadDir = './data/downloads'
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
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: userDataDir
  })

  const page = await browser.newPage()

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

  // extract as while loop
  const photoURLs = []
  for (let i = 0; i < 100; i++) {
    await page.keyboard.press('ArrowRight')
    await sleep(100)
    const activeHrefJSHandle = await page.evaluateHandle(() => document.activeElement.href)
    const href = await activeHrefJSHandle.jsonValue()
    console.log(`Current active element href is ${href}`)
    photoURLs.push(href)
  }
  console.log(`found ${photoURLs.length} photos`)
  await sleep(3000)

  const dlpage = await browser.newPage()
  await dlpage._client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: userDownloadDir
  })
  await sleep(3000)
  await dlpage.bringToFront()
  for (let i = 0; i < photoURLs.length; i++) {
    console.log(`Going to page: ${photoURLs[i]}`)
    await dlpage.goto(photoURLs[i])
    await dlpage.keyboard.down('Shift')
    await dlpage.keyboard.press('KeyD')
    await dlpage.keyboard.up('Shift')
    await sleep(3000)
  }

  console.log('Closing browser')
  await browser.close()
}

async function sleep (ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, ms)
  })
}
