import AdmZip from 'adm-zip'
import { DownloadTask } from '../Downloader/Downloader.js'
import fs from 'fs'
import path from 'path'
import { checkOSRules, isMavenLikePath, mavenToPath } from '../utils/util.js'

export default class ForgeCollector {
  constructor({ version, forgeVersion, versionPath, libPath, versionJson, side, mojmapsURL, mojmapsSha1 }) {
    this.version = version
    this.forgeVersion = forgeVersion
    this.versionPath = versionPath
    this.forgeInstallDir = this.existify(path.join(this.versionPath, 'forge'))
    this.forgeInstallerPath = path.join(this.forgeInstallDir, 'installer.jar')
    this.libPath = libPath
    this.side = side || 'client'
    this.versionJson = versionJson
    this.mojmapsURL = mojmapsURL
    this.mojmapsSha1 = mojmapsSha1
  }
  async collect() {
    //这里必须下载完成并且解压到位 不会妨碍后面的收集
    const task = {
      url: `https://bmclapi2.bangbang93.com/forge/download?mcversion=${this.version}&version=${this.forgeVersion}&category=installer&format=jar`,
      path: this.forgeInstallerPath,
      sha1: ''
    }


    const downloadTask = new DownloadTask(task.url, task.path, true)
    await downloadTask.start()

    const jar = new AdmZip(this.forgeInstallerPath)
    const unpack = this.existify(path.join(this.forgeInstallDir, 'unpack'))
    jar.extractAllTo(unpack)

    let isLegacyForge = fs.existsSync(path.join(unpack, `forge-${this.version}-${this.forgeVersion}-universal.jar`))

    if (isLegacyForge) {

      const installProfileJsonPath = path.join(unpack, 'install_profile.json')
      const installProfileJson = JSON.parse(fs.readFileSync(installProfileJsonPath, 'utf-8'))

      let versionInfo = installProfileJson.versionInfo
      let libraries = versionInfo.libraries

      let downloadTasks = []

      for(let lib of libraries){

        let pathLike = mavenToPath(lib.name)
        if(lib?.name?.startsWith('net.minecraftforge:forge')){
          const universalJar = path.join(unpack, installProfileJson.install.filePath)
          let baseDir = this.existify(path.join(this.libPath,path.dirname(pathLike)))
          fs.copyFileSync(universalJar,path.join(baseDir,installProfileJson.install.filePath).replace('-universal',''))

          //直接移动自带的universal
          continue
        }
        let url = lib?.url ? lib.url + pathLike : 'https://libraries.minecraft.net/' + pathLike
        let filepath = path.join(this.libPath,pathLike)
        downloadTasks.push({
          path:filepath,
          url,
          sha1:lib?.checksums?.[0] || null
        })
      }
      
      return {isLegacyForge,downloadTasks}
    }
    else {

      const installProfileJsonPath = path.join(unpack, 'install_profile.json')
      const forgeVersionJsonPath = path.join(unpack, 'version.json')
      const forgeVersionJson = JSON.parse(fs.readFileSync(forgeVersionJsonPath, 'utf-8'))
      const installProfileJson = JSON.parse(fs.readFileSync(installProfileJsonPath, 'utf-8'))


      if (installProfileJson.path) {
        let extraPath = path.dirname(mavenToPath(installProfileJson.path))
        let mavenFiles = fs.readdirSync(path.join(unpack, 'maven', extraPath))
        this.existify(path.join(this.libPath, extraPath))
        for (let file of mavenFiles) {
          let extraFileFrom = path.join(unpack, 'maven', extraPath, file)
          let extraFileTo = path.join(this.libPath, extraPath, file)
          fs.copyFileSync(extraFileFrom, extraFileTo)
        }
      }



      let downloadTasks = []


      //先检查version里
      for (let lib of forgeVersionJson.libraries.filter((lib) => checkOSRules(lib?.rules))) {
        downloadTasks.push({
          path: path.join(this.libPath, mavenToPath(lib?.name)),
          url: lib.downloads.artifact.url,
          sha1: lib.downloads.artifact.sha1
        })
      }


      //检查installprofile
      for (let lib of installProfileJson.libraries.filter((lib) => checkOSRules(lib?.rules))) {
        downloadTasks.push({
          path: path.join(this.libPath, mavenToPath(lib?.name)),
          url: lib.downloads.artifact.url,
          sha1: lib.downloads.artifact.sha1
        })
      }


      const requireProcessors = installProfileJson.processors.filter((i) => {
        if ((this.side === 'client' && !i?.sides) || i?.sides?.includes(this.side)) {
          return true
        }
        return false
      })

      if (requireProcessors.findIndex((i) => i?.args?.includes('DOWNLOAD_MOJMAPS')) >= 0) {

        let outputMavenPath = installProfileJson.data['MOJMAPS'][this.side]

        if (isMavenLikePath(outputMavenPath)) {
          const outputPath = path.join(this.libPath, mavenToPath(outputMavenPath))
          downloadTasks.push({
            path: outputPath,
            url: this.mojmapsURL,
            sha1: this.mojmapsSha1
          })
        }
      }

      return {isLegacyForge,downloadTasks}

    }

  }
  existify(dir, recursive = true) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: recursive })
    }
    return dir
  }
}
