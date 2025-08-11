
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import { checkOSRules, getJsonObjectFromUrl, mavenToPath } from '../utils/util.js';
export default class DependenceChecker {
    constructor({ versionJson, versionPath, assetsPath, libPath, minecraftJarPath, side }) {
        this.side = side
        this.versionpath = versionPath
        this.assetsPath = assetsPath
        this.libPath = libPath
        this.minecraftJarPath = minecraftJarPath
        this.assetsIndexesPath = path.join(this.assetsPath, 'indexes')
        this.assetsObjectsPath = path.join(this.assetsPath, 'objects')
        this.versionJson = versionJson
        let osMap = {
            win32: 'windows',
            darwin: 'osx',
            linux: 'linux'
        }
        this.systemType = osMap[os.platform()]
        this.systemTypeWithArch = `${osMap[os.platform()]}-${os.arch()}`
    }
    async checkDependenciesLose() {

        const checkTasks = []

        let requiredLib = this.versionJson.libraries.filter(lib => {
            return checkOSRules(lib?.rules)
        })

        for (let lib of requiredLib) {
            if (lib.name && !lib.downloads.classifiers) {
                //从name解析而不是看path
                let libfile = path.join(this.libPath, mavenToPath(lib.name))
                let sha1 = lib.downloads.artifact.sha1
                checkTasks.push({
                    path: libfile,
                    url: lib.downloads.artifact?.url || null,
                    sha1: sha1 || null
                })
            }
            //native库的情况检查 
            if (lib.downloads.classifiers) {
                let nativeIndexMap = lib?.natives[this.systemType] || lib?.natives[this.systemTypeWithArch]
                if (nativeIndexMap) {
                    let nativeLib = lib.downloads.classifiers[nativeIndexMap]
                    if (nativeLib) {
                        let sha1 = nativeLib?.sha1
                        //要处理体系架构的问题
                        let file = path.join(this.libPath, nativeLib?.path)
                        checkTasks.push({
                            path: file,
                            url: nativeLib?.url,
                            sha1: sha1
                        })
                    }
                }
            }
        }

        //检查是否有assets
        let assetJson = null
        let assetIndexJsonPath = path.join(this.assetsIndexesPath, this.versionJson.assets + '.json')
        let isAssetIndexJsonExist = fs.existsSync(assetIndexJsonPath)
        if (!isAssetIndexJsonExist) {
            //不存在 尝试重新下载
            const assetJsonUrl = this.versionJson.assetIndex.url
            assetJson = await getJsonObjectFromUrl(assetJsonUrl)
            fs.writeFileSync(assetIndexJsonPath, JSON.stringify(assetJson), 'utf-8')
        }
        else {
            assetJson = JSON.parse(fs.readFileSync(assetIndexJsonPath, 'utf-8'))
        }
        //检查Objects
        for (let asset of Object.values(assetJson.objects)) {
            let hash = asset.hash
            let assetStaticPath = path.join(this.assetsObjectsPath, hash.slice(0, 2), hash)
            let assetStaticURL = `https://resources.download.minecraft.net/${hash.slice(0, 2)}/${hash}`;
            checkTasks.push({
                path: assetStaticPath,
                url: assetStaticURL,
                sha1: hash
            })
        }
        //检查jar
        checkTasks.push({
            path: this.minecraftJarPath,
            url: this.versionJson.downloads[this.side].url,
            sha1: this.versionJson.downloads[this.side].sha1
        })
        let loses = []
        for (let check of checkTasks) {
            const ok = await this.isFileVaild(check?.path, check?.sha1)
            if (!ok) {
                if (!check.url) {
                    throw new Error('无法补全缺失文件', check.path)
                }
                else {
                    loses.push(check)
                }

            }
        }
        return loses
    }
    async isFileVaild(filepath, sha1) {
        if (!fs.existsSync(filepath)) {
            return false
        }
        if (!sha1) { return true }
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha1');
            const stream = fs.createReadStream(filepath);
            stream.on('data', (chunk) => {
                hash.update(chunk);
            });
            stream.on('end', () => {
                const fileHash = hash.digest('hex');
                resolve(fileHash === sha1);
            });
            stream.on('error', (err) => {
                resolve(false);
            });
        });
    }
}