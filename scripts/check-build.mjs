import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import assert from 'node:assert/strict'

assert(existsSync('dist/index.html'), 'Missing dist/index.html')
assert(existsSync('dist/scene/desktop.js'), 'Missing dist/scene/desktop.js')
assert(existsSync('dist/scene/desktop.css'), 'Missing dist/scene/desktop.css')
assert(existsSync('dist/scene/boot.js'), 'Missing dist/scene/boot.js')

const html = readFileSync('dist/index.html', 'utf8')
assert(html.includes('id="bm-root"'), 'Missing #bm-root in built index.html')
assert(html.includes('id="bm-desktop"'), 'Missing #bm-desktop template')
assert(html.includes('Ayush Tyagi'), 'Missing Ayush Tyagi branding')

const files = directory => readdirSync(directory).flatMap(name => {
  const path = join(directory, name)
  return statSync(path).isDirectory() ? files(path) : [path]
})
const output = files('dist')
const total = output.reduce((sum, file) => sum + statSync(file).size, 0)

const desktopJsGzip = gzipSync(readFileSync('dist/scene/desktop.js')).length
const desktopCssGzip = gzipSync(readFileSync('dist/scene/desktop.css')).length

JSON.parse(readFileSync('vercel.json', 'utf8'))
console.log(`Desktop JS gzip: ${(desktopJsGzip / 1000).toFixed(1)} KB`)
console.log(`Desktop CSS gzip: ${(desktopCssGzip / 1000).toFixed(1)} KB`)
console.log(`Complete static output: ${(total / 1_000_000).toFixed(2)} MB (uncompressed)`)
console.log('Build validation and Vercel JSON: passed')
