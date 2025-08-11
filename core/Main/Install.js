import fs from 'fs'
import path from 'path'
import { Downloader, DownloadTask } from '../Downloader/Downloader.js';
import ForgeCollector from '../Collector/ForgeCollector.js';
import ForgeInstaller from '../Installer/ForgeInstaller.js';
import LegacyForgeInstaller from '../Installer/LegacyForgeInstaller.js';
import { EventEmitter } from 'events';
import { getDownloadFileName, getJsonObjectFromUrl } from '../utils/util.js';
import MinecraftCollector from '../Collector/MinecraftCollector.js';
import Mirror from '../utils/Mirror.js';
import NeoForgeCollector from '../Collector/NeoForgeCollector.js';
import NeoForgeInstaller from '../Installer/NeoForgeInstaller.js';
import FabricCollector from '../Collector/FabricCollector.js';
import JavaInstaller from '../Installer/JavaInstaller.js';
import AdmZip from 'adm-zip'

export default class InstallMinecraft extends EventEmitter {
    constructor({ java, version, versionPath, minecraftPath, name, side, modLoader = {}, addition = {} }) {
        super()

        this.version = version
        this.versionPath = this.existify(versionPath)
        this.minecraftPath = minecraftPath
        this.name = name
        this.side = side || 'client'
        this.modLoader = modLoader
        this.addition = addition

        this.assetsPath = this.existify(path.join(minecraftPath, 'assets'))
        this.libPath = this.existify(path.join(minecraftPath, 'libraries'))

        this.minecraftJarPath = path.join(versionPath, `${name}.jar`)
        this.versionJsonPath = path.join(versionPath, `${name}.json`)

        this.java = java

        this.isLegacyForge = false

        this.downloader = new Downloader(15)
    }

