const Apify = require('apify')
const { login } = require('./main.js')

Apify.main(async () => {
    const input = await Apify.getValue('INPUT')
    const { username, password, anticaptchaKey } = input;
    const browser = await Apify.launchPuppeteer();
    await login({
        browser,
        username,
        password,
        anticaptchaKey
    })
})