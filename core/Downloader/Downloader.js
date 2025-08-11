import pLimit from 'p-limit'

import crypto from 'crypto'
import fs from 'fs'
import { DownloaderHelper } from 'node-downloader-helper'
import path from 'path'
import EventEmitter from 'events'

export class DownloadTask extends EventEmitter {
  constructor(url, destPath, override = false, sha1) {
    super()
    this.url = url
    this.destPath = destPath
    this.override = override
    this.sha1 = sha1

    this.progress = 0
    this.speed = 0
    this.retry = 5
    this.status = 'commit'
  }

  async start() {
    if (fs.existsSync(this.destPath)) {
      if (!this.override) {
        const isExistFileVerified = await this.verifyFile()
        if (isExistFileVerified) {
          this.complete()
          return
        }
        this.cleanupFile()
      } else {
        this.cleanupFile()
      }
    }

    this.status = 'pending'
    for (let i = 0; i < this.retry; i++) {
      try {
        await this.download()
        if (this.sha1) {
          const isVerified = await this.verifyFile()
          if (!isVerified) {
            throw new Error('File verification failed')
          }
        }
        this.complete()
        return
      } catch (err) {
        this.cleanupFile()
        if (i < this.retry - 1) {
          console.log(this.url)
          console.log(`Retrying (${i + 1}/${this.retry})...`)
          continue
        }
        this.status = 'error'
        throw err
      }
    }
  }

  download() {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(path.dirname(this.destPath))) {
        fs.mkdirSync(path.dirname(this.destPath), { recursive: true })
      }

      const downloader = new DownloaderHelper(this.url, path.dirname(this.destPath), {
        retry: {
          maxRetries: 3,
          delay: 500
        },
        override: this.override,
        timeout: 10000,
        fileName: path.basename(this.destPath),
        removeOnFail: true,
        headers:{
          'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0'
        }
      })

      downloader.on('end', () => {
        resolve()
      })

      downloader.on('error', (error) => {
        reject(error)
      })

      downloader.on('progress', (stats) => {
        this.progress = stats.progress / 100
        this.speed = stats.speed
        this.emit('progress', this.progress)
        this.emit('speed', this.speed)
      })

      downloader.start().catch(reject)
    })
  }

  cleanupFile() {
    try {
      if (fs.existsSync(this.destPath)) {
        fs.rmSync(this.destPath)
      }
    } catch (err) {
      console.error('Cleanup failed:', err)
    }
  }

  complete() {
    this.progress = 1
    this.speed = 0
    this.status = 'complete'
    this.emit('complete')
  }

  async verifyFile() {
    if (!this.sha1) {
      return true
    }

    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha1')
      const stream = fs.createReadStream(this.destPath)

      stream.on('data', (chunk) => {
        hash.update(chunk)
      })

      stream.on('end', () => {
        const fileHash = hash.digest('hex')
        resolve(fileHash === this.sha1.toLowerCase())
      })

      stream.on('error', (err) => {
        reject(err)
      })
    })
  }
}

export class Downloader extends EventEmitter {
  constructor(concurrency = 5, emitTime = 500) {
    super()
    this.concurrency = concurrency
    this.limit = pLimit(concurrency)
    this.tasks = []
    this.promiseTasks = []
    this.taskQueryInterval = null
    this.emitTime = emitTime
  }

  addTask(downloadTask) {
    if (!(downloadTask instanceof DownloadTask)) {
      throw new Error('Invalid task type')
    }
    this.tasks.push(downloadTask)
  }

  async start() {
    this.taskQueryInterval = setInterval(() => {
      this.queryStats()
    }, this.emitTime)

    // 使用箭头函数确保this上下文正确
    //很重要

    this.promiseTasks = this.tasks.map((task) => this.limit(() => task.start()))

    try {
      await Promise.all(this.promiseTasks)
      clearInterval(this.taskQueryInterval)
      console.log('全部完成')
    } catch (err) {
      clearInterval(this.taskQueryInterval)
      throw err
    }
  }

  queryStats() {
    let speed = 0
    let totalProgress = 0
    let completedTasks = 0

    for (let task of this.tasks) {
      if (task.status === 'pending') {
        speed += task.speed || 0
      }
      totalProgress += task.progress || 0
      if (task.status === 'complete') {
        completedTasks++
      }
    }
    const progress = totalProgress / this.tasks.length
    this.emit('progress', progress)
    this.emit('speed', speed)
  }
}
