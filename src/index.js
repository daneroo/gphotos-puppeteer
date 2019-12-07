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

  showPages(browser, 'Before', page)
  await page.evaluate(() => window.open('https://www.example.com/', 'Worker1', 'width=640,height=400'))
  const newWindowTarget = await browser.waitForTarget(target => target.url() === 'https://www.example.com/')
  const nuPage = await newWindowTarget.page()
  console.log(`nuPage: ${await nuPage.title()} ${await nuPage.url()}`)
  showPages(browser, 'After', nuPage)

  await sleep(1000)
  if (page) {
    await browser.close()
    return
  }

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
  console.log(`Found ${photoURLs.length} photos`)
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

async function showPages (browser, msg, page) {
  const pages = await browser.pages()

  console.log(`${msg}: ${pages.length} pages`)
  pages.forEach(async (p, i) => {
    console.log(`${page === p ? '=>' : '  '} ${i}: ${await p.title()} ${await p.url()}`)
  })
}

async function sleep (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
