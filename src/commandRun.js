
const { launchBrowser, baseURL } = require('./browserSetup')
const { authenticate, getUsers } = require('./authenticate')
const { pingPong } = require('./navigation')
const { listDetail, listAlbum } = require('./rxlist')
const { navToFirstDetailPage, loopDetailPages, modeNames } = require('./flow')
const { navToEnd, navToStart, navToDetailPage } = require('./navigation')

module.exports = {
  command: 'run',
  describe: 'Iterate through all photos, and download as appropriate',
  builder: (yargs) => {
    yargs
      .options({ // new default: false
        mode: {
          alias: 'm',
          default: 'list',
          describe: 'which mode to use while traversing items',
          choices: ['pingPong', 'listAlbum', 'listDetail', ...modeNames()]
        },
        direction: {
          alias: 'd',
          default: 'ArrowRight',
          describe: 'which direction to use while traversing items',
          choices: ['ArrowRight', 'ArrowLeft']
        }
      })
  },
  handler
}

async function handler (argv) {
  const { mode, direction, basePath, headless, verbose, progress } = argv

  // console.info('Auth Command', { argv })
  console.info('Run Command', JSON.stringify({ mode, direction, headless, verbose, progress }))

  for (const user of await getUsers({ basePath })) {
    console.log(`\n-Run: user:${user}`)

    const { browser, mainPage, userDownloadDir } = await launchBrowser({ basePath, userId: user, headless })

    try {
      const { name, userId } = await authenticate(mainPage)
      if (!userId) {
        console.log('Authentication failed')
        throw new Error('Authentication failed')
      }
      console.log(`Authenticated as ${name} (${userId || ''})`)

      for (let i = 0; i < 1; i++) {
        if (mode === 'listAlbum') {
          await mainPage.reload({ waitUntil: ['load'] })
          await listAlbum(mainPage, direction)
        } else if (mode === 'pingPong') {
          await pingPong(mainPage)
        } else if (mode === 'listDetail') {
          // YThis section should move into flow
          const { first, last } = await navToEnd(mainPage)
          console.log(`First Photo (Detail Page): (url:${first})`)
          console.log(`Last Photo  (Detail Page): (url:${last})`)
          await navToDetailPage(mainPage, (direction === 'ArrowRight') ? first : last)
          await listDetail(mainPage, direction)
        } else {
          // This is deprecated... test before remove
          const first = await navToStart(mainPage)
          await navToDetailPage(mainPage, first)
          console.log(`First Photo (Detail Page): (url:${first})`)
          await loopDetailPages(mainPage, userDownloadDir, mode)
        }
      }
    } catch (err) {
      console.error(err)
    }
    // console.log('Closing browser')
    await browser.close()
  }
}
