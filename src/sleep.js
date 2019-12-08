module.exports = sleep

async function sleep (ms, value = ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(value)
    }, ms)
  })
}
