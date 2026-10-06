import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Ayush Tyagi Retro Workstation Portfolio', () => {
  const rootDir = path.resolve(__dirname, '..')
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8')
  const desktopJs = fs.readFileSync(path.join(rootDir, 'public/scene/desktop.js'), 'utf-8')
  const basicJs = fs.readFileSync(path.join(rootDir, 'public/scene/pc/basic.js'), 'utf-8')

  it('contains the complete Berlin Monitor scene DOM structure', () => {
    expect(indexHtml).toContain('id="bm-root"')
    expect(indexHtml).toContain('id="bm-desktop"')
    expect(indexHtml).toContain('id="still"')
    expect(indexHtml).toContain('id="osd"')
    expect(indexHtml).toContain('id="gl"')
    expect(indexHtml).toContain('class="hud top"')
    expect(indexHtml).toContain('class="hud ctl"')
  })

  it('configures Ayush Tyagi as the portfolio identity in HTML and fallback nav', () => {
    expect(indexHtml).toContain('Ayush Tyagi — Forensics &amp; Digital Craft')
    expect(indexHtml).toContain('id="home-link">Ayush Tyagi</button>')
    expect(indexHtml).toContain('https://github.com/Velqore')
    expect(indexHtml).toContain('ayushtyagi5544@gmail.com')
  })

  it('includes core projects in about template and posts list', () => {
    expect(indexHtml).toContain('https://pratyaksh-ai.vercel.app/')
    expect(indexHtml).toContain('https://aurexcyber.vercel.app/')
    expect(indexHtml).toContain('https://cyberrepo.dpdns.org/')
    expect(indexHtml).toContain('2024/0103322A')
  })

  it('configures 11 cassette tapes on the shelf with customized project metadata', () => {
    expect(desktopJs).toContain('Pratyaksh-AI')
    expect(desktopJs).toContain('Aurex')
    expect(desktopJs).toContain('CyberRepo Hub')
    expect(desktopJs).toContain('SIFS Forensics')
    expect(desktopJs).toContain('Beyond Evidence')
    expect(desktopJs).toContain('KR Mangalam Univ')
    expect(desktopJs).toContain('OSINT Research')
    expect(desktopJs).toContain('JOBS')
  })

  it('renders Ayush Tyagi on the TV welcome screen stipple', () => {
    expect(desktopJs).toContain('big:["AYUSH","TYAGI"]')
    expect(desktopJs).toContain('FORENSICS & SOFTWARE · CH 00')
  })

  it('configures the IBM PC simulator with Ayush Tyagi profile and Velqore BBS', () => {
    expect(basicJs).toContain('VELQORE BBS')
    expect(basicJs).toContain('github.com/Velqore')
    expect(basicJs).toContain('K.R. Mangalam University')
  })

  it('verifies all 22 scene submodules are present in public/scene', () => {
    const requiredFiles = [
      'desktop.js', 'boot.js', 'desktop.css', 'city/variants/depth.js', 'city/variants/living.js',
      'city/lib/common.js', 'city/lib/living-shader.js', 'city/lib/night.js', 'city/lib/rain.js',
      'notepad/notepad.js', 'winframe/winframe.js', 'winframe/charts.js', 'credits/credits.js',
      'pccase/case.js', 'vcrdoor/vcrdoor.js', 'cdplayer/cdplayer.js', 'calc/calc.js',
      'pckeys/pckeys.js', 'coffee/coffee.js', 'clock/clock.js', 'touch/touch.js', 'pc/basic.js'
    ]
    for (const file of requiredFiles) {
      const fullPath = path.join(rootDir, 'public/scene', file)
      expect(fs.existsSync(fullPath)).toBe(true)
    }
  })

  it('provides crystal clear About and Work text panels with rich descriptions', () => {
    expect(desktopJs).toContain('function aboutPanel')
    expect(desktopJs).toContain('Patent application filed')
    expect(desktopJs).toContain('CyberRepo Hub')
    expect(desktopJs).toContain('class="desc"')
  })

  it('configures lightweight mobile performance optimizations', () => {
    expect(desktopJs).toContain('msaaSamples=isMobileDev?0:4')
    expect(desktopJs).toContain('Math.min(innerWidth/2,256)')
    expect(desktopJs).toContain('cap:on?(level==="smooth"?1.25:1.5):(level==="smooth"?1.5:2)')
  })
})
