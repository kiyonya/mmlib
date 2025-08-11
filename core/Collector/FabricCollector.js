import path from "path";
import { getJsonObjectFromUrl, mavenToPath } from "../utils/util.js";

export default class FabricCollector {
    constructor({version,fabricVersion,libPath,fabricApiVersion,versionPath}){
        this.version = version
        this.fabricVersion = fabricVersion
        this.libPath = libPath
        this.versionPath = versionPath
        this.fabricApiIndexUrl = fabricApiVersion ? `https://api.modrinth.com/v2/project/fabric-api/version/${fabricApiVersion}+${version}` : null

        this.modPath = path.join(versionPath,'mods')
    }
    async collect(){
        const fabricVersionJson = await getJsonObjectFromUrl(`https://meta.fabricmc.net/v2/versions/loader/${this.version}/${this.fabricVersion}/profile/json`)

        let downloadTask = []
        
        
        if(this.fabricApiIndexUrl){
            const fabricApiJson = await getJsonObjectFromUrl(this.fabricApiIndexUrl)
            const fabricApiFiles = fabricApiJson.files
            for(let file of fabricApiFiles){
                let url = file.url
                let filepath = path.join(this.modPath,file?.filename)
                let sha1 = file?.hashes.sha1
                downloadTask.push({
                    url,
                    path:filepath,
                    sha1
                })
            }
        }

        for(let lib of fabricVersionJson.libraries){
            let mavenPath = mavenToPath(lib.name)
            const file = path.join(this.libPath,mavenPath)
            const url = (lib.url + mavenPath).replace('\\','/')
            const sha1 = lib?.sha1 || void 0
            downloadTask.push({
                url,path:file,sha1
            })
        }

        return downloadTask

    }
}