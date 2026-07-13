const { spawn } = require('node:child_process')

const child = spawn(process.execPath, ['./node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
})

let expected = null
let completed = 0
let failed = false
let settled = false
let outputBuffer = ''

function finish(code) {
  if (settled) return
  settled = true
  child.kill()
  setTimeout(() => process.exit(code), 100).unref()
}

function inspectOutput(chunk) {
  const text = chunk.toString()
  process.stdout.write(text)
  outputBuffer += text

  const runningMatch = outputBuffer.match(/Running\s+(\d+)\s+tests?/)
  if (runningMatch) expected = Number(runningMatch[1])

  const lines = outputBuffer.split(/\r?\n/)
  outputBuffer = lines.pop() ?? ''
  for (const line of lines) {
    const match = line.match(/^\s*(ok|x|f|F|×)\s+\d+\s+\[/u)
    if (!match) continue
    completed += 1
    if (match[1] !== 'ok') failed = true
  }

  if (expected !== null && completed >= expected) {
    finish(failed ? 1 : 0)
  }
}

child.stdout.on('data', inspectOutput)
child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk)
})

child.on('exit', (code) => {
  finish(code ?? (failed ? 1 : 0))
})

child.on('error', (error) => {
  console.error(error)
  finish(1)
})