    async install(extraDownloadTasks = []) {

        let versionJson = await this.getMinecraftVersionJson()

        let totalTasks = []

        const minecraftVanillaDownloads = await new MinecraftCollector({
            versionJson,
            versionPath: this.versionPath,
            assetsPath: this.assetsPath,
            libPath: this.libPath,
            name: this.name,
            side: this.side,
            minecraftJarPath: this.minecraftJarPath
        }).collect()
        totalTasks.push(...minecraftVanillaDownloads)

        if (this.modLoader?.loader && this.modLoader?.version) {
            let modloaderInstallCollector = null
            switch (this.modLoader.loader) {
                case 'forge':
                    modloaderInstallCollector = new ForgeCollector({
                        version: this.version,
                        forgeVersion: this.modLoader.version,
                        versionPath: this.versionPath,
                        libPath: this.libPath,
                        versionJson: versionJson,
                        mojmapsSha1: versionJson.downloads[`${this.side}_mappings`]?.sha1,
                        mojmapsURL: versionJson.downloads[`${this.side}_mappings`]?.url,
                        side: this.side
                    })
                    break
                case 'neoforge':
                    modloaderInstallCollector = new NeoForgeCollector({
                        version: this.version,
                        neoForgeVersion: this.modLoader.version,
                        versionPath: this.versionPath,
                        libPath: this.libPath,
                        versionJson: versionJson,
                        mojmapsSha1: versionJson.downloads[`${this.side}_mappings`]?.sha1,
                        mojmapsURL: versionJson.downloads[`${this.side}_mappings`]?.url,
                        side: this.side
                    })
                    break
                case 'fabric':
                    modloaderInstallCollector = new FabricCollector({
                        version: this.version,
                        fabricVersion: this.modLoader.version,
                        libPath: this.libPath,
                        //fabricapi由fabric收集器管辖
                        fabricApiVersion: this.addition?.fabricApi || null,
                        versionPath: this.versionPath
                    })
                    break
            }


            if (modloaderInstallCollector) {
                if (this.modLoader.loader === 'forge') {
                    const { isLegacyForge, downloadTasks } = await modloaderInstallCollector.collect()
                    totalTasks.push(...downloadTasks)
                    this.isLegacyForge = isLegacyForge
                }
                else {
                    const downloadTasks = await modloaderInstallCollector.collect()
                    console.log(downloadTasks)

                    totalTasks.push(...downloadTasks)
                }

            }
        }

        if (this.addition?.optifine) {

        }

        //是否有java
        if (!this.java || !fs.existsSync(this.java)) {

            let requireJavaVersion = versionJson?.javaVersion?.majorVersion || 8

            let installJavaPath = path.join(this.minecraftPath, 'java', String(requireJavaVersion))

            if (!fs.existsSync(path.join(installJavaPath, 'bin', 'java.exe'))) {

                console.log(`没找到java${requireJavaVersion}喵，别担心喵，咱去叼一个过来喵`)
                console.log('🐱=========>🍵')

                const javaInstaller = new JavaInstaller({
                    requireVersion: requireJavaVersion,
                    installPath: installJavaPath
                })

                const javaPath = await javaInstaller.install()
                console.log('已经给主人安装好了喵🐱🍵，感谢清华园提供的下载喵')
            }

            console.log('主人虽然没有指定java 但是喵在游戏目录里找到了可用的java喵 (*^▽^*)')

            this.java = path.join(installJavaPath, 'bin', 'java.exe')
        }

        for (let task of [...totalTasks, ...extraDownloadTasks].filter(i => i.url)) {
            this.downloader.addTask(new DownloadTask(Mirror.getMirroredUrl(task.url, 'bmcl'), task.path, false, task.sha1))
        }

        this.downloader.on('progress', (p) => {
            console.log(p)
        })

        await this.downloader.start()

        //下载后做的

        if (this.modLoader?.loader && this.modLoader?.version) {
            let modloaderInstaller = null
            switch (this.modLoader.loader) {
                case 'forge':
                    if (!this.isLegacyForge) {
                        modloaderInstaller = new ForgeInstaller({
                            java: this.java,
                            libPath: this.libPath,
                            side: this.side,
                            versionPath: this.versionPath,
                            minecraftJarPath: this.minecraftJarPath,
                        })
                    }
                    else {
                        modloaderInstaller = new LegacyForgeInstaller({
                            versionPath: this.versionPath,
                            libPath: this.libPath,
                            side: this.side
                        })
                    }
                    break
                case 'neoforge':
                    modloaderInstaller = new NeoForgeInstaller({
                        java: this.java,
                        libPath: this.libPath,
                        versionPath: this.versionPath,
                        side: this.side,
                        minecraftJarPath: this.minecraftJarPath
                    })
                    break
            }


            if (modloaderInstaller) {
                const extraJson = await modloaderInstaller.install()
                versionJson = this.combineVersionJson(versionJson, extraJson)
            }
        }

        fs.writeFileSync(this.versionJsonPath, JSON.stringify(versionJson, null, 4), 'utf-8')
    }

    async installFromModPack(modpackPath) {

        //判断整合包类型
        if (!fs.existsSync(modpackPath)) {
            return null
        }

        const modpack = new AdmZip(modpackPath)

        const modpackType = this.parserModpackType(modpackPath)


        let modPackDownloadTasks = []

        if (modpackType === 'modrinth') {

            const modrinthIndexJsonEntry = modpack.getEntry('modrinth.index.json')
            const modrinthIndexJson = JSON.parse(modpack.readAsText(modrinthIndexJsonEntry))

            const dependencies = modrinthIndexJson.dependencies

            if (dependencies.minecraft) {
                this.version = dependencies.minecraft
            }
            if (dependencies['forge']) {
                this.modLoader.loader = 'forge'
                this.modLoader.version = dependencies['forge']
            }
            else if (dependencies['fabric-loader']) {
                this.modLoader.loader = 'fabric'
                this.modLoader.version = dependencies['fabric-loader']
            }
            else if (dependencies['neoforge']) {
                this.modLoader.loader = 'neoforge'
                this.modLoader.version = dependencies['neoforge']
            }

            //dispatch
            this.extractZipFolder(modpack, 'overrides', this.versionPath)

            //统计下载文件
            for (let file of modrinthIndexJson?.files || []) {
                if (!file?.env || file.env[this.side] === 'required') {
                    let filepath = path.join(this.versionPath, file.path)
                    let sha1 = file.hashes.sha1
                    let url = file.downloads[0]
                    modPackDownloadTasks.push({
                        url,
                        path: filepath,
                        sha1
                    })
                }
            }

        }
        else if (modpackType === 'curseforge') {

            console.log('curseforge')
            1
            const curseforgeManifestJsonEntry = modpack.getEntry('manifest.json')
            const curseforgeManifestJson = JSON.parse(modpack.readAsText(curseforgeManifestJsonEntry))

            if (curseforgeManifestJson?.minecraft?.version) {
                this.version = curseforgeManifestJson?.minecraft?.version
            }
            if (curseforgeManifestJson?.minecraft?.modLoaders) {
                for (let loader of curseforgeManifestJson.minecraft?.modLoaders) {
                    let splited = loader?.id?.split('-')
                    if (splited.length < 2) {
                        throw new Error('Exception:无效的整合包版本读取 错误的加载器分割')
                    }

                    if (splited[0] === 'forge') {
                        this.modLoader.loader = 'forge',
                            this.modLoader.version = splited[1]
                    }
                    else if (splited[0] === 'fabric') {
                        this.modLoader.loader = 'fabric',
                            this.modLoader.version = splited[1]
                    }
                }
            }

            for (let mod of curseforgeManifestJson?.files.filter(i => i.required)) {
                let url = `https://www.curseforge.com/api/v1/mods/${mod.projectID}/files/${mod.fileID}/download`
                const filename = await getDownloadFileName(url)
                console.log(filename)
            }
            1
        }



        await this.install(modPackDownloadTasks)

        console.log('安装完成')

    }

