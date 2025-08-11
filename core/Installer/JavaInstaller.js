import fs from 'fs';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import { JSDOM } from 'jsdom';
import axios from 'axios';
import { EventEmitter } from 'events';
import { DownloadTask } from '../Downloader/Downloader.js';
export default class JavaInstaller extends EventEmitter {
  constructor({ requireVersion, installPath }) {
    super()
    this.arch = os.arch()
    this.version = requireVersion
    this.installPath = this.existify(installPath)
    let osMap = {
      darwin: 'mac',
      linux: 'linux',
      win32: 'windows'
    }
    this.os = osMap[os.platform()] || ''
  }
  async install() {


    const url = await this.getJavaZipURL()
    const task = new DownloadTask(url, path.join(this.installPath, 'jdk.zip'), false)


    this.emit('step','installJava')
    task.on('progress',(progress)=>this.emit('progress',progress))
    task.on('speed', (e) => this.emit('speed', e))


    await task.start()


    this.extractZipSkipTopLevel(path.join(this.installPath, 'jdk.zip'), this.installPath)
    fs.rmSync(path.join(this.installPath, 'jdk.zip'))
    task.removeAllListeners()
    this.removeAllListeners()
    return path.join(this.installPath, 'bin', 'java.exe')
  }
  async getJavaZipURL() {
    let indexUrl = `https://mirrors.tuna.tsinghua.edu.cn/Adoptium/${this.version}/jdk/${this.arch}/${this.os}/`
    let indexHTML = await axios.get(indexUrl, {
      method: 'get',
      responseType: 'document'
    })
    const dom = new JSDOM(indexHTML.data)
    const table = dom.window.document.querySelector('table')
    const trs = table.querySelector('tbody')?.querySelectorAll('tr')
    let filename = ''
    for (let tr of trs) {
      let link = tr.querySelector('.link')?.querySelector('a')
      if (link) {
        const href = link.href
        if (href.includes('.zip')) {
          filename = href
          break
        }
      }
    }
    if (filename) {
      return indexUrl + filename
    }
  }
  existify(dir, recursive = true) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: recursive })
    }
    return dir
  }
  extractZipSkipTopLevel(zipPath, targetDir) {
    const zip = new AdmZip(zipPath)
    const zipEntries = zip.getEntries()
    const topLevelDir = zipEntries[0].entryName.split('/')[0] + '/'
    const topLevelDirLength = topLevelDir.length
    zipEntries.forEach((entry) => {
      if (!entry.isDirectory && entry.entryName.startsWith(topLevelDir)) {
        const relativePath = entry.entryName.slice(topLevelDirLength)
        const fullPath = path.join(targetDir, relativePath)
        const dir = path.dirname(fullPath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        zip.extractEntryTo(entry, dir, false, false, path.basename(fullPath))
      }
    })
  }
}
