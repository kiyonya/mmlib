import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { DownloadTask } from '../Downloader/Downloader.js'
import { mavenToPath } from '../utils/util.js'
export default class LiteloaderCollector {
    constructor({ version, liteloaderVersion, versionPath,libPath, side }) {
        this.liteloaderVersion = liteloaderVersion
        this.version = version
        this.versionPath = versionPath
        this.libPath = libPath
    }
    async collect() {
        //下载liteloader
        const liteloaderInstallerURL = `https://dl.liteloader.com/redist/${this.version}/liteloader-installer-${this.liteloaderVersion}.jar`

        let liteloaderInstallDir = this.existify(path.join(this.versionPath, 'liteloader'))
        let liteloaderInstallerPath = path.join(liteloaderInstallDir, 'liteloader.jar')

        let unpackDir = this.existify(liteloaderInstallDir, 'unpack')

        const liteloaderDownloadTask = new DownloadTask(liteloaderInstallerURL, liteloaderInstallerPath, false, undefined)

        await liteloaderDownloadTask.start()

        const installerJar = new AdmZip(liteloaderInstallerPath)
        installerJar.extractAllTo(unpackDir)

        const installProfileJsonPath = path.join(unpackDir, 'install_profile.json')
        if (!fs.existsSync(installProfileJsonPath)) {
            throw new Error('无效liteloader安装文件')
        }

        let installProfile = this.liteloaderJsonFix(fs.readFileSync(installProfileJsonPath, 'utf-8'))

        if(installProfile){
            fs.writeFileSync(installProfileJsonPath,JSON.stringify(installProfile,null,4))

            let downloadTasks = []

            console.log(installProfile)

            for(let lib of installProfile?.versionInfo.libraries){
                console.log(lib.name)
                let filepath = path.join(this.libPath,mavenToPath(lib.name))
                let downloadURL = ''
                if(lib.url){
                    downloadURL = (lib.url + mavenToPath(lib.name)).replaceAll('\\','/')
                }
                else{
                    downloadURL = ('https://libraries.minecraft.net/' + mavenToPath(lib.name)).replaceAll('\\','/')
                }

                downloadTasks.push({
                    url:downloadURL,
                    path:filepath,
                    sha1:null
                })
            }

            return downloadTasks
        }
        else{
        throw new Error('错误的liteloaderInstallProfile 无法修复的json')
     }
    }
    existify(dir, recursive = true) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: recursive })
        }
        return dir
    }
    liteloaderJsonFix(jsonString) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            const fixedTrailingCommas = jsonString.replace(/,\s*([}\]])/g, '$1');
            try {
                return JSON.parse(fixedTrailingCommas);
            } catch (secondError) {
                console.error('无法修复 JSON:', secondError);
                return null;
            }
        }
    }
}