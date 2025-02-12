


interface EnvConfig {
    [key: string]: string | undefined;
}

class EnvLoader {
    private static envCache: EnvConfig

    static load(): EnvConfig {
        if (!this.envCache) {

            this.envCache = {
                BUSINESS_NAME: process.env.BUSINESS_NAME,
                PORT: process.env.PORT,
                PORT_WB: process.env.PORT_WB,
                PORT_BOT: process.env.PORT_BOT,
                CHATWOOT_URL: process.env.CHATWOOT_URL,
                CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
                CHATWOOT_INBOX_ID: process.env.CHATWOOT_INBOX_ID,
                CHATWOOT_API: process.env.CHATWOOT_API,
                DEBOUNCE_TIME: process.env.DEBOUNCE_TIME,
                TIMER: process.env.TIMER,
                WB_ADMIN_TIMER: process.env.WB_ADMIN_TIMER,
                BOT_URL: process.env.BOT_URL,
                FORM_URL: process.env.FORM_URL,
                H_INICIO: process.env.H_INICIO,
                H_SALIDA: process.env.H_SALIDA,
                ALLOWED_DOCS: process.env.ALLOWED_DOCS,
                ALLOWED_DOCS_SIZE: process.env.ALLOWED_DOCS_SIZE,
                ALLOWED_IMAGES: process.env.ALLOWED_IMAGES,
                NODE_ENV: process.env.NODE_ENV,


            }
        }
        return this.envCache
    }

    static get(key: string): string | undefined {
        if (!this.envCache) {
            this.load()
        }
        return this.envCache[key]
    }
}

export default EnvLoader;