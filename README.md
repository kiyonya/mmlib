## Mia Minecraft Lib
基于Nodejs的Minecraft下载和启动库

![github](https://img.shields.io/badge/github-kiyuu-brightgreen.svg)  ![License](https://img.shields.io/badge/License-MIT-red.svg)


### 这是什么？
这是一个允许在Nodejs环境下载Minecraft，安装模组加载器以及生成脚本启动游戏的库，我给它起名叫做 **MML** (Mia Minecraft Lib)


当然这个库还存在很多未完成的地方(づ′▽`)づ，目前的模组加载器仅支持**Forge（包括LegacyForge），Fabric和NeoForge** 附属安装仅支持**FabricAPI**

---

里面的代码存在很多判断，有些地方会有好多嵌套以及奇奇怪怪的命名（~~会改的~~）虽然做了调试但是面对复杂的版本还可能会有些奇奇怪怪的bug造成无法安装或者无法启动，如果你想使用Nodejs编写一个Minecraft Java版启动器的话**请务必注意！**

> 仓库代码可能会更新很慢，一个人写效率太低啦_(:3 」∠ )_

**这个仓库的代码还在更新**


### 为什么要做这样的一个库?
实话实说，Minecraft这个游戏咱已经玩了十多年了，但是从来没有研究过这个游戏是如何启动的，启动器真的帮忙做了好多工作（伟大）所以我决定尝试用Nodejs来试着写一写Minecraft是如何安装和启动的。

至于为什么使用Nodejs，因为我想如果我真的弄明白的话，我可以用套壳浏览器开发一个启动器也说不定呢~

~~电脑可能会多一个浏览器~~

### 如何使用?
详见代码仓库的**demo.js**,这里只做简单的演示

**注意**
- java字段填入的是java.exe的路径，一般是java/bin/java.exe 高版本对jre的兼容很差推荐使用jdk 低版本请使用java8（使用高版本java无法启动）

#### 安装游戏

创建游戏安装器实例然后等待安装完成即可（如果没有问题的话

```javascript
    import InstallMinecraft from './core/Main/Install.js'

    //安装配置
    const installOptions = {
        //游戏版本号，版本列表可以访问 https://piston-meta.mojang.com/mc/game/version_manifest.json
        //例如 1.20.1 或者 1.7.10
        version:String
        //minecraft路径 一般是.minecraft文件夹
        minecraftPath:String,
        //版本文件夹一般是 .minecraft/versions/版本名
        versionPath:String,
        //版本名 不能有空格
        name:String,
        //客户端还是服务端 client 或者 server
        side:"client" | "server",
        //游戏java路径
        //如果不填会自动在.minecraft/java下查找对应版本
        //如果找不到版本会自动下载java（来自清华园）
        java:String
        //模组加载器 不写视作没有
        modLoader:null | {
            loader:'forge' | 'fabric' | 'neoforge',
            //加载器版本
            //LegacyForge需要写完整的名字 结构是xx.xx.x.xxxx-游戏版本
            version:String
        },
        //不填视作没有 有些不兼容的情况需要排除
        addition:null | {
            //设置fabricAPI的版本
            fabricApi:String
        }
    }
    const installer = new InstallMinecraft(installOptions)
    // 返回Promise<void>
    await installer.install()   
```

#### 启动游戏

启动游戏前会进行一次文件检查 并且补全缺失的文件 启动时会在版本目录生成launch.bat的启动脚本 

``` javascript

    import LaunchMinecraft from './core/Main/Launch.js'

    const launchOptions = {
        //游戏运行的java路径 不填会自动下载
        java:String,
        //游戏目录
        minecraftPath:String,
        //版本目录
        versionPath:String,
        //端 client 或者 server,
        side:'client' | 'server',
        //游戏名 不能有空格
        name:String
    }

    const launcher = new LaunchMinecraft(launchOptions)

    //可以通过链式调用设置内存分配
    launcher.setJvmMaxMemory(8192).setJvmMinMemory(256)

    //可以监听游戏的事件
    launcher.on('crash | close',callback)

    //返回Node的子进程
    const childProcess = await launcher.launch({
        //玩家uuid
        uuid:String,
        //玩家名字
        username:String,
        //mojang给的Token
        accessToken:String
    })

```

### 其他

本仓库基于 **MIT** 协议开源
如果您能帮助我找到一些bug的话，还请在 **issue** 提出，非常感谢

如果这些代码对您有帮助就太好了，感谢您看到这里(●´ω｀●)ゞ

