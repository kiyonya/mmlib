export default class Mirror {
    static mirrorMap = {
        bmcl: {
            "http://resources.download.minecraft.net": "https://bmclapi2.bangbang93.com/assets",
            "https://libraries.minecraft.net": "https://bmclapi2.bangbang93.com/maven",
            "https://files.minecraftforge.net/maven": "https://bmclapi2.bangbang93.com/maven",
            "https://meta.fabricmc.net": "https://bmclapi2.bangbang93.com/fabric-meta",
            "https://maven.fabricmc.net": "https://bmclapi2.bangbang93.com/maven",
            "https://maven.neoforged.net/releases": "https://bmclapi2.bangbang93.com/maven"
        }
    }

    static getMirroredUrl(originalUrl, mirrorName) {
        if (!mirrorName || !this.mirrorMap[mirrorName]) {
            return originalUrl
        }
        const mirror = this.mirrorMap[mirrorName];
        for (const [originalPrefix, mirroredPrefix] of Object.entries(mirror)) {
            if (originalUrl.startsWith(originalPrefix)) {
                return originalUrl.replace(originalPrefix, mirroredPrefix);
            }
        }
        return originalUrl;
    }
}