// This tests which raw buffer copy method is fastest.

// results: slice() is fastest, but this benchmark is unfair:
// slice() creates a shared-memory slice, which is even better than
// copying for my purposes, since it doesn't waste nearly as much memory

const assert = require('assert')
const Benchmark = require('benchmark')

function runSuite (buf) {
  const suite = new Benchmark.Suite()

  suite.add('Buffer#copy', () => {
    const newBuf = Buffer.allocUnsafe(buf.length)
    buf.copy(newBuf)

    assert(buf.equals(newBuf), 'Buffer does not equal new buffer')
  })

  suite.add('Buffer#slice', () => {
    const newBuf = buf.slice()

    assert(buf.equals(newBuf), 'Buffer does not equal new buffer')
  })

  // // // // //
  // for-of and for-in iteration with individual bytes is too slow
  // so it's been disabled
  // // // // //

  // suite.add('for-of iteration (keys)', () => {
  //   const newBuf = Buffer.allocUnsafe(buf.length)

  //   for (let i of buf.keys()) {
  //     newBuf[i] = buf[i]
  //   }

  //   assert(buf.equals(newBuf), 'Buffer does not equal new buffer')
  // })

  // suite.add('for-of iteration (values)', () => {
  //   const newBuf = Buffer.allocUnsafe(buf.length)

  //   let i = 0
  //   for (let b of buf) {
  //     newBuf[i] = b
  //     i++
  //   }

  //   assert(buf.equals(newBuf), 'Buffer does not equal new buffer')
  // })

  // suite.add('for-of iteration (entries)', () => {
  //   const newBuf = Buffer.allocUnsafe(buf.length)

  //   for (let [i, b] of buf.entries()) {
  //     newBuf[i] = b
  //   }

  //   assert(buf.equals(newBuf), 'Buffer does not equal new buffer')
  // })

  // suite.add('for-i iteration', () => {
  //   const newBuf = Buffer.allocUnsafe(buf.length)

  //   for (let i = 0; i < buf.length; i++) {
  //     newBuf[i] = buf[i]
  //   }

  //   assert(buf.equals(newBuf), 'Buffer does not equal new buffer')
  // })

  suite.on('cycle', event => {
    console.log(String(event.target))
  }).on('complete', function () {
    console.log('Fastest is ' + this.filter('fastest').map('name'))
  }).run()
}

console.log('Small buffer')
const bufSmall = Buffer.allocUnsafe(1024)
runSuite(bufSmall)

console.log('')

console.log('Large buffer')
const bufLarge = Buffer.allocUnsafe(1024 * 1024 * 250)
runSuite(bufLarge)
