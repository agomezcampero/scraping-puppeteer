const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const crypto = require('crypto');

puppeteer.use(StealthPlugin())

class FalabellaService {
    constructor() {
        this.baseUrl = 'https://www.gutenberg.org';
        this.browser = null;
    }

    async initialize() {
        if (!this.browser) {
            const options = {
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-extensions',
                    '--disable-software-rasterizer',
                    '--window-size=1280,800',
                    '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                ],
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
                defaultViewport: {
                    width: 1280,
                    height: 800
                }
            };

            this.browser = await puppeteer.launch(options);
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    async mabayaCode(email, password) {
        await this.initialize();

        const browserPage = await this.browser.newPage();
        const state = crypto.randomBytes(16).toString('hex');
        const encodedEmail = encodeURIComponent(email);
        
        let mabayaCode = null;

        // Set up response listener to capture cookies
        browserPage.on('response', async (response) => {
          const url = response.url();
          if (url.includes('manage-api.mabaya.com/backend/user/auth?authToken')) {
            const headers = response.headers();
            const setCookieHeader = headers['set-cookie'];
            if (setCookieHeader) {
              const cookieString = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
              const bushMatch = cookieString.match(/bush=([^;]+)/);
              
              if (bushMatch && bushMatch[1]) {
                mabayaCode = bushMatch[1];
                console.log('Extracted Mabaya code:', mabayaCode);
              }
            }
          }
        });
        
        const authUrl = `https://access-key-corp.falabella.tech/auth/realms/esti/protocol/openid-connect/auth?` +
            `scope=openid+profile+email&login_hint=${encodedEmail}&state=${state}&` +
            `response_type=code&approval_prompt=auto&redirect_uri=http%3A%2F%2Fsellercenter.falabella.com%2Fuser` +
            `%2Fauth%2Fvalidate&client_id=GSC&fpkt=true`;
        try {
            const response = await browserPage.goto(authUrl, { 
              waitUntil: 'networkidle0',
              timeout: 30000 
            });

            // Wait for the password field to be visible
            await browserPage.waitForSelector('#password', { visible: true, timeout: 10000 });
            
            // Type the password
            await browserPage.type('#password', password);
            
            // Click the login button
            await browserPage.click('#login');
            
            // Wait for 10 seconds after login
            await new Promise(resolve => setTimeout(resolve, 10000));

            // Redirect to the seller center login page
            console.log('Redirecting to seller center login page');
            await browserPage.goto('https://sellercenter.falabella.com/retail-services/vas/login', {
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            
            // Wait for navigation to Mabaya
            console.log('Waiting for Mabaya auth request...');
            await browserPage.waitForResponse(
                response => response.url().includes('manage-api.mabaya.com/backend/user/auth?authToken'),
                { timeout: 30000 }
            ).catch(err => console.log('Mabaya response timeout:', err.message));
            
            // Return the cookies if found
            if (mabayaCode) {
                return mabayaCode;
            }
            
            // Fallback to getting cookies directly if not captured by listener
            const allCookies = await browserPage.cookies();
            const mabayaRelatedCookies = allCookies.filter(cookie => 
                cookie.domain.includes('mabaya.com') || 
                cookie.name.toLowerCase().includes('mabaya')
            );
            
            return mabayaRelatedCookies.length > 0 ? mabayaRelatedCookies : response.status();
            
        } catch (error) {
            throw new Error(`Failed to obtain mabaya code, error: ${error.message}`);
        } finally {
            await browserPage.close();
        }
    }
}

module.exports = new FalabellaService(); 