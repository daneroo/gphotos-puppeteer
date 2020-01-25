
const { launchBrowser } = require('./browserSetup')
const { authenticate, getUsers } = require('./authenticate')
const { pingPong } = require('./navigation')
const { listDetail, listAlbum } = require('./rxlist')
const { loopDetailPages, modeNames } = require('./flow')
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
  let exceptions = 0
  const { mode, direction, basePath, headless, verbose, progress } = argv

  // console.info('Auth Command', { argv })
  console.info('Run Command', JSON.stringify({ mode, direction, headless, verbose, progress }))

  const users = await getUsers({ basePath })
  // const users = ['peru.lauzon@gmail.com', 'daniel.lauzon@gmail.com']
  for (const user of users) { // .slice(0, 1) .slice(-1)
    const maxIterations = 5
    for (let it = 0; it < maxIterations; it++) {
      console.log(`-Run: user:${user} iteration:${it + 1}/${maxIterations}`)
      const { browser, mainPage, userDownloadDir } = await launchBrowser({ basePath, userId: user, headless })

      try {
        const { name, userId } = await authenticate(mainPage)
        if (!userId) {
          console.log('Authentication failed')
          throw new Error('Authentication failed')
        }
        console.log(`Authenticated as ${name} (${userId || ''})`)

        if (mode === 'listAlbum') {
          await mainPage.reload({ waitUntil: ['load'] })
          await listAlbum(mainPage, { direction })
        } else if (mode === 'pingPong') {
          await pingPong(mainPage)
        } else if (mode === 'listDetail') {
          // This section should move into flow - and combine navTo,..,.listDetail|Album
          const { first, last } = await navToEnd(mainPage)
          console.log(`First Photo (Detail Page): (url:${first})`)
          console.log(`Last Photo  (Detail Page): (url:${last})`)
          await navToDetailPage(mainPage, (direction === 'ArrowRight') ? first : last)
          await listDetail(mainPage, { direction })
        } else {
          // This is deprecated... test before remove
          const first = await navToStart(mainPage)
          await navToDetailPage(mainPage, first)
          console.log(`First Photo (Detail Page): (url:${first})`)
          await loopDetailPages(mainPage, userDownloadDir, mode)
        }
      } catch (err) {
        exceptions++
        console.error(err)
      }
      console.log(`Iteration ${it + 1}/${maxIterations} terminated for ${user}. Closing browser`)
      await browser.close()
    }
  }
  console.log(`total exceptions: ${exceptions}`)
  console.log('Iteration terminated for all users')
}
