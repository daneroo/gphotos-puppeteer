const path = require('path')
const fsPromises = require('fs').promises
const perf = require('./perf')
const sleep = require('./sleep')

module.exports = {
  moveDownloadedFile,
  downloadHandlerWithTimeout,
  downloadHandler
}

// move the file to it's destination
// - the file does not exist until it's download is complete (file.crdownload does)
// - we are not waiting for this process to complete in the invoker,
//   so the time is not critical, hence the long tick, and maxIterations
// max time: maxIteration*tick = 100s.
// TODO(daneroo): might want to manage a queue of pending operations, and await thm before exit
async function moveDownloadedFile (filename, id, downloadDir) {
  const oldPath = path.join(downloadDir, filename)
  const newDir = path.join(downloadDir, id)
  const newPath = path.join(downloadDir, id, filename)
  const tick = 500 // ms
  const maxIterations = 200
  // let iterations = 0
  let lastError
  const start = perf.now()
  for (let i = 0; i < maxIterations; i++) {
    await sleep(tick)
    try {
      await fsPromises.access(oldPath)
      await fsPromises.mkdir(newDir, { recursive: true })
      await fsPromises.rename(oldPath, newPath)
      lastError = null
      // iterations = i
      break
    } catch (err) {
      lastError = err
    }
  }
  if (lastError) {
    // console.error(`Error::mv ${filename} to ${newDir}: ${maxIterations} attempts elapsed:${perf.since(start)}`, lastError)
  } else {
    // perf.log(`mv ${filename} to ${newDir} ${iterations}`, start, 1)
  }
}

// same as downloadHanlder, but wraps the promise with a raced timeout...
// could also return the original promise, and stick it in an unresolved queue.
// The timeout here, is for download to have been initiated, not finished..
function downloadHandlerWithTimeout (n, id, timeout) {
  const [responseHandler, responsePromise] = downloadHandler(n, id, timeout)
  // Promise.race between responsePromise and sleep
  // let [completed] = await Promise.race(queue.map(p => p.then(res => [p])));
  const responseWithTimeoutPromise = Promise.race([
    responsePromise,
    sleep(timeout, { timeout: timeout })
  ])
  return [responseHandler, responseWithTimeoutPromise]
}

// downloadHandler returns an [handler,promise]
// the promise will be resolved in the handler, but care must be taken for the case where the handler is never invoked, or takes too long
// the event handler function, meant to be registered: like this:
//   const [responseHandler, responsePromise] = downloadHandler(n, id, timeout)
//   mainPage.on('response', responseHandler)
//   await shiftD(mainPage) // initiate download
//   mainPage.removeListener('response', responseHandler)
// Not sure I shoud have the id,timeout here
//   they are used for logging and conditional logging of resolution afer likely unregistering
function downloadHandler (n, id, timeout) {
  // parameter; id is included in closure
  const start = +new Date()
  let resolver
  const responsePromise = new Promise(function (resolve, reject) {
    resolver = resolve
  })

  const responseHandler = response => {
    const url = response._url
    const headers = response.headers()
    const contentDisposition = headers['content-disposition']
    const filename = filenameFromContentDisposition(contentDisposition)
    const contentLength = headers['content-length']
    if (filename) {
      const elapsed = +new Date() - start
      resolver({ n, id, filename, contentLength, url, elapsed })
      if (elapsed > timeout) {
        console.log(`** Resolved after ${elapsed}ms > ${timeout}ms (${id}`)
        console.log(`   url: (${url}`)
      }
    }
  }
  return [responseHandler, responsePromise]
}

function filenameFromContentDisposition (contentDisposition) {
  if (!contentDisposition) {
    return null
  }
  // tests
  // attachment;filename="IMG_9487.JPG"
  // attachment; filename="MVI_5560.AVI"  // notice there can be differing whitespa after the semi-colon
  // attachment; filename="response.bin"; filename*=UTF-8''response.bin  // should be excluded
  const re = /attachment;\s*filename="(.*)"$/
  const found = contentDisposition.match(re)
  // console.log({ found })
  if (found && found.length === 2) {
    return found[1]
  } else {
    // for debugging
    // console.log('Content-Disposition not matched:', contentDisposition)
  }
  return null
}
