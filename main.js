const login = async ({browser,username,password, maxRetries})  => {
    var page = await browser.newPage();
    
    var captchaImage = '';

    page.on('response', async (response) => {
        if (response.url().includes('CaptchaServlet')) {
            console.log('we got the captcha image')
            const buffer = await response.buffer();
            console.log(buffer.toString('base64'));
            captchaImage = buffer.toString('base64');
        }
    });
    
    let retries = 1
    let selector

    while(!selector && retries < maxRetries){
        await page.goto('https://fulfilment.gem.gov.in/fulfilment')
            .then(()=>page.waitForSelector('button[type="submit"]'))
            .catch(()=>console.log(`loading page didnt load on try number ${retries+1}`))
        await page.waitFor(1000)
        selector = await page.$('button[type="submit"]')
        retries++
    }

    if(!selector) {
        console.log(`WE ARE UNABLE TO LOAD THE LOGIN PAGE ON ${retries} TRIES, EXITING THE ACT`)
        process.exit()
    }

    console.log('we are on the login page')

    await page.waitFor(1000)
    console.log('captcha base64 length',captchaImage.length);
    await page.type('input[id="loginid"]', username, { delay: 100 });
    await page.type('input[id="password"]', password, { delay: 100 });
    
    //Anticaptcha key here
    const anticaptcha = new Anticaptcha('bd64703c6c5c2b6e4882578f7f700133');
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
    
    await page.click('button[type="submit"]');
    
    let selectorAfter
    let retriesAfter = 1
    while(!selectorAfter && retriesAfter < maxRetries){
        if(retriesAfter === 1) await page.waitForSelector('#menu_orders').catch(e=>console.log(`after login page didnt load on try number ${retriesAfter+1}`))
        else{
            await page.goto('https://fulfilment.gem.gov.in/fulfilment')
                .then(()=>page.waitForSelector('#menu_orders'))    
                .catch(e=>console.log(`after login page didnt load on try number ${retriesAfter+1}`))
        }
        selectorAfter = await page.$('#menu_orders');
        retriesAfter++
    }

    if(!selectorAfter) {
        console.log(`WE ARE UNABLE TO LOAD THE AFTER-LOGIN PAGE ON ${retriesAfter} TRIES, EXITING THE ACT`)
        process.exit()
    }

    console.log('WE ARE LOGGED IN!')
    
    const cookies = await page.cookies();
    await page.close()
    return {cookies}
}

module.exports = login

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