import path from "path";
import { getJsonObjectFromUrl, mavenToPath } from "../utils/util.js";

export default class QuiltCollector{
    constructor({version,quiltVersion,libPath}){
        this.version = version,
        this.quiltVersion = quiltVersion
        this.libPath = libPath
    }
    async collect(){
        const installProfile = await getJsonObjectFromUrl(`https://meta.quiltmc.org/v3/versions/loader/${this.version}/${this.quiltVersion}/profile/json`)
        let downloadTasks = []
        for(let lib of installProfile?.libraries || []){
            let maven = mavenToPath(lib?.name)
            downloadTasks.push({
                path:path.join(this.libPath,maven),
                url:lib?.url ? (lib.url + maven).replaceAll('\\','/') : '',
                sha1:null
            })
        }
        return downloadTasks
    }
}