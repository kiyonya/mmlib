
import { getJsonObjectFromUrl } from "./util"
export async function getFabricAPIDownload(gameVersion, loader, fabricAPIVersion) {
    //尝试从modrinth获取
    const modrinthVersionList = await getJsonObjectFromUrl(`https://api.modrinth.com/v2/project/P7dR8mSH/version`)

    const targetModrinthVersion = modrinthVersionList.filter(i => i.game_versions.includes(gameVersion) && i.loaders.includes(loader) && i.version_number.split('+')[0] === fabricAPIVersion)
    console.log(targetModrinthVersion)
    if (targetModrinthVersion.length) {

        const filename = targetModrinthVersion[0].files[0].filename
        const url = targetModrinthVersion[0].files[0].url
        const sha1 = targetModrinthVersion[0].files[0].hashes.sha1

        return { filename, url, sha1 }
    }
    return null
}
