import fs from 'fs'
import path from 'path'

export default class OptifineCollector{
    constructor({version,optifinePatch,optifineType,versionPath}){
        this.version = version
        this.optifinePatch  = optifinePatch
        this.optifineType = optifineType || 'HD_U'
        this.versionPath = versionPath
    }
    async collect(){
        const optifineURL = `https://bmclapi2.bangbang93.com/optifine/${this.version}/${this.optifineType}/${this.optifinePatch}`

        const isPreview = this.optifinePatch.includes('pre')

        let optifineFileName = `OptiFine-${this.version}_${this.optifineType}_${this.optifinePatch}.jar`

        return [{
            url:optifineURL,
            path:path.join(this.versionPath,'optifine',optifineFileName),
            sha1:''
        }]
    }


}