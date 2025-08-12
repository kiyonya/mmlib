import { getJsonObjectFromUrl, mavenToPath } from "../utils/util.js"

export default class FabricInstaller{
  constructor({version,fabricVersion,libPath}) {
    this.version = version
    this.fabricVersion = fabricVersion
    this.libPath = libPath
  }
  async install(){
    const fabricVersionJson = await getJsonObjectFromUrl(`https://meta.fabricmc.net/v2/versions/loader/${this.version}/${this.fabricVersion}/profile/json`)

    console.log(fabricVersionJson)

    //格式化lib
    let formatedLibs = []
    for(let lib of fabricVersionJson?.libraries){
      formatedLibs.push({
        "downloads": {
                "artifact": {
                    "path": mavenToPath(lib.name),
                    "sha1": lib?.sha1 || '',
                    "size": lib?.size || 0,
                    "url":( lib?.url + mavenToPath(lib.name)).replaceAll('\\','/')
                }
            },
            "name": lib.name,
      })
    }
    console.log(formatedLibs)

    fabricVersionJson.libraries = formatedLibs

    return fabricVersionJson
  }
}