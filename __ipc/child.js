const workerProcess = require('../')
const minico = require('minico')

console.log('child:start')
minico(function * () {
  const parentProcess = yield workerProcess.connect()
  parentProcess.onmessage = function (message) {
    console.log('child:message', message.length)
  }
  console.time('child:sendMessages')
  const buf = Buffer.alloc(1000 * 1000 * 1000).fill(0x40)
  for (let i = 0; i < 10; i++) {
    yield parentProcess.send(buf)
  }
  console.timeEnd('child:sendMessages')
})().catch(err => {
  console.error('child:fail')
  console.error(err)
})
