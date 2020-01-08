module.exports = resolvable

function resolvable () {
  let resolver
  const promise = new Promise((resolve) => { resolver = resolve })
  return {
    resolver,
    promise
  }
}
