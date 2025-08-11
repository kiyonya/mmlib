import path from 'path'
import fs from 'fs'
import { mavenToPath } from '../utils/util.js'

export default class LegacyForgeInstaller {
    constructor({ versionPath, libPath, side }) {
        this.versionPath = versionPath
        this.libPath = libPath
        this.side = side
    }
    async install() {
        const installDir = path.join(this.versionPath, 'forge')
        const unpack = path.join(this.versionPath, 'forge', 'unpack')

        const installProfileJsonPath = path.join(unpack, 'install_profile.json')
        const installProfileJson = JSON.parse(fs.readFileSync(installProfileJsonPath), 'utf-8')

        let requireLibs = installProfileJson.versionInfo.libraries

        const libraries = []

        for (let lib of requireLibs) {
            let pathLike = mavenToPath(lib?.name)

            if (lib?.name?.startsWith('net.minecraftforge:forge')) {

                let baseDir = this.existify(path.join(this.libPath, path.dirname(pathLike)))

                let universalDestPath = path.join(baseDir, installProfileJson.install.filePath.replaceAll('-universal',''))

                let universalUnpackPath = path.join(unpack, installProfileJson.install.filePath)


                if (!fs.existsSync(universalDestPath)) {
                    fs.copyFileSync(universalUnpackPath, universalDestPath)
                }

                let mavenBase = path.dirname(pathLike)


                let url = lib.url + mavenBase + '/' + installProfileJson.install.filePath

                libraries.push({
                    "downloads": {
                        "artifact": {
                            "path": path.join(mavenBase, installProfileJson.install.filePath.replaceAll('-universal','')),
                            "sha1": '',
                            "size": '',
                            "url": url
                        }
                    },
                    "name": lib.name
                },)
            }
            else {

                let libmeta = {}

                //补全artifact

                //字段只加不减
                //name字段和serverreq都保留之前的
                //加入url是为了方便补全和统一

                if(lib.url){
                    libmeta.downloads = {
                        "artifact": {
                            "path": pathLike,
                            "sha1": lib?.chucksums?.[0] || '',
                            "size": '',
                            "url": lib.url + pathLike
                        }
                    }
                }
                else{
                    libmeta.downloads = {
                        "artifact": {
                            "path": pathLike,
                            "sha1": lib?.chucksums?.[0] || '',
                            "size": '',
                            "url": 'https://libraries.minecraft.net/' + pathLike
                        }
                    }
                }

                libmeta.name = lib?.name
                if(lib.serverreq){
                    libmeta.serverreq = lib.serverreq
                }
                if(lib.clientreq){
                    libmeta.clientreq = lib.clientreq
                }

                libraries.push(libmeta)
            }
        }


        for(let lib of libraries){
            lib.downloads.artifact.url = lib.downloads.artifact.url.replaceAll('\\','/')
        }


        installProfileJson.versionInfo.libraries = libraries

        try {
            fs.rmSync(installDir,{ recursive: true, force: true })
        } catch (error) {
            
        }
        
        return installProfileJson.versionInfo

    }
    existify(dir, recursive = true) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: recursive })
        }
        return dir
    }
}