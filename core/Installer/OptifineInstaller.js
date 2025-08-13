import path from 'path'
import fs from 'fs'
import AdmZip from 'adm-zip'
import CommandExec from '../Ps/CommandExec.js'
export default class OptifineInstaller {

    constructor({ version, optifinePatch, optifineType, versionPath, java, libPath, minecraftJarPath,isOldMinecraftGameArgumentsFormat }) {
        this.version = version
        this.optifinePatch = optifinePatch
        this.optifineType = optifineType || 'HD_U'
        this.versionPath = versionPath
        this.libPath = libPath
        this.java = java
        this.minecraftJarPath = minecraftJarPath
        this.isOldMinecraftGameArgumentsFormat = isOldMinecraftGameArgumentsFormat

        const isPreview = this.optifinePatch.includes('pre')

        this.libOptifineId = `${this.version}_${this.optifineType}_${this.optifinePatch}`

        this.optifineFileName = `OptiFine-${this.version}_${this.optifineType}_${this.optifinePatch}.jar`

        this.optifineInstallDir = path.join(versionPath, 'optifine')

        this.optifineInstallerPath = path.join(this.optifineInstallDir, this.optifineFileName)
    }

    async install() {
        console.warn('%c准备构建Optifine 这一步会修改你的游戏jar','color:orange')

        if (!fs.existsSync(this.optifineInstallerPath)) {
            throw new Error('找不到Optifine安装器')
        }

        const unpack = this.existify(path.join(this.optifineInstallDir, 'unpack'))

        const installerJar = new AdmZip(this.optifineInstallerPath)
        installerJar.extractAllTo(unpack)


        const launchWrapperOf = path.join(unpack, 'launchwrapper-of.txt')

        let launchWrapperVersion ='1.12'
        if (fs.existsSync(launchWrapperOf)) {
            launchWrapperVersion = fs.readFileSync(launchWrapperOf, 'utf-8')
        }

        console.log(`%c已找到可用的optifine启动套组版本：${launchWrapperVersion}`,"color:skyblue")

        const launchWrapperOfJar = path.join(unpack, `launchwrapper-of-${launchWrapperVersion}.jar`)

        if (!fs.existsSync(launchWrapperOfJar)) {
            throw new Error('没有可以的launchwrapper')
        }

        let libOptifine = this.existify(path.join(this.libPath, 'optifine'))

        let libLaunchWrapper = this.existify(path.join(libOptifine, 'launchwrapper-of', String(launchWrapperVersion)))
        const libLaunchWrapperJar = path.join(libLaunchWrapper, `launchwrapper-of-${launchWrapperVersion}.jar`)

        fs.copyFileSync(launchWrapperOfJar, libLaunchWrapperJar)

        const libOptifinePatch = this.existify(path.join(libOptifine, 'Optifine', this.libOptifineId))

        let libOptifineJar = path.join(libOptifinePatch, this.optifineFileName)

        console.log(`%c构建Optifine中——————`,"color:skyblue")
        //构建
        const output = await CommandExec.executeArguments(this.java,
            [
                '-cp',
                this.optifineInstallerPath,
                'optifine.Patcher',
                this.minecraftJarPath,
                this.optifineInstallerPath,
                libOptifineJar
            ],
            {
                redirectOutput:'false',
            }
        )
        if(output.exitCode === 0){
            console.log(output.output)
            console.log('optifine构建完成')

            const buildJson = {
                libraries:[
                    {
                        name:'optifine:OptiFine:' + this.libOptifineId
                    },
                    {
                        name:launchWrapperVersion === '1.12' ? 'net.minecraft:launchwrapper:1.12' : `optifine:launchwrapper-of:${launchWrapperVersion}`
                    }
                ],
                mainClass:'net.minecraft.launchwrapper.Launch'
            }

            if(this.isOldMinecraftGameArgumentsFormat){
                buildJson.minecraftArguments = `--tweakClass optifine.OptiFineTweaker`
            }
            else{
                buildJson.arguments = {}
                buildJson.arguments.game = [
                    '--tweakClass',
                    'optifine.OptiFineTweaker'
                ]
            }
            
            this.clear()
            return buildJson
        }
        else{
            this.clear()
            throw new Error('optifine build failed with',output.error)
        }
    }
    existify(dir, recursive = true) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: recursive })
        }
        return dir
    }
    clear() {
        if(fs.existsSync(this.optifineInstallDir)){
            fs.rmSync(this.optifineInstallDir,{force:true,recursive:true,retryDelay:100})
        }
    }
}