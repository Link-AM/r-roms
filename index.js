const fs = require('fs')
const path = require('path')
const playwright = require('playwright')
const propReader = require('properties-reader')
const props = propReader(getPropFile()).getAllProperties()

var results = {
    Success: 0,
    Failed: 0,
    Skipped: 0,
    Preexisted:0
}

main()

async function main() {
    let browser = await init(`chromium`)
    let page = await newPage(browser)
    await login(page)
    await downloadAllFiles(page)
    await browser.close()
    console.log(results)
}

async function downloadAllFiles(page) {
    await page.goto(props.downloadPageUrl)
    let folderName = path.basename(props.downloadPageUrl)
    let folderPath = path.join(__dirname, `downloads`, folderName)
    let links = page.locator('a:visible')
    let count = await links.count()
    for (let i = 0; i < count; i++) {
        let link = await links.nth(i).innerText()
        if (allConditionsMet(link)) {
            await downloadIfNonexistent(link, page, folderPath)
        }
    }
    console.log(`All files evaluated.  Save location: ${folderPath}`)
}

async function downloadIfNonexistent(link, page, folderPath) {
    let saveFile = path.join(folderPath, link)
    if (fs.existsSync(saveFile)) {
        console.log(`File already exists in the save location\t\t\t${link}`)
        results.Preexisted++
    } else {
        attemptToDownload(link, page, saveFile)
    }
}

async function attemptToDownload(link, page, saveFile) {
    try {
        let [download] = await Promise.all([
            page.waitForEvent('download'),
            page.locator(`text=${link}`).click(),
        ])
        console.log(`Download started for file. Please wait...\t\t${link}`)
        await download.saveAs(saveFile)
        console.log(`\t Download complete`)
        results.Success++
    } catch (err) {
        console.error(`ERROR - Could not download file\t\t${link}'\n${err}` )
        results.Failed++
    }
}

function allConditionsMet(text) {
    if (props.fileExtension.length > 0) {
        if (!text.endsWith(props.fileExtension)) {
            return false
        }
    }
    if (props.includeText.length > 0) {
        if (!text.includes(props.includeText)) {
            console.log(`File skipped because it does not contain '${props.includeText}'\t\t${text}`)
            results.Skipped++
            return false
        }
    }
    if (props.excludeText.length > 0) {
        if (text.includes(props.excludeText)) {
            console.log(`File skipped because it contains '${props.excludeText}'\t\t\t\t${text}`)
            results.Skipped++
            return false
        }
    }
    return true
}

async function init(driver) {
    let browser = await playwright[driver].launch({
        headless: false
    })
    return browser
}

async function newPage(browser) {
    let context = await browser.newContext({ acceptDownloads: true })
    let page = await context.newPage()
    return page
}

function getPropFile() {
    let criteria = path.join(__dirname, `criteria.properties`)
    let personal = path.join(__dirname, `personal.properties`)
    let propFile = fs.existsSync(personal) ? personal : criteria
    return propFile
}

async function login(page) {
    await page.goto(`https://archive.org/account/login`)
    await page.locator('input[name="username"]').fill(props.username)
    await page.locator('input[name="password"]').fill(props.password)
    await page.locator('input[name="submit-to-login"]').click()
    await page.waitForURL('https://archive.org/')
}