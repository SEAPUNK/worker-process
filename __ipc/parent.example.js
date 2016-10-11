const childProcess = require('child_process')
const ProtocolStream = require('../lib/ProtocolStream')
const msgpack = require('msgpack-lite')

const child = childProcess.spawn('node', ['--expose-gc', 'child.example.js'], {
  stdio: ['ignore', 'inherit', 'inherit', 'pipe']
})

const ipc = child.stdio[3]

const onChildError = err => {
  console.error(err)
}

const onChildHandshake = () => {
  console.time('parent:child:messagesRecv')
  childIPC.send(msgpack.encode('hello, worker!'))
}

const onChildMessage = msg => {
  console.log(msgpack.decode(msg))
}

const childIPC = new ProtocolStream(ipc, ipc, true, onChildError, onChildHandshake, onChildMessage)
childIPC.writableIPC.write(Buffer.from([0]), () => {})
