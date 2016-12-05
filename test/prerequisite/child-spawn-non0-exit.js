// import test from 'ava'
// import childProcess from 'child_process'

// test(t => {
//   return new Promise((resolve, reject) => {
//     t.plan(4)
//     const steps = [
//       (event) => t.is(event, 'error'),
//       (event) => t.is(event, 'tick'),
//       (event) => {
//         t.is(event, 'close')
//         resolve()
//       },
//       (event) => t.is(event, 'tick')
//     ]

//     const next = (...args) => {
//       steps.shift().apply(null, args)
//     }

//     const child = childProcess.spawn(process.argv[0], ['kajsdlfkjaslkdfjsadf.js'], {
//       stdio: ['pipe', 'pipe', 'pipe', 'pipe']
//     })

//     child.on('close', (code, signal) => {
//       console.log('close', code, signal)
//     })
//     child.on('disconnect', () => {
//       console.log('disconnect')
//     })
//     child.on('error', (err) => {
//       console.log('close', err)
//     })
//     child.on('exit', (code, signal) => {
//       console.log('exit', code, signal)
//     })
//     child.on('message', (message, sendHandle) => {
//       console.log('message', message, sendHandle)
//     })

//     // child.on('close', () => next('close'))
//     // child.on('error', () => next('error'))
//     // child.on('disconnect', () => next('disconnect'))
//     // child.on('exit', () => next('exit'))
//     // child.on('message', () => next('message'))
//   })
// })
