import { EventEmitter } from 'events'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { checkOSRules, dedupeLibs, mavenToPath } from '../utils/util.js'
import { execFile, spawn } from 'child_process'
import AdmZip from 'adm-zip'
import iconv from 'iconv-lite'

export default class MinecraftClientLauncher extends EventEmitter {
  constructor({ minecraftPath, java, versionPath, libPath, assetsPath, versionJsonPath, minecraftJarPath, name, customJVMArgs = [], launchOptions = {} }) {
    super()
    this.minecraftPath = minecraftPath
    this.versionJsonPath = versionJsonPath
    this.versionPath = versionPath
    this.gameDir = versionPath
    this.nativesPath = this.existify(path.join(versionPath, `${name}-natives`))
    this.libPath = libPath
    this.assetsPath = assetsPath
    this.log4jPath = path.join(versionPath, 'log4j')
    this.minecraftJarPath = minecraftJarPath
    this.java = java
    this.osVersion = os.release()
    this.isWindows = os.platform() === 'win32'
    this.minecraftProcess = null
    this.customJVMArgs = customJVMArgs?.length ? customJVMArgs : null
    this.name = name
    this.Xmx = 4096
    this.Xmn = 1024
      ; ((this.windowWidth = 1000), (this.windowHeight = 750))
    let osMap = {
      win32: 'windows',
      darwin: 'osx',
      linux: 'linux'
    }
    this.systemType = osMap[os.platform()]
    this.systemTypeWithArch = `${osMap[os.platform()]}-${os.arch()}`

    this.launchOptions = launchOptions
  }

  static DEFAULT_JVM_ARGS = [

    '-Dfile.encoding=UTF-8',
    '-Dstderr.encoding=UTF-8',
    '-Dstdout.encoding=UTF-8',
    '-XX:+UseG1GC',
    '-XX:-UseAdaptiveSizePolicy',
    '-XX:-OmitStackTraceInFastThrow',
    '-Djava.library.path=${natives_directory}',
    '-Dorg.lwjgl.system.SharedLibraryExtractPath=${natives_directory}'

  ]

  static DEFAULT_GAME_ARGS = [
    '--username',
    '${auth_player_name}',
    '--version',
    '${version_name}',
    '--gameDir',
    '${game_directory}',
    '--assetsDir',
    '${assets_root}',
    '--assetIndex',
    '${assets_index_name}',
    '--uuid',
    '${auth_uuid}',
    '--accessToken',
    '${auth_access_token}',
    '--userType',
    '${user_type}',
    '--versionType',
    '${version_type}'
  ]

  buildLaunchCommand({ username, uuid, accessToken }, { splitClassPath = false }) {
    const versionJson = JSON.parse(fs.readFileSync(this.versionJsonPath, 'utf-8'))

    //纯库
    let requiredLib = dedupeLibs(
      versionJson.libraries.filter((lib) => lib.name && !lib?.downloads?.classifiers && checkOSRules(lib?.rules))
    )

    //native库
    const nativeJars = this.extractNatives(versionJson.libraries)

    let gameLaunchArguments = {}

    gameLaunchArguments.jvm = [...MinecraftClientLauncher.DEFAULT_JVM_ARGS, ...(versionJson?.arguments?.jvm || [])]
    gameLaunchArguments.game = versionJson.arguments?.game || versionJson?.minecraftArguments?.split(' ') || MinecraftClientLauncher.DEFAULT_GAME_ARGS



    if (this.launchOptions.windowWidth) {
      gameLaunchArguments.game.push('--width', this.launchOptions.windowWidth)
    }
    if (this.launchOptions.windowHeight) {
      gameLaunchArguments.game.push('--width', this.launchOptions.windowHeight)
    }
    if (this.launchOptions.isDemo) {
      gameLaunchArguments.game.push('--demo')
    }


    let classPaths = [
      ...requiredLib.map((i) => path.join(this.libPath, mavenToPath(i.name))),
      ...nativeJars,
      this.minecraftJarPath
    ]

    classPaths = [...new Set(classPaths)]
    const argumentMap = new Map()


    argumentMap.set('natives_directory', `"${this.nativesPath}"`)
    argumentMap.set('launcher_name', 'MML')
    argumentMap.set('launcher_version', '0.0.5')

    if (!splitClassPath) {
      argumentMap.set('classpath', `"${classPaths.join(this.isWindows ? ';' : ':')}"`)
    }
    else {
      argumentMap.set('classpath', `"${classPaths.join('@@@')}"`)
    }

    argumentMap.set('library_directory', `"${this.libPath}"`)
    argumentMap.set('classpath_separator', this.isWindows ? ';' : ':')
    argumentMap.set('auth_player_name', username)
    argumentMap.set('version_name', this.name)
    argumentMap.set('game_directory', `"${this.gameDir}"`)
    argumentMap.set('assets_index_name', versionJson.assets)
    argumentMap.set('assets_root', `"${this.assetsPath}"`)
    argumentMap.set('game_assets', `"${this.assetsPath}"`)
    argumentMap.set('auth_uuid', uuid)
    argumentMap.set('auth_access_token', accessToken)
    argumentMap.set('clientid', '${clientid}')
    argumentMap.set('user_type', 'msa')
    argumentMap.set('version_type', 'Mia-Minecraft-Launcher')
    argumentMap.set('user_properties','{}')


    if (!gameLaunchArguments.jvm.includes('-cp')) {
      gameLaunchArguments.jvm.push('-cp')
      gameLaunchArguments.jvm.push('${classpath}')
    }

    //JVM
    let jvmArgs = this.customJVMArgs || [
      `-Xmx${this.launchOptions?.maxJvmMemory || 4096}m`,
      `-Xmn${this.launchOptions?.minJvmMemory || 256}m`
    ]

    for (let i = 0; i < gameLaunchArguments.jvm?.length; i++) {
      let value = gameLaunchArguments.jvm[i]
      if (typeof value === 'object') {
        const isPass = checkOSRules(value?.rules)
        if (isPass) {
          if (Array.isArray(value.value)) {
            jvmArgs.push(...value.value)
          } else {
            jvmArgs.push(value.value)
          }
        }
      } else {
        //处理-p下面的情况
        //修复forge -p替换以后路径错误的问题 不过影响不大
        if (value === '-p') {
          jvmArgs.push('-p')
          let param = gameLaunchArguments.jvm[i + 1]
          const paramSplitedArray = param.split('${classpath_separator}')
          let modulePathes = []
          for (let modulePath of paramSplitedArray) {
            modulePath = modulePath.replace('${library_directory}', '')
            modulePath = path.join(this.libPath, modulePath)
            modulePathes.push(modulePath)
          }
          jvmArgs.push(`"${modulePathes.join(argumentMap.get('classpath_separator'))}"`)
          //跳过下一个
          i++
        } else {
          const replacement = this.replaceTemplateVariables(value, argumentMap)
          jvmArgs.push(replacement)
        }
      }
    }


    jvmArgs = jvmArgs.map((i) => i.replaceAll(' ', ''))

    //Game
    let gameArgs = []
    for (let arg of gameLaunchArguments.game) {
      if (typeof arg === 'object') {
        continue
      }
      gameArgs.push(this.replaceTemplateVariables(arg, argumentMap))
    }

    let mainClass = versionJson.mainClass


    return { java: this.java, jvmArgs, mainClass, gameArgs }
  }

