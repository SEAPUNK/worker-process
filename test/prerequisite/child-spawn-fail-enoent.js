import test from 'ava'
import childProcess from 'child_process'

test(t => {
  return new Promise((resolve, reject) => {
    t.plan(3)
    const steps = [
      (event) => t.is(event, 'child:error'),
      (event) => {
        t.is(event, 'child:close')
      },
      (event) => t.is(event, 'tick'),
      () => {
        resolve()
      }
    ]

    let ticks = 0
    const tickLog = () => {
      process.nextTick(() => {
        console.log('tick')
        setImmediate(() => {
          console.log('immediate')
          ticks++
          if (ticks > 50) return
          tickLog()
        })
      })
    }
    tickLog()

    const next = (...args) => {
      console.log(args)
      steps.shift().apply(null, args)
    }

    const child = childProcess.spawn('_nonexistent_file_asdf_', [], {
      stdio: ['pipe', 'pipe', 'pipe', 'pipe']
    })
    t.is(child.connected, false)

    child.on('close', () => {
      next('child:close')
      // process.nextTick(() => {
      //   next('tick')
      // })
    })
    child.on('error', () => {
      next('child:error')
    })
    child.on('disconnect', () => {
      next('child:disconnect')
    })
    child.on('exit', () => {
      next('child:exit')
    })
    child.on('message', () => {
      next('child:message')
    })

    const stream = child.stdio[3]
    t.is(stream.isPaused(), false)

    stream.on('close', () => {
      console.log('stream:close')
    })
    stream.on('data', (chunk) => {
      console.log('stream:data', chunk)
    })
    stream.on('end', () => {
      console.log('stream:end')
    })
    stream.on('error', (err) => {
      console.log('stream:error', err)
    })
    stream.on('readable', () => {
      console.log('stream:readable')
    })
    stream.on('drain', () => {
      console.log('stream:drain')
    })
    stream.on('finish', () => {
      console.log('stream:finish')
    })
    stream.on('pipe', (src) => {
      console.log('stream:pipe', src)
    })
    stream.on('unpipe', (src) => {
      console.log('stream:unpipe', src)
    })
  })
})
