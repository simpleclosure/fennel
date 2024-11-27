import speech from '@google-cloud/speech'
import axios from 'axios'
import { Request, Response } from 'express'
import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import {
  getDetailsFromAccount,
  getInfoFromAccount,
  getStepFromAccount,
  getTaskFromAccount,
  getUserFromUid,
} from '../../../lib/firebase/firebase-rtdb-server'
import { uploadFile } from '../../../lib/firebase/firebase-storage'

const MAX_RETRIES = 3
const RETRY_DELAY = 5000
const DELAWARE_FRANCHISE_TAX_URL =
  'https://icis.corp.delaware.gov/ecorp/logintax.aspx?FilingType=FranchiseTax'
let browser: any

async function solveCaptcha(page: any) {
  console.log('Starting captcha solving process...')

  const audioElement = await page.$('audio')
  const audioSrc = await audioElement.getAttribute('src')
  console.log('Found audio source:', audioSrc)

  console.log('Fetching audio file...')
  const response = await axios.get(audioSrc, {
    responseType: 'arraybuffer',
  })
  const audioBuffer = response.data
  console.log('Audio file size:', audioBuffer.byteLength, 'bytes')

  console.log('Initializing Speech-to-Text client...')
  const base64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64
  const credentials = JSON.parse(atob(base64!))

  const client = new speech.SpeechClient({
    credentials: credentials,
  })

  const audio = {
    content: Buffer.from(audioBuffer).toString('base64'),
  }
  const config = {
    encoding: 'LINEAR16' as const,
    sampleRateHertz: 8000,
    languageCode: 'en-US',
  }
  const request = {
    audio: audio,
    config: config,
  }
  console.log(
    'Sending request to Google Speech-to-Text API with config:',
    config
  )

  const [response2] = await client.recognize(request)

  const transcription = response2.results
    ?.map((result: any) => result.alternatives?.[0]?.transcript)
    .join(' ')

  if (!transcription) {
    console.error('Transcription failed - no text returned from API')
    throw new Error('Failed to transcribe audio captcha')
  }
  console.log('Successfully transcribed audio to:', transcription)

  const formattedCaptcha = transcription
    .split(' ')
    .map((word) => {
      if (/^\d+$/.test(word)) return word
      return word.charAt(0)
    })
    .join('')
    .toUpperCase()

  console.log('Formatted captcha response:', formattedCaptcha)

  console.log('Filling captcha input field...')
  await page.fill(
    '#ctl00_ContentPlaceHolder1_ecorpCaptcha1_txtCaptcha',
    formattedCaptcha
  )
  console.log('Captcha solving process completed')
}

async function enterFileNumberAndSolveCaptcha(
  page: any,
  fileNumber: string,
  accountId: string,
  stepId: string,
  taskId: string
) {
  await page.goto(DELAWARE_FRANCHISE_TAX_URL, {
    waitUntil: 'networkidle',
    timeout: 30000,
  })

  await page.fill('#ctl00_ContentPlaceHolder1_txtPrimaryFileNo', fileNumber)
  await solveCaptcha(page)

  const screenshotBuffer = await page.screenshot({
    fullPage: true,
  })

  await uploadFile(
    accountId,
    stepId,
    taskId,
    'captcha-page.png',
    screenshotBuffer
  )

  await page.click('#ctl00_ContentPlaceHolder1_btnContinue')
  await page.waitForLoadState('networkidle')
  console.log('Successfully clicked to the termination date page')
}