  runGame({ username, uuid, accessToken }, { resumeStdin = true }) {
    if (this.minecraftProcess) {
      return
    }

    resumeStdin && process.stdin.resume()



    const { java, gameArgs, jvmArgs, mainClass } = this.buildLaunchCommand({ username, uuid, accessToken }, {
      splitClassPath: false
    });

    let command = `"${java}" ${jvmArgs.join(' ')} ${mainClass} ${gameArgs.join(' ')}`

    let gbkBuffer = iconv.encode(command, 'gbk')
    const cmdFile = path.join(this.versionPath, 'launch.bat')
    fs.writeFileSync(cmdFile, gbkBuffer)

    this.minecraftProcess = execFile(cmdFile, {
      shell: true,

    });

    return this.minecraftProcess
  }

  killGame() {
    if (!this.minecraftProcess) {
      return
    }
    this.minecraftProcess.kill('SIGTERM')
    this.minecraftProcess = null

  }

  forceKillGame() {
    if (!this.minecraftProcess) {
      return
    }
    this.minecraftProcess.kill('SIGKILL')
    this.minecraftProcess = null
  }


  setJVMMaxMemory(Xmx) {
    this.Xmx = Xmx
    return this
  }
  setJVMMinMenory(Xmn) {
    this.Xmn = Xmn
    return this
  }
  setWindowWidth(width) {
    this.windowWidth = width
    return this
  }
  setWindowHeight(height) {
    this.windowHeight = height
    return this
  }






  existify(dir, recursive = true) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: recursive })
    }
    return dir
  }
  replaceTemplateVariables(str, variables) {
    if (!str.includes('${')) {
      return str
    }
    return str.replace(/\$\{(\w+)\}/g, (match, key) => {
      return variables.has(key) ? variables.get(key) : match
    })
  }
  extractNatives(libraries) {
    let nativesJarLibs = []
    let nativesFiles = libraries
      .filter((lib) => checkOSRules(lib?.rules))
      .filter((i) => i.downloads?.classifiers)

    for (let lib of nativesFiles) {

      const nativesMap = lib.downloads.classifiers
      
      for (let native of Object.values(nativesMap)) {
        if (native.path) {
          let libNativeJarPath = path.join(this.libPath, native.path)
          if (fs.existsSync(libNativeJarPath)) {
            nativesJarLibs.push(libNativeJarPath)
            const nativeJar = new AdmZip(libNativeJarPath)
            const jarEntries = nativeJar.getEntries()
            const dllEntries = jarEntries.filter((entry) =>
              entry.entryName.toLowerCase().endsWith('.dll')
            )
            if (dllEntries.length) {
              dllEntries.forEach((entry) => {


                const fileName = path.basename(entry.entryName)
                const outputPath = path.join(this.nativesPath, fileName)
                const fileData = nativeJar.readFile(entry)
                fs.writeFileSync(outputPath, fileData)
                console.log(`抽取Natives: ${fileName}`)

              })
            }
          }
        }
      }
    }
    return nativesJarLibs
  }
}
