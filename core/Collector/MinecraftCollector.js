import axios from 'axios'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { checkOSRules, mavenToPath } from '../utils/util.js'


export default class MinecraftCollector {

  constructor({ versionJson, libPath, assetsPath, versionPath, name, side = 'client', minecraftJarPath }) {

    this.versionJson = versionJson

    this.libPath = this.existify(libPath)
    this.assetsPath = this.existify(assetsPath)

    this.assetsIndexesPath = this.existify(path.join(this.assetsPath, 'indexes'))
    this.assetsObjectsPath = this.existify(path.join(this.assetsPath, 'objects'))


    this.versionPath = this.existify(versionPath)
    this.minecraftJarPath = minecraftJarPath

    this.name = name
    this.side = side
    let osMap = {
      win32: 'windows',
      darwin: 'osx',
      linux: 'linux'
    }
    this.systemType = osMap[os.platform()]
  }

  async collect() {
    //收集minecraft安装的运行库和静态资源

    const assetJson = await this.getAssetsJson(this.versionJson.assetIndex.url)

    const assetsJsonPath = path.join(this.assetsIndexesPath, this.versionJson.assets + '.json')
    fs.writeFileSync(assetsJsonPath, JSON.stringify(assetJson))

    let downloadTasks = []
    //收集运行库
    let requiredLib = this.versionJson.libraries.filter((lib) => {
      return checkOSRules(lib?.rules)
    })

    for (let lib of requiredLib) {
      //收集artifact
      if (lib.downloads.artifact) {
        downloadTasks.push({
          path: path.join(this.libPath, mavenToPath(lib.name)),
          url: lib.downloads.artifact.url,
          sha1: lib.downloads.artifact.sha1
        })
      }
      //收集classifier
      if (lib.downloads.classifiers) {

        for (let natives of Object.values(lib.downloads.classifiers)) {
          downloadTasks.push({
            path: path.join(this.libPath, natives.path),
            url: natives.url,
            sha1: natives.sha1
          })
        }
      }
    }
    //收集静态文件
    for (let asset of Object.values(assetJson.objects)) {
      let hash = asset.hash
      let assetStaticPath = path.join(this.assetsObjectsPath, hash.slice(0, 2), hash)
      downloadTasks.push({
        path: assetStaticPath,
        url: `https://resources.download.minecraft.net/${hash.slice(0, 2)}/${hash}`,
        sha1: hash
      })
    }
    //收集端
    downloadTasks.push({
      path: this.minecraftJarPath,
      url: this.versionJson.downloads[this.side].url,
      sha1: this.versionJson.downloads[this.side].sha1
    })

    return downloadTasks
  }

  async getAssetsJson(url) {
    const assets = await axios.get(url, { responseType: 'json', responseEncoding: 'utf-8' })
    return assets.data
  }

  existify(dir, recursive = true) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: recursive })
    }
    return dir
  }
}
