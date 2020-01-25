
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
          describe: 'Which mode to use while traversing items',
          choices: ['pingPong', 'listAlbum', 'listDetail', ...modeNames()]
        },
        user: {
          alias: 'u',
          describe: 'select which user profile to use (default is to iterate over all authenticated users)'
        },
        maxIterations: {
          alias: 'i',
          default: 1,
          describe: 'Number of iterations to perform'
        },
        direction: {
          alias: 'd',
          default: 'ArrowRight',
          describe: 'Which direction to use while traversing items',
          choices: ['ArrowRight', 'ArrowLeft']
        }
      })
  },
  handler
}

async function handler (argv) {
  let exceptions = 0
  const { user, mode, direction, maxIterations, basePath, headless, verbose, progress } = argv

  console.info('Run Command Options:', { argv })

  const users = (user) ? [user] : await getUsers({ basePath })
  for (const user of users) {
    for (let it = 0; it < maxIterations; it++) {
      const { browser, mainPage, userDownloadDir } = await launchBrowser({ basePath, userId: user, headless })

      try {
        const { name, userId } = await authenticate(mainPage)
        if (!userId) {
          throw new Error(`Authentication failed user:${user}, name:${name}`)
        }
        console.log(`\nRunning iteration:${it + 1}/${maxIterations} as ${name} (${userId || ''})`)

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
      // console.log(`Iteration ${it + 1}/${maxIterations} terminated for ${user}. Closing browser`)
      await browser.close()
    }
  }
  console.log(`total exceptions: ${exceptions}`)
  console.log('Iteration terminated for all users')
}
