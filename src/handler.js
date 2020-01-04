
const sleep = require('./sleep')

module.exports = {
  downloadHandlerWithTimeout,
  downloadHandler
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
