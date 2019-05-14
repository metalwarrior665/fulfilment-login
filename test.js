const Apify = require('apify')
const { login } = require('./main.js')

const proxyUrl = `http://groups-RESIDENTIAL,country-IN:${process.env.APIFY_PROXY_PASSWORD}@proxy.apify.com:8000`;

Apify.main(async () => {
    const input = await Apify.getValue('INPUT')
    const { username, password, anticaptchaKey } = input;

    // Residential test
    const browser = await Apify.launchPuppeteer({ proxyUrl });
    const cookies = await login({
        browser,
        username,
        password,
        anticaptchaKey
    })

    // Stolen session test
    const page = await browser.newPage();
    await page.setCookie(...cookies);
    await page.goto('https://fulfilment.gem.gov.in/fulfilment')
    await page.waitFor(100000)
})