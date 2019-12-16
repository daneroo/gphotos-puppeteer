const path = require('path')
const fsPromises = require('fs').promises
const perf = require('./perf')
const sleep = require('./sleep')

module.exports = {
  make,
  moveDownloadedFile
}

async function make (basePath = './data') {
  const paths = {
    userDataDir: path.join(basePath, 'user-data-dir'),
    userDownloadDir: path.join(basePath, 'downloads')
  }
  for (const k in paths) {
    await fsPromises.mkdir(paths[k], { recursive: true })
    // console.log(`made path - ${k} : ${paths[k]}`)
  }

  return paths
}

// move the file to it's destination
// - the file does not exist until it's download is complete (file.crdownload does)
// - we are not waiting for this process to complete in the invoker,
//   so the time is not critical, hence the long tick, and maxIterations
// max time: maxIteration*tick = 100s.
// TODO(daneroo): might want to manage a queue of pending operations, and await thm before exit
async function moveDownloadedFile (filename, id, userDownloadDir) {
  const oldPath = path.join(userDownloadDir, filename)
  const newDir = path.join(userDownloadDir, id)
  const newPath = path.join(userDownloadDir, id, filename)
  const tick = 500 // ms
  const maxIterations = 200
  let iterations = 0
  let lastError
  const start = perf.now()
  for (let i = 0; i < maxIterations; i++) {
    await sleep(tick)
    try {
      await fsPromises.access(oldPath)
      await fsPromises.mkdir(newDir, { recursive: true })
      await fsPromises.rename(oldPath, newPath)
      lastError = null
      iterations = i
      break
    } catch (err) {
      lastError = err
    }
  }
  if (lastError) {
    console.error(`Error::mv ${filename} to ${newDir}: ${maxIterations} attempts elapsed:${perf.since(start)}`, lastError)
  } else {
    perf.log(`mv ${filename} to ${newDir} ${iterations}`, start, 1)
  }
}