async function fillAnticipatedTerminationDate(
  page: any,
  accountId: string,
  stepId: string,
  taskId: string
) {
  console.log('Starting fillAnticipatedTerminationDate...')

  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 14)
  console.log('Calculated future date:', futureDate)

  const formattedDate = futureDate
    .toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    })
    .replace(/\//g, '')
  console.log('Formatted date for input:', formattedDate)
  const dateInput = '#ctl00_ContentPlaceHolder1_txtEffectiveDate'
  for (const char of formattedDate) {
    await page.type(dateInput, char, { delay: 100 })
  }
  const screenshotBuffer = await page.screenshot({
    fullPage: true,
  })
  console.log(
    'Screenshot captured, size:',
    screenshotBuffer.byteLength,
    'bytes'
  )
  await uploadFile(
    accountId,
    stepId,
    taskId,
    'termination-date-page.png',
    screenshotBuffer
  )
  await page.evaluate(() => {
    // @ts-ignore - WebForm_DoPostBackWithOptions is provided by the page
    window.WebForm_DoPostBackWithOptions({
      eventTarget: 'ctl00$ContentPlaceHolder1$btnCurrentYearFiling',
      eventArgument: '',
      validation: true,
      validationGroup: 'CurrentYearValidate',
      actionUrl: '',
      trackFocus: false,
      clientSubmit: true,
    })
  })
  await page.waitForLoadState('networkidle')
}

async function fillSharesInfo(
  page: any,
  accountId: string,
  taskId: string,
  accountInfo: any
) {
  console.log('Starting fillSharesInfo...')

  const task = await getTaskFromAccount(accountId, taskId)
  const relatedTaskId = task.related_task
  const relatedTask = await getTaskFromAccount(accountId, relatedTaskId)
  const grossAssetValue = relatedTask.invalue?.toString().split('.')[0] || '0'

  const commonSharesSelector =
    '#ctl00_ContentPlaceHolder1_gridStock_ctl02_gridStockDetails_ctl02_txtIssuedShares'
  await page.fill(commonSharesSelector, '')
  const commonShares = accountInfo.box8_common_966?.toString() || '0'
  for (const char of commonShares) {
    await page.type(commonSharesSelector, char, { delay: 100 })
  }
  await page.evaluate((selector: string) => {
    const element = document.querySelector(selector)
    element?.dispatchEvent(new Event('blur'))
  }, commonSharesSelector)

  const preferredShares = accountInfo.box8_preferred_966?.toString() || '0'
  if (preferredShares !== '0') {
    const preferredSharesSelector =
      '#ctl00_ContentPlaceHolder1_gridStock_ctl02_gridStockDetails_ctl03_txtIssuedShares'
    await page.fill(preferredSharesSelector, '')
    for (const char of preferredShares) {
      await page.type(preferredSharesSelector, char, { delay: 100 })
    }
    await page.evaluate((selector: string) => {
      const element = document.querySelector(selector)
      element?.dispatchEvent(new Event('blur'))
    }, preferredSharesSelector)
  }

  const grossAssetSelector =
    '#ctl00_ContentPlaceHolder1_gridStock_ctl02_txtGrossAsset'
  await page.fill(grossAssetSelector, '')
  for (const char of grossAssetValue) {
    await page.type(grossAssetSelector, char, { delay: 100 })
  }
  await page.evaluate((selector: string) => {
    const element = document.querySelector(selector)
    element?.dispatchEvent(new Event('blur'))
  }, grossAssetSelector)

  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 14)
  const formattedDate = futureDate
    .toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    })
    .replace(/\//g, '')

  const assetDateSelector =
    '#ctl00_ContentPlaceHolder1_gridStock_ctl02_txtAssetDate'
  await page.fill(assetDateSelector, '')
  for (const char of formattedDate) {
    await page.type(assetDateSelector, char, { delay: 100 })
  }
  await page.evaluate((selector: string) => {
    const element = document.querySelector(selector)
    element?.dispatchEvent(new Event('blur'))
  }, assetDateSelector)

  console.log('Filled common shares:', commonShares)
  console.log('Filled gross asset value:', grossAssetValue)
  console.log('Filled asset date:', formattedDate)
  await page.click('#ctl00_ContentPlaceHolder1_btnRecalucation')
  await page.waitForLoadState('networkidle')

  await page.waitForSelector('#ctl00_ContentPlaceHolder1_lblAmountDue', {
    timeout: 10000,
  })

  const amountDueElement = await page.$(
    '#ctl00_ContentPlaceHolder1_lblAmountDue'
  )
  if (amountDueElement) {
    const amountDueText = await amountDueElement.textContent()
    console.log('Franchise Tax Amount Due:', amountDueText)

    const amount = parseFloat(amountDueText.replace(/[^0-9.-]+/g, ''))
    if (amount > 3000) {
      console.warn(
        `Warning: Franchise Tax Amount Due ($${amount}) exceeds recommended maximum ($3000)`
      )
    }
  } else {
    console.warn('Amount due element not found on page')
  }
  //TODO
  // fill in amount due in task
  // 7. Confirm cost is $___.
}

