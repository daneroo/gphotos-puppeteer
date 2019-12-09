
module.exports = {
  newQueue,
  assign
}

// Functionality:
// q = newQueue({fetcher,launcher})
// async fetcher():[items] will be called when items are needed
// - and these items will be added to items[] array
// - fetcher should signify that is has no more items by return an empty array.
// async launcher(item) is dispatch new work
// -  maintains assignment of new tasks to inFlight array
// - Promise.race is used to maintain a full inFlight[]

function newQueue ({ fetcher, laucher } = {}) {
  return {
    items: [],
    inFlight: [], // each assigned to one of the workers, length=numWorkers
    results: [],
    doneFetching: false,
    doneProcessing: false
  }
}

// tick():
// if not enough items, call producer
// else assign,..

// TODO: if inFlight has at least one non null entry, race to remove it
// then fill the inFlight array up to numWorkers
async function assign ({ items, inFlight, results }, consumer, numWorkers = 2) {
  // remove with race
  // if inFlight has at least one non null entry, race to remoe it
  // fill the inFlight array with tasks
  let assigned = 0
  while (items.length > 0) {
    let foundSlot = false
    for (let unIdx = 0; unIdx < inFlight.length; unIdx++) {
      if (!inFlight[unIdx]) { // found an unassigned slot
        const item = items.shift()
        console.log(`Found slot at ${unIdx} for item ${item}`)
        const task = await consumer(item) // blocking part of consumer
        // task() return a promise (for non blocking part)
        inFlight[unIdx] = task() // but do not await
        foundSlot = true
        break
      }
    }
    if (foundSlot) {
      assigned++
    } else {
      break
    }
  }
  return assigned
}
