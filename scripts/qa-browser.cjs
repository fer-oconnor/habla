const path = require('node:path');

// These checks intentionally mutate only the fictional local preview profile.
// Never let a copied command or environment setting target a hosted Site.
const target = new URL(process.env.HABLA_TEST_URL || 'http://127.0.0.1:5173');
if (!['http:', 'https:'].includes(target.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
    target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
  throw new Error('HABLA_TEST_URL must be a loopback origin, for example http://127.0.0.1:5173. Production tests are refused.');
}
const base = target.origin;
const {chromium} = require('playwright');
const launchOptions = {headless:true};
if (process.env.HABLA_BROWSER_EXECUTABLE) launchOptions.executablePath = process.env.HABLA_BROWSER_EXECUTABLE;
else if (process.env.HABLA_BROWSER_CHANNEL) launchOptions.channel = process.env.HABLA_BROWSER_CHANNEL;

process.chdir(path.resolve(__dirname, '..'));

async function prepareLearner(page) {
  await page.goto(base + '/learn');
  await page.locator('#app').waitFor({state:'visible'});
  await page.waitForFunction(() => document.querySelector('#view')?.textContent?.trim());
  if (await page.getByRole('heading',{name:'Tu progreso y tu privacidad'}).count()) {
    await page.getByRole('button',{name:'Continuar sin compartir',exact:true}).click();
  }
  await page.waitForFunction(() => !document.querySelector('#view')?.textContent?.includes('Tu progreso y tu privacidad'));
  if (await page.locator('#ob-name').count()) {
    await page.locator('#ob-name').fill('Demo HABLA');
    await page.locator('form button[type=submit]').click();
  }
  await page.waitForURL('**/learn');
  await page.getByRole('heading',{name:'Aprende a tu ritmo.'}).waitFor();
}

module.exports = {chromium,base,launchOptions,prepareLearner};
