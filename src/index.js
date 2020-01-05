
const dataDirs = require('./dataDirs.js')
const browserSetup = require('./browserSetup')
const sleep = require('./sleep')
const { navToFirst, enterDetailPage, loopDetailPages, modes } = require('./flow')

const baseURL = 'https://photos.google.com/'

main()
  .catch(err => {
    console.error(err)
  })

async function main () {
  const headless = true
  const numWorkers = 0
  const { userDataDir, userDownloadDir } = await dataDirs.make('./data')
  const { browser, mainPage/*, workers */ } = await browserSetup.setup({
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

  // const items = await extractItems(mainPage, 'ArrowRight')
  // const items2 = await extractItems(mainPage, 'ArrowLeft')

  const href = await navToFirst(mainPage)
  if (href) {
    console.log(`FirstPhoto (Album Page): (href:${href})`)
    const url = await enterDetailPage(mainPage)
    // Here we expect url to match href
    if (url === href) {
      console.log(`FirstPhoto (Detail Page): (url:${href})`)
      await sleep(500) // why ?

      await loopDetailPages(mainPage, userDownloadDir, modes.files)
    } else {
      console.log('Active href on main does not match detail url')
      console.log(` Main active href: ${href}`)
      console.log(` Detail url: ${url}`)
    }
  } else {
    console.log('couldn\'t find first photo on main page')
  }

  await sleep(3000)

  console.log('Closing browser')
  await browser.close()
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
