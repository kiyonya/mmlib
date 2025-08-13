import { getJsonObjectFromUrl } from "../utils/util.js"

export default class QuiltInstaller {
    constructor({version,quiltVersion}){
        this.version = version,
        this.quiltVersion = quiltVersion
    }
    async install(){
        const buildJson = await getJsonObjectFromUrl(`https://meta.quiltmc.org/v3/versions/loader/${this.version}/${this.quiltVersion}/profile/json`)
        return buildJson
    }
}