async function fillAddressInfo(page: any, accountDetails: any) {
  console.log('Starting fillAddressInfo...')

  const addressSelector = '#ctl00_ContentPlaceHolder1_txtStreetPrincipal'
  const citySelector = '#ctl00_ContentPlaceHolder1_txtCityPrincipal'
  const stateSelector = '#ctl00_ContentPlaceHolder1_drpHidePrincipal'
  const zipSelector = '#ctl00_ContentPlaceHolder1_txtZipPrincipal'

  let fullAddress = accountDetails.business_address1 || ''
  if (
    accountDetails.business_address2 &&
    !/^Box\s+\d+/.test(accountDetails.business_address2)
  ) {
    fullAddress += ` ${accountDetails.business_address2}`
  }

  await page.fill(addressSelector, fullAddress.trim())
  await page.fill(citySelector, accountDetails.business_address_city || '')

  // Select the state from the dropdown
  if (accountDetails.business_address_state) {
    await page.selectOption(
      stateSelector,
      accountDetails.business_address_state
    )
  }

  await page.fill(zipSelector, accountDetails.business_address_zip || '')

  console.log('Filled address info:', {
    address: fullAddress.trim(),
    city: accountDetails.business_address_city,
    state: accountDetails.business_address_state,
    zip: accountDetails.business_address_zip,
  })
}

async function fillPhoneNumber(page: any, phoneNumber: string) {
  console.log('Starting fillPhoneNumber...')

  const phonePart1Selector = '#ctl00_ContentPlaceHolder1_txtPhonePrincipal1'
  const phonePart2Selector = '#ctl00_ContentPlaceHolder1_txtPhonePrincipal2'
  const phonePart3Selector = '#ctl00_ContentPlaceHolder1_txtPhonePrincipal3'

  if (phoneNumber.length !== 10) {
    console.error('Invalid phone number length:', phoneNumber)
    return
  }

  const part1 = phoneNumber.slice(0, 3)
  const part2 = phoneNumber.slice(3, 6)
  const part3 = phoneNumber.slice(6, 10)

  await page.fill(phonePart1Selector, part1)
  await page.fill(phonePart2Selector, part2)
  await page.fill(phonePart3Selector, part3)

  console.log('Filled phone number:', {
    part1,
    part2,
    part3,
  })
}

async function fillOfficerInformation(
  page: any,
  accountId: string,
  taskId: string
) {
  const officerInfo = await getOfficerInfo(accountId, taskId)
  console.log('Starting fillOfficerInformation...')

  const firstNameSelector = '#ctl00_ContentPlaceHolder1_txtFirstOfficer'
  const lastNameSelector = '#ctl00_ContentPlaceHolder1_txtLastOfficer'
  const titleSelector = '#ctl00_ContentPlaceHolder1_txtTitleOfficer'
  const streetSelector = '#ctl00_ContentPlaceHolder1_txtStreetOfficer'
  const citySelector = '#ctl00_ContentPlaceHolder1_txtCityOfficer'
  const stateSelector = '#ctl00_ContentPlaceHolder1_drpHideOfficer'
  const zipSelector = '#ctl00_ContentPlaceHolder1_txtZipOfficer'

  await page.fill(firstNameSelector, officerInfo.firstName || '')
  await page.fill(lastNameSelector, officerInfo.lastName || '')
  await page.fill(titleSelector, officerInfo.title || '')
  await page.fill(streetSelector, officerInfo.street || '')
  await page.fill(citySelector, officerInfo.city || '')

  // Select the state from the dropdown
  if (officerInfo.state) {
    await page.selectOption(stateSelector, officerInfo.state)
  }

  await page.fill(zipSelector, officerInfo.zip || '')

  console.log('Filled officer information:', {
    firstName: officerInfo.firstName,
    lastName: officerInfo.lastName,
    title: officerInfo.title,
    street: officerInfo.street,
    city: officerInfo.city,
    state: officerInfo.state,
    zip: officerInfo.zip,
  })
}

