import path from 'path'
import InstallMinecraft from './core/Main/Install.js'
import LaunchMinecraft from './core/Main/Launch.js'
import { randomUUID } from 'crypto'

const data = {
    version: '1.20.1',
    versionPath: path.resolve('.minecraft/versions/1.20.1-forge-47.4.4'),
    minecraftPath: path.resolve('.minecraft'),
    name: '1.20.4-forge-47.4.4',
    side: 'client',
    modLoader: [
        {loader: 'forge',
        version: '47.4.4'}
    ],
    //附加内容
    // addition: {
    //     fabricApi: '0.92.6'
    // },
    //如果不填java的话会自动下载
    //java: path.resolve('.minecraft/java/8/jre/bin/java.exe')
}

async function launchGame() {
    //这是一个启动例子
    const launcher = new LaunchMinecraft(data)
    
    await launcher.setJvmMaxMemory(8192).setJvmMinMemory(256).launch({
        username: 'Steve',
        uuid: randomUUID().replaceAll('-', ''),
        accessToken: 'FFFFFF'
    })

    launcher.on('close', () => {
        console.log('游戏关闭')
    })

    launcher.on('crash', (reason) => {
        console.log('游戏崩溃')
    })

}

//安装实例
async function install() {
    const installer = new InstallMinecraft(data)
    await installer.install()
}

//从整合包安装实例
async function installPack() {

    const installer = new InstallMinecraft(data)
    //你的整合包文件路径
    //这部分尚未完成

    installer.installFromModPack('你的整合包路径')
}

//基本都是Promise驱动
//十分甚至九分的易用
install().then(launchGame)