    async getMinecraftVersionJson() {
        const indexJson = await getJsonObjectFromUrl('https://piston-meta.mojang.com/mc/game/version_manifest.json')
        const versionJsonIndex = indexJson.versions.filter(i => i.id === this.version)
        if (versionJsonIndex.length) {
            const url = versionJsonIndex?.[0]?.url
            const versionJson = await getJsonObjectFromUrl(url)
            return versionJson
        }
        else {
            return null
        }
    }

    existify(dir, recursive = true) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: recursive })
        }
        return dir
    }

    combineVersionJson(baseJson, extraJson) {
        const result = { ...baseJson };
        for (const [key, extraValue] of Object.entries(extraJson)) {
            if (extraValue === undefined || extraValue === null) {
                continue;
            }
            const baseValue = result[key];
            if (Array.isArray(extraValue)) {
                if (Array.isArray(baseValue)) {
                    result[key] = [...baseValue, ...extraValue];
                } else {
                    result[key] = baseValue !== undefined ? [baseValue, ...extraValue] : [...extraValue];
                }
            } else if (typeof extraValue === 'object' && extraValue !== null && !Array.isArray(extraValue)) {
                if (typeof baseValue === 'object' && baseValue !== null && !Array.isArray(baseValue)) {
                    result[key] = this.combineVersionJson(baseValue, extraValue);
                } else {
                    result[key] = { ...extraValue };
                }
            } else {
                result[key] = extraValue;
            }
        }
        return result;
    }


    parserModpackType(modpackPath) {
        const zip = new AdmZip(modpackPath)

        if (zip.getEntry('manifest.json')) {
            return 'curseforge'
        }
        else if (zip.getEntry('mmc-pack.json')) {
            return 'mmc'
        }
        else if (zip.getEntry('modrinth.index.json')) {
            return 'modrinth'
        }
        else {
            return 'unknown'
        }

    }

    extractZipFolder(zip, zipEntryPath, targetDir) {
        const normalizedEntryPath = zipEntryPath.endsWith('/') ? zipEntryPath : zipEntryPath + '/';
        const entries = zip.getEntries();
        entries.forEach(entry => {
            if (entry.entryName.startsWith(normalizedEntryPath)) {
                const relativePath = entry.entryName.slice(normalizedEntryPath.length);
                const fullPath = path.join(targetDir, relativePath);

                if (entry.isDirectory) {

                    fs.mkdirSync(fullPath, { recursive: true });
                } else {

                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    zip.extractEntryTo(entry, path.dirname(fullPath), false, true, path.basename(fullPath));
                }
            }
        });

        console.log(`解压完成: ${zipEntryPath} → ${targetDir}`);
    }
}