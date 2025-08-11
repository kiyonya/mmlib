import EventEmitter from "events";
import path from "path";
import fs from 'fs'
import DependenceChecker from "../Launcher/DependenceChecker.js";
import { Downloader, DownloadTask } from "../Downloader/Downloader.js";
import MinecraftClientLauncher from "../Launcher/MinecraftClientLauncher.js";
import JavaInstaller from "../Installer/JavaInstaller.js";
import ClientProcessMonitor from "../Monitor/ClientProcessMonitor.js";
import treeKill from "tree-kill";

export default class LaunchMinecraft extends EventEmitter {
    constructor({ minecraftPath, versionPath, side, name, java }) {
        super()
        this.minecraftPath = minecraftPath
        this.versionPath = versionPath

        this.libPath = path.join(minecraftPath, 'libraries')

        this.assetsPath = path.join(minecraftPath, 'assets')
        this.assetIndexesPath = path.join(minecraftPath, 'assets', 'indexes')
        this.assetObjectsPath = path.join(minecraftPath, 'assets', 'objects')

        this.versionJsonPath = path.join(versionPath, `${name}.json`)
        this.minecraftJarPath = path.join(versionPath, `${name}.jar`)

        this.side = side
        this.name = name

        this.java = java

        this.minecraftProcess = null

        this.launchOptions = {
            maxJvmMemory:8192,
            minJvmMemory:256,
        }
    }
    async launch({ username, uuid, accessToken }) {

        //检查版本json
        if (!fs.existsSync(this.versionJsonPath)) {
            return null
        }

        const versionJson = JSON.parse(fs.readFileSync(this.versionJsonPath, 'utf-8'))

        console.log('喵！正在努力检查每个文件喵，请稍等喵(｀・ω・´)')

        //检查兼容性
        const dependenceChecker = new DependenceChecker({
            versionPath: this.versionPath,
            assetsPath: this.assetsPath,
            libPath: this.libPath,
            versionJson: versionJson,
            minecraftJarPath: this.minecraftJarPath,
            side: this.side
        })

        const lostFiles = await dependenceChecker.checkDependenciesLose()

        if (lostFiles?.length) {
            const downloader = new Downloader(15)

            for (let lostFile of lostFiles) {
                downloader.addTask(new DownloadTask(lostFile.url, lostFile.path, false, lostFile.sha1))
            }

            await downloader.start()
        }

        //检查java
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

        if (this.side === 'client') {

            console.log('正在为主人创建启动的实例喵')

            let clientLauncher = new MinecraftClientLauncher({
                minecraftJarPath: this.minecraftJarPath,
                java: this.java,
                libPath: this.libPath,
                assetsPath: this.assetsPath,
                versionJsonPath: this.versionJsonPath,
                versionPath: this.versionPath,
                minecraftJarPath: this.minecraftJarPath,
                name: this.name,
                customJVMArgs: [],
                launchOptions:this.launchOptions
            })

            console.log('正在为主人创建游戏喵')

            let clientGame = clientLauncher.runGame({ username, uuid, accessToken }, { resumeStdin: true })

            if (clientGame) {
                this.minecraftProcess = clientGame
                this.minecraftProcess.on('close', this.onGameClose.bind(this))
                this.minecraftProcess.stdout.on('data', this.onGameStdData.bind(this))
                this.minecraftProcess.stderr.on('error', this.onGameStdError.bind(this))
            }

            return clientGame

        }
    }

    onGameClose(code, signal) {
        if (code === 0) {
            console.log('游戏正常退出了喵~ 下次再来玩吧')
            this.emit('close',code,signal)
        }
        else {
            console.log('喵！！！游戏崩掉了喵 咱会找原因的喵')
            this.emit('crash',code,signal)
        }
        this.minecraftProcess = null
    }
    onGameStdError(error) {
        console.error(error)
    }
    onGameStdData(data) {
        console.log(data)
    }


    killProcess(){
        if(this.minecraftProcess){
            treeKill(this.minecraftProcess.pid,'SIGTERM')
        }
    }




    //设置
    setJvmMaxMemory(memory){
        if(typeof memory === 'number'){
            this.launchOptions.maxJvmMemory = memory
        }
        return this
    }
    setJvmMinMemory(memory){
        if(typeof memory === 'number'){
            this.launchOptions.minJvmMemory = memory
        }
        return this
    }

}

