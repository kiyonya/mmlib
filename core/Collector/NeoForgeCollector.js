import AdmZip from 'adm-zip'
import { DownloadTask } from '../Downloader/Downloader.js'
import fs from 'fs'
import path from 'path'
import { checkOSRules, isMavenLikePath, mavenToPath } from '../utils/util.js'

export default class NeoForgeCollector {
    constructor({ version, neoForgeVersion, versionPath, libPath, versionJson, side, mojmapsURL, mojmapsSha1 }) {
        this.version = version
        this.neoForgeVersion = neoForgeVersion
        this.versionPath = versionPath
        this.neoForgeInstallDir = this.existify(path.join(this.versionPath, 'neoForge'))
        this.neoForgeInstallerPath = path.join(this.neoForgeInstallDir, 'installer.jar')
        this.libPath = libPath
        this.side = side || 'client'
        this.versionJson = versionJson
        this.mojmapsURL = mojmapsURL
        this.mojmapsSha1 = mojmapsSha1
    }
    async collect() {
        //这里必须下载完成并且解压到位 不会妨碍后面的收集
        const task = {
            url: `https://bmclapi2.bangbang93.com/neoforge/version/${this.neoForgeVersion}/download/installer`,
            path: this.neoForgeInstallerPath,
            sha1: ''
        }


        const downloadTask = new DownloadTask(task.url, task.path, true)
        await downloadTask.start()

        const jar = new AdmZip(this.neoForgeInstallerPath)
        const unpack = this.existify(path.join(this.neoForgeInstallDir, 'unpack'))
        jar.extractAllTo(unpack)


        const installProfileJsonPath = path.join(unpack, 'install_profile.json')
        const neoForgeVersionJsonPath = path.join(unpack, 'version.json')
        const neoForgeVersionJson = JSON.parse(fs.readFileSync(neoForgeVersionJsonPath, 'utf-8'))
        const installProfileJson = JSON.parse(fs.readFileSync(installProfileJsonPath, 'utf-8'))

        let downloadTasks = []

        //先检查version里
        for (let lib of neoForgeVersionJson.libraries.filter((lib) => checkOSRules(lib?.rules))) {
            downloadTasks.push({
                path: path.join(this.libPath, lib.downloads.artifact.path),
                url: lib.downloads.artifact.url,
                sha1: lib.downloads.artifact.sha1
            })
        }


        //检查installprofile
        for (let lib of installProfileJson.libraries.filter((lib) => checkOSRules(lib?.rules))) {
            downloadTasks.push({
                path: path.join(this.libPath, lib.downloads.artifact.path),
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

        return downloadTasks

    }
    existify(dir, recursive = true) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: recursive })
        }
        return dir
    }
}