async function getOfficerInfo(accountId: string, taskId: string) {
  const task = await getTaskFromAccount(accountId, taskId)
  const relatedStepId = task.related_step
  const step = await getStepFromAccount(accountId, relatedStepId)
  const signerUid = step.signer_uid
  const user = await getUserFromUid(signerUid)

  return {
    firstName: user.firstName,
    lastName: user.lastName,
    title: user.title,
    street: user.street,
    city: user.city,
    state: user.state,
    zip: user.zip,
  }
}

async function generateFranchiseTaxReport(
  page: any,
  accountId: string,
  stepId: string,
  taskId: string,
  accountInfo: any,
  accountDetails: any
) {
  console.log('Starting generateFranchiseTaxReport...')

  // Wait for page to be stable
  await page.waitForLoadState('networkidle')

  // Extract the zip code and address from the page
  const pageZipCode = await page.$eval(
    '#ctl00_ContentPlaceHolder1_lblZipData',
    (element: any) => element.textContent?.trim()
  )
  const pageAddress = await page.$eval(
    '#ctl00_ContentPlaceHolder1_lblAgentAddress',
    (element: any) => element.textContent?.trim()
  )

  if (pageZipCode === accountDetails.business_address_zip) {
    const fullAddress =
      `${accountDetails.business_address1} ${accountDetails.business_address2}`.trim()
    if (pageAddress === fullAddress) {
      throw new Error(
        'Business address same as agent address, please update business address'
      )
    }
  }

  await fillSharesInfo(page, accountId, taskId, accountInfo)
  await fillAddressInfo(page, accountDetails)
  await fillPhoneNumber(page, accountDetails.business_phone)

  const officerInfo = await getOfficerInfo(accountId, taskId)
  await fillOfficerInformation(page, officerInfo)

  const screenshotBuffer = await page.screenshot({
    fullPage: true,
  })
  await uploadFile(
    accountId,
    stepId,
    taskId,
    'franchise-tax-report.png',
    screenshotBuffer
  )
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  console.log(`Received request ${JSON.stringify(req.body)}`)

  try {
    const { accountId, stepId, taskId } = req.body

    if (!accountId || !stepId || !taskId) {
      console.error('Missing required fields:', req.body)
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['accountId', 'stepId', 'taskId'],
      })
    }

    const [accountInfo, accountDetails] = await Promise.all([
      getInfoFromAccount(accountId),
      getDetailsFromAccount(accountId),
    ])
    if (!accountInfo?.de_file_number) {
      return res
        .status(400)
        .json({ error: 'Delaware file number not found for this account' })
    }

    await initializeBrowser()
    const context = await browser.newContext()
    const page = await context.newPage()

    await enterFileNumberAndSolveCaptcha(
      page,
      accountInfo.de_file_number,
      accountId,
      stepId,
      taskId
    )

    await fillAnticipatedTerminationDate(page, accountId, stepId, taskId)
    await generateFranchiseTaxReport(
      page,
      accountId,
      stepId,
      taskId,
      accountInfo,
      accountDetails
    )
    console.log('current url', page.url())
    const weAreHereBuffer = await page.screenshot({
      fullPage: true,
    })

    await uploadFile(
      accountId,
      stepId,
      taskId,
      'we-are-here.png',
      weAreHereBuffer
    )
    await context.close()
    res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error processing request:', error)
    res.status(500).json({ error: 'Error processing request' })
  }
}

async function initializeBrowser() {
  if (browser) {
    try {
      await browser.close()
    } catch (error) {
      console.info('Error closing existing browser:', error)
    }
  }

  console.info('Launching browser')
  chromium.use(StealthPlugin())

  browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
    ],
  })
}
