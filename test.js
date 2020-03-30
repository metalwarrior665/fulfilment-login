const Apify = require('apify')
const { login } = require('./main.js')

const proxyUrl = `http://groups-RESIDENTIAL,country-IN:${process.env.APIFY_PROXY_PASSWORD}@proxy.apify.com:8000`;

Apify.main(async () => {
    const input = await Apify.getValue('INPUT')
    const { username, password, anticaptchaKey, useStoredCookies } = input;

    let cookies;
    if (!useStoredCookies) {
        // Residential test
        const browser = await Apify.launchPuppeteer({ proxyUrl });
        cookies = await login({
            browser,
            username,
            password,
            anticaptchaKey
        })

        await Apify.setValue('cookies', cookies);

        await browser.close();
    } else {
        cookies = await Apify.getValue('cookies')
    }

    console.log('cookies:');
    console.dir(cookies);

    // Stolen session test
    const cookiesBrowser = await Apify.launchPuppeteer();
    const page = await cookiesBrowser.newPage();
    await page.setCookie(...cookies);
    await page.goto('https://admin-mkp.gem.gov.in').catch(() => { console.log('did not load')})
    await page.waitFor(10000);

    await cookiesBrowser.close();

    const cookiesResidentialBrowser = await Apify.launchPuppeteer({ proxyUrl });
    const page2 = await cookiesResidentialBrowser.newPage();
    await page2.setCookie(...cookies);
    await page2.goto('https://admin-mkp.gem.gov.in', { timeout: 100000 })
    await page2.waitFor(10000);

    await cookiesResidentialBrowser.close();
})