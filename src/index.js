const yargs = require('yargs')
const auth = require('./commandAuth')
const run = require('./commandRun')
const { basePathDefault } = require('./browserSetup')

module.exports = main

// moved to gphotos-puppeteer (executable script  in root: script)
// main()
//   .catch(err => {
//     console.error(err)
//   })

async function main () {
  yargs // eslint-disable-line
    .command(run)
    .command(auth)
    .options({
      verbose: {
        // should be a count?? -v -v -vvv
        alias: 'v',
        describe: 'Run with verbose logging',
        default: false
      },
      progress: {
        alias: 'p',
        describe: 'Run with progress bar',
        default: true,
        type: 'boolean'
      },
      headless: {
        // alias: 'h', // confusing with help
        describe: 'Run in headless mode',
        default: true,
        type: 'boolean'
      },
      basePath: {
        alias: 'b',
        describe: 'Provide a base path for user-data-dir and downloads directories',
        default: basePathDefault,
        type: 'string'
      }
    })
    .demandCommand(1, 'You need at least one command before moving on')
    .epilogue(' * You should NOT check in your credentials/data directory into version control!! *')
    .help()
    .argv
}
