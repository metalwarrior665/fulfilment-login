const requestPromise = require('request-promise')

const saveScreen = async (page, key, doHtml) => {
    const screenshotBuffer = await page.screenshot({fullPage: true});
    await Apify.setValue(key, screenshotBuffer, { contentType: 'image/png' });
    if(doHtml){
        const html = await page.evaluate('document.documentElement.outerHTML');
        await Apify.setValue(key+'.html', html, { contentType: 'text/html' });
    }
};

const login = async ({ browser, username, password, maxRetries = 5, anticaptchaKey})  => {
    var page = await browser.newPage();
    await page.setViewport({width: 1535, height: 750})
    var captchaImage = '';

    page.on('response', async (response) => {
        if (response.url().includes('CaptchaServlet')) {
            console.log('we got the captcha image')
            const buffer = await response.buffer();
            console.log(buffer.toString('base64'));
            captchaImage = buffer.toString('base64');
        }
    });
    
    await gotoRetried({page, url:'https://fulfilment.gem.gov.in/fulfilment', selector:'button[type="submit"]', maxRetries })

    console.log('we are on the login page')

    await page.waitFor(1000)
    console.log('captcha base64 length',captchaImage.length);
    await page.type('input[id="loginid"]', username, { delay: 100 });
    await page.type('input[id="password"]', password, { delay: 100 });
    
    //Anticaptcha key here
    const anticaptcha = new Anticaptcha(anticaptchaKey);
    const task = {
        type: "ImageToTextTask",
        body: captchaImage,
    }
    const taskId = await anticaptcha.createTask(task);
    const result = await anticaptcha.waitForTaskResult(taskId, 600000);
    
    if (result.status !== 'ready'){
        return;
    }
    await page.type('input[id="captcha_math"]', result.solution.text.toUpperCase(), { delay: 100 });
    
    await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation(),
        page.waitForSelector('#menu_orders')
    ]).catch(e=>console.log(`navigation and waiting after click failed`))
    
    //await gotoRetried({page, url:'https://fulfilment.gem.gov.in/fulfilment', selector:'#menu_orders', maxRetries })
    await page.waitFor(5000)
    console.log('WE ARE LOGGED IN!')

    await gotoRetried({page, url:'https://admin-mkp.gem.gov.in', selector:'#catalog_index', maxRetries })

    console.log('we are on admin')
    
    const cookies = await page.cookies();
    await page.close()
    return cookies
}

module.exports = {login, gotoRetried, saveScreen}

async function gotoRetried({page, url, selector, maxRetries}) {
    let retries = 0
    let isElement

    while(!isElement && retries < maxRetries){
        await page.goto(url)
            .then(()=>selector? page.waitForSelector(selector) : true)
            .catch(()=>console.log(`${url} didnt load on try number ${retries+1}`))
        isElement = selector ? await page.$(selector).catch(()=>{}) : true
        retries++
    }
    if(!isElement) {
        console.log(`WE ARE UNABLE TO LOAD THE ${url} PAGE ON ${retries} TRIES, GIVING UP`)
        return false
    }
    return true
}

class Anticaptcha {
    
    constructor(clientKey) {
        this.clientKey = clientKey;
    }
    
    async createTask(task) {
        let opt = {
            method: 'POST',
            uri: 'http://api.anti-captcha.com/createTask',
            body: {
                task,
                clientKey: this.clientKey,
            },
            json: true
        };
        const response = await requestPromise(opt);
        if(response.errorId > 0) throw response.errorDescription;
        return response.taskId;
    }
    
    async getTaskResult(taskId) {
        const opt = {
            method: 'POST',
            uri: 'http://api.anti-captcha.com/getTaskResult',
            body: {
                taskId,
                clientKey: this.clientKey,
            },
            json: true
        };
        const response = await requestPromise(opt);
        if(response.errorId > 0) throw response.errorDescription;
        return response;
    }

    async waitForTaskResult(taskId, timeout) {
        return new Promise((resolve, reject) => {
            const startedAt = new Date();
            const waitLoop = () => {
                if ((new Date() - startedAt) > timeout) {
                    reject(new Error("Timeout before condition pass"));
                }
                this.getTaskResult(taskId)
                .then((response) => {
                    if (response.errorId !== 0) {
                        reject(new Error(response.errorCode, response.errorDescription));
                    } else {
                        console.log(response);
                        if (response.status === 'ready') {
                            resolve(response);
                        } else {
                            setTimeout(waitLoop, 1000);
                        }
                    }
                })
                .catch((e) => reject(e));
            };
            waitLoop();
        });
    }
    
}