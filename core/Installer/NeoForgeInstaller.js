import AdmZip from 'adm-zip'
import path from 'path'
import fs from 'fs'
import { argsArrayToObject, isMavenLikePath, mavenToPath } from '../utils/util.js'
import { exec } from 'child_process'
import os from 'os'
import CommandExec from '../Ps/CommandExec.js'
export default class NeoForgeInstaller {
  constructor({
    java,
    libPath,
    versionPath,
    side,
    minecraftJarPath,
  }) {
    this.side = side
    this.java = java
    this.libPath = libPath
    this.versionPath = versionPath
    this.minecraftJarPath = minecraftJarPath
    this.isWindows = os.platform() === 'win32'
  }

  async install() {

    let neoForgeInstallDir = this.existify(path.join(this.versionPath, 'neoForge'))
    let installerPath = path.join(neoForgeInstallDir, 'installer.jar')
    let unpack = this.existify(path.join(neoForgeInstallDir, 'unpack'))


    const installProfileJsonPath = path.join(unpack, 'install_profile.json')
    const neoForgeVersionJsonPath = path.join(unpack, 'version.json')


    const neoForgeVersionJson = JSON.parse(fs.readFileSync(neoForgeVersionJsonPath, 'utf-8'))
    const installProfileJson = JSON.parse(fs.readFileSync(installProfileJsonPath, 'utf-8'))



    const requireProcessors = installProfileJson.processors.filter((i) => {
      if (i?.args?.includes('DOWNLOAD_MOJMAPS')) {
        return false
      }
      else if ((this.side === 'client' && !i?.sides) || i?.sides?.includes(this.side)) {
        return true
      }
      return false
    })


    //映射表

    const dataMap = new Map()
    for (let dataKey of Object.keys(installProfileJson.data)) {
      let dataValue = installProfileJson.data[dataKey][this.side]
      if (dataKey === 'BINPATCH') {
        dataValue = path.join(unpack, dataValue)
      }
      dataMap.set(dataKey, dataValue)
    }


    dataMap.set('MINECRAFT_JAR', this.minecraftJarPath)
    dataMap.set('ROOT', this.versionPath)
    dataMap.set('INSTALLER', installerPath)
    dataMap.set('SIDE', this.side)


    for (let processors of requireProcessors) {
      let mainJar = path.join(this.libPath, mavenToPath(processors.jar))
      let mainClass = await this.findMainClass(mainJar)

      let classpath = processors.classpath.map((lib) => path.join(this.libPath, mavenToPath(lib)))

      let args = argsArrayToObject(processors.args)

      //替换args
      for (let [argKey, argValue] of Object.entries(args)) {
        if (typeof argValue === 'string' && argValue.startsWith('{') && argValue.endsWith('}')) {
          const index = argValue.replace(/^{(.*)}$/, '$1')
          let replaceValue = dataMap.get(index)
          if (!replaceValue) {
            //判断是不是路径
            if (argValue.startsWith('/') || argValue.startsWith('\\')) {
              args[argKey] = path.join(unpack, argValue)
              continue
            }
          }
          if (isMavenLikePath(replaceValue)) {
            replaceValue = path.join(this.libPath, mavenToPath(replaceValue))
          }
          args[argKey] = replaceValue
        } else if (isMavenLikePath(argValue)) {
          args[argKey] = path.join(this.libPath, mavenToPath(argValue))
        }
      }

      classpath = [...classpath, mainJar]


      let argsArray = []
      for (let [argKey, argValue] of Object.entries(args)) {
        argsArray.push(`${argKey} "${argValue}"`)
      }

      let argsString = argsArray.join(' ')


      //bat结构 java -cp mainclass args
      let commandLine = `"${this.java}" -cp "${classpath.join(this.isWindows ? ';' : ':')}" ${mainClass} ${argsString}`

      const output = await CommandExec.executeCommand(commandLine)

      if (output.error) {
        throw new Error('neoforge install error' + error)
      }
      else {
        console.log(output.output)
      }
    }


    try {
      fs.rmSync(neoForgeInstallDir, { recursive: true, force: true })
    } catch (e) { }


    return neoForgeVersionJson
  }
  existify(dir, recursive = true) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: recursive })
    }
    return dir
  }
  async findMainClass(jarPath) {
    try {
      if (!fs.existsSync(jarPath)) {
        return null
      }
      const zip = new AdmZip(jarPath)
      const manifestEntry = zip.getEntry('META-INF/MANIFEST.MF')
      if (!manifestEntry) {
        return null
      }
      const manifestContent = zip.readAsText(manifestEntry)
      const mainClassLine = manifestContent
        .split('\n')
        .find((line) => line.startsWith('Main-Class:'))
      if (!mainClassLine) {
        return null
      }
      const mainClass = mainClassLine.split(':')[1].trim()
      return mainClass
    } catch (error) {
      return null
    }
  }
}
