const childProcess = require('child_process')
const ProtocolStream = require('../lib/ProtocolStream')

console.log('parent:spawning')
const child = childProcess.spawn('node', ['--expose-gc', 'child.js'], {
  stdio: ['ignore', 'inherit', 'inherit', 'pipe']
})
console.time('connection')

const ipc = child.stdio[3]

child.on('close', i => console.log('parent:evt:child:close', i))
child.on('error', i => console.log('parent:evt:child:error', i))
child.on('exit', i => console.log('parent:evt:child:exit', i))

ipc.on('close', i => console.log('parent:evt:close', i))
// ipc.on('data', i => console.log('parent:evt:data', i))
ipc.on('error', i => {
  console.timeEnd('connection')
  console.log('parent:evt:error', i)
})
ipc.on('finish', i => console.log('parent:evt:finish', i))
ipc.on('end', i => console.log('parent:evt:end', i))

const onChildError = err => {
  console.log('parent:child:error')
  console.log(err)
}
const onChildHandshake = () => {
  console.time('parent:child:messagesRecv')
  console.log('parent:child:handshake')
  childIPC.send(Buffer.from('woohoo'))
  childIPC.send(Buffer.from('heck yeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhhyeahhhhhhhhhhhhhhhhhhhh'))
}
let msgct = 0
const onChildMessage = msg => {
  if (++msgct === 10) console.timeEnd('parent:child:messagesRecv')
  // console.log('parent:child:message', msgct++, msg.length, Date.now())
}
const childIPC = new ProtocolStream(ipc, ipc, true, onChildError, onChildHandshake, onChildMessage)
childIPC.writableIPC.write(Buffer.from([0]), () => {})
