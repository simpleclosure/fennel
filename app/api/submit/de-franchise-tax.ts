import speech from '@google-cloud/speech'
import axios from 'axios'
import { Request, Response } from 'express'
import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import {
  getDetailsFromAccount,
  getInfoFromAccount,
  getStepFromAccount,
  getTableFromAccount,
  getTaskFromAccount,
  getUser,
  setTaskForAccount,
} from '../../../lib/firebase/firebase-rtdb-server'
import { uploadFile } from '../../../lib/firebase/firebase-storage'

const MAX_RETRIES = 3
const RETRY_DELAY = 5000
const DELAWARE_FRANCHISE_TAX_URL =
  'https://icis.corp.delaware.gov/ecorp/logintax.aspx?FilingType=FranchiseTax'
let browser: any

interface ValidationError {
  message: string
  field?: string
}

async function validateInput(
  accountInfo: any,
  accountDetails: any,
  accountTable: any,
  task: any,
  relatedTask: any,
  taskToUnlock: any
) {
  const errors: ValidationError[] = []

  if (!accountInfo?.de_file_number) {
    errors.push({
      field: 'de_file_number',
      message: 'Delaware file number not found for this account',
    })
  }

  if (!accountDetails?.company?.business_address1) {
    errors.push({
      field: 'business_address1',
      message: 'Business address is required',
    })
  }
  if (!accountDetails?.company?.business_address_city) {
    errors.push({
      field: 'business_address_city',
      message: 'Business city is required',
    })
  }
  if (!accountDetails?.company?.business_address_state) {
    errors.push({
      field: 'business_address_state',
      message: 'Business state is required',
    })
  }
  if (!accountDetails?.company?.business_address_zip) {
    errors.push({
      field: 'business_address_zip',
      message: 'Business ZIP code is required',
    })
  }

  if (!accountDetails?.company?.business_phone?.match(/^\d{10}$/)) {
    errors.push({
      field: 'business_phone',
      message: 'Valid 10-digit business phone number is required',
    })
  }

  if (
    !accountTable?.boardmembers ||
    Object.keys(accountTable.boardmembers).length === 0
  ) {
    errors.push({
      field: 'boardmembers',
      message: 'At least one board member is required',
    })
  }

  if (!task.related_task) {
    errors.push({
      field: 'related_task',
      message: 'Task must have a related task',
    })
  }

  if (
    !task.unlocks ||
    !Array.isArray(task.unlocks) ||
    task.unlocks.length !== 1
  ) {
    errors.push({
      field: 'unlocks',
      message: 'Task must have exactly one unlock task',
    })
  }

  if (!relatedTask?.invalue) {
    errors.push({
      field: 'related_task.invalue',
      message: 'Related task must have an invalue set',
    })
  }

  try {
    getFileNumberFromTaskToUnlock(taskToUnlock)
  } catch (error) {
    errors.push({
      field: 'task_to_unlock.body',
      message: 'Task to unlock must contain a file number in its body',
    })
  }

  if (errors.length > 0) {
    throw new Error(JSON.stringify(errors))
  }
}

async function solveCaptcha(page: any) {
  console.log('Starting captcha solving process...')

  const audioElement = await page.$('audio')
  const audioSrc = await audioElement.getAttribute('src')
  console.log('Found audio source:', audioSrc)

  const response = await axios.get(audioSrc, {
    responseType: 'arraybuffer',
  })
  const audioBuffer = response.data

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

  let attempts = 0
  while (attempts < MAX_RETRIES) {
    try {
      await solveCaptcha(page)

      const screenshotBuffer = await page.screenshot({
        fullPage: true,
      })

      await uploadFile(
        accountId,
        stepId,
        taskId,
        `captcha-page-attempt-${attempts + 1}.png`,
        screenshotBuffer
      )

      await page.click('#ctl00_ContentPlaceHolder1_btnContinue')
      await page.waitForLoadState('networkidle')

      const continueButton = await page.$(
        '#ctl00_ContentPlaceHolder1_btnContinue'
      )
      if (!continueButton) {
        console.log('Successfully passed captcha check')
        return
      }

      console.log(`Captcha attempt ${attempts + 1} failed, retrying...`)
      attempts++

      if (attempts >= MAX_RETRIES) {
        throw new Error('Failed to solve captcha after maximum retries')
      }
    } catch (error) {
      console.error(`Error during captcha attempt ${attempts + 1}:`, error)
      attempts++

      if (attempts >= MAX_RETRIES) {
        throw error
      }
    }
  }
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

async function fillSharesInfo(page: any, relatedTask: any, accountInfo: any) {
  console.log('Starting to fill shares info...')

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
  await page.fill(grossAssetSelector, grossAssetValue)

  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 14)
  const futureDateNoSlashes = futureDate
    .toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    })
    .replace(/\//g, '')

  const assetDateSelector =
    '#ctl00_ContentPlaceHolder1_gridStock_ctl02_txtAssetDate'
  await page.fill(assetDateSelector, '')
  for (const char of futureDateNoSlashes) {
    await page.type(assetDateSelector, char, { delay: 100 })
  }
  await page.evaluate((selector: string) => {
    const element = document.querySelector(selector)
    element?.dispatchEvent(new Event('blur'))
  }, assetDateSelector)

  console.log('Filled common shares:', commonShares)
  console.log('Filled gross asset value:', grossAssetValue)
  console.log('Filled asset date:', futureDateNoSlashes)
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
    return { amountDue: amountDueText }
  } else {
    throw new Error('Could not find amount due.')
  }
}

async function fillAddressInfo(page: any, accountDetails: any) {
  console.log('Starting fillAddressInfo...')

  const addressSelector = '#ctl00_ContentPlaceHolder1_txtStreetPrincipal'
  const citySelector = '#ctl00_ContentPlaceHolder1_txtCityPrincipal'
  const stateSelector = '#ctl00_ContentPlaceHolder1_drpHidePrincipal'
  const zipSelector = '#ctl00_ContentPlaceHolder1_txtZipPrincipal'

  let fullAddress = accountDetails.company.business_address1 || ''
  if (
    accountDetails.company.business_address2 &&
    !/^Box\s+\d+/.test(accountDetails.company.business_address2)
  ) {
    fullAddress += ` ${accountDetails.company.business_address2}`
  }

  await page.fill(addressSelector, fullAddress.trim())
  await page.fill(
    citySelector,
    accountDetails.company.business_address_city || ''
  )

  if (accountDetails.company.business_address_state) {
    await page.selectOption(
      stateSelector,
      accountDetails.company.business_address_state
    )
  }

  await page.fill(
    zipSelector,
    accountDetails.company.business_address_zip || ''
  )

  console.log('Filled address info:', {
    address: fullAddress.trim(),
    city: accountDetails.company.business_address_city,
    state: accountDetails.company.business_address_state,
    zip: accountDetails.company.business_address_zip,
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

async function fillAuthorizationInfo(page: any, officerInfo: any) {
  console.log('Starting fillAuthorizationInfo...')

  const today = new Date()
  const formattedDate = today.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  })

  await page.fill(
    '#ctl00_ContentPlaceHolder1_txtAuthorizationDate',
    formattedDate
  )

  await page.fill(
    '#ctl00_ContentPlaceHolder1_txtFirstAuthorization',
    officerInfo.firstName || ''
  )
  await page.fill(
    '#ctl00_ContentPlaceHolder1_txtLastAuthorization',
    officerInfo.lastName || ''
  )
  await page.fill(
    '#ctl00_ContentPlaceHolder1_txtTitleAuthorization',
    officerInfo.title || ''
  )

  await page.fill(
    '#ctl00_ContentPlaceHolder1_txtStreetAuthorization',
    officerInfo.street || ''
  )
  await page.fill(
    '#ctl00_ContentPlaceHolder1_txtCityAuthorization',
    officerInfo.city || ''
  )
  await page.selectOption(
    '#ctl00_ContentPlaceHolder1_drpHideAuthor',
    officerInfo.state || ''
  )
  await page.fill(
    '#ctl00_ContentPlaceHolder1_txtZipAuthorization',
    officerInfo.zip || ''
  )

  await page.check('#ctl00_ContentPlaceHolder1_chkCertify')

  console.log('Filled authorization information')
}

async function fillBoardMembers(
  page: any,
  boardmembers: any[],
  accountDetails: any
) {
  console.log('Starting fillBoardMembers...')

  const numDirectors = boardmembers.length
  await page.fill(
    '#ctl00_ContentPlaceHolder1_txtTotalNumOfDirectors',
    numDirectors.toString()
  )

  await page.click('#btnDisplayDirectorForm')
  await page.waitForLoadState('networkidle')

  await page.waitForSelector('#txtDirectorName1', {
    timeout: 10000,
  })

  for (let i = 0; i < boardmembers.length; i++) {
    const directorNum = i + 1
    const member = boardmembers[i]

    const names = member.name ? member.name.split(' ') : []
    const firstName = member.first_name || names[0] || ''
    const lastName = member.last_name || names[names.length - 1] || ''

    await page.type(`#txtDirectorName${directorNum}`, firstName)
    await page.type(`#txtLastName${directorNum}`, lastName)

    await page.type(
      `#txtDirectorAddress${directorNum}`,
      accountDetails.company.business_address1
    )
    await page.type(
      `#txtDirectorCity${directorNum}`,
      accountDetails.company.business_address_city
    )
    await page.selectOption(
      `#drpDirectorStates${directorNum}`,
      accountDetails.company.business_address_state
    )
    await page.type(
      `#txtDirectorZip${directorNum}`,
      accountDetails.company.business_address_zip
    )
  }
}

async function fillOfficerAuthorizationAndBoard(
  page: any,
  accountId: string,
  task: any,
  accountDetails: any,
  boardmembers: any[]
) {
  const officerInfo = await getOfficerInfo(
    accountId,
    task,
    accountDetails,
    boardmembers
  )
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

  if (officerInfo.state) {
    await page.selectOption(stateSelector, officerInfo.state)
  }

  await page.fill(zipSelector, officerInfo.zip || '')

  await fillBoardMembers(page, boardmembers, accountDetails)
  await fillAuthorizationInfo(page, officerInfo)

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

async function getOfficerInfo(
  accountId: string,
  task: any,
  accountDetails: any,
  boardmembers: any[]
) {
  console.log('Getting officer info...')
  console.log('Boardmembers:', boardmembers)
  const relatedStepId = task.related_step
  const step = await getStepFromAccount(accountId, relatedStepId)
  const signerUid = step.signer_uid
  const user = await getUser(signerUid)

  const matchingBoardMember = boardmembers.find(
    (member) => member.email.toLowerCase() === user.email.toLowerCase()
  )

  if (!matchingBoardMember) {
    throw new Error(
      `No matching board member found for user email: ${user.email}`
    )
  }

  return {
    firstName: user.first_name,
    lastName: user.last_name,
    title: matchingBoardMember.title,
    street:
      accountDetails.company.business_address1 +
      (accountDetails.company.business_address2
        ? ` ${accountDetails.company.business_address2}`
        : ''),
    city: accountDetails.company.business_address_city,
    state: accountDetails.company.business_address_state,
    zip: accountDetails.company.business_address_zip,
  }
}

async function generateFranchiseTaxReport(
  page: any,
  accountId: string,
  stepId: string,
  task: any,
  relatedTask: any,
  taskToUnlock: any,
  accountInfo: any,
  accountDetails: any,
  accountTable: any
) {
  console.log('Starting generateFranchiseTaxReport...')
  let attempts = 0

  while (attempts < MAX_RETRIES) {
    try {
      await page.waitForLoadState('networkidle', { timeout: 30000 })

      await page.waitForSelector('#ctl00_ContentPlaceHolder1_lblZipData', {
        timeout: 10000,
      })
      await page.waitForSelector('#ctl00_ContentPlaceHolder1_lblAgentAddress', {
        timeout: 10000,
      })

      const pageZipCode = await page.$eval(
        '#ctl00_ContentPlaceHolder1_lblZipData',
        (element: any) => element.textContent?.trim()
      )
      const pageAddress = await page.$eval(
        '#ctl00_ContentPlaceHolder1_lblAgentAddress',
        (element: any) => element.textContent?.trim()
      )

      if (pageZipCode === accountDetails.company.business_address_zip) {
        const fullAddress =
          `${accountDetails.company.business_address1} ${accountDetails.company.business_address2}`.trim()
        if (pageAddress === fullAddress) {
          throw new Error(
            'Business address same as agent address, please update business address'
          )
        }
      }

      const { amountDue } = await fillSharesInfo(page, relatedTask, accountInfo)
      await fillAddressInfo(page, accountDetails)
      await fillPhoneNumber(page, accountDetails.company.business_phone)

      await fillOfficerAuthorizationAndBoard(
        page,
        accountId,
        task,
        accountDetails,
        Object.values(accountTable.boardmembers)
      )

      const screenshotBuffer = await page.screenshot({
        fullPage: true,
      })
      await uploadFile(
        accountId,
        stepId,
        task.id,
        'franchise-tax-report.png',
        screenshotBuffer
      )
      console.log('Successfully generated franchise tax report')

      console.log('Saving session...')
      await page.click('#ctl00_ContentPlaceHolder1_btnSaveSession')
      console.log('Clicked save session')

      await page.waitForLoadState('networkidle')
      console.log('Waiting for first confirm button')
      await page.waitForSelector('.remodal-confirm', {
        timeout: 10000,
      })
      await page.click('.remodal-confirm')
      console.log('Clicked first confirm button')
      await page.waitForLoadState('networkidle')

      const saveSessionScreenshot = await page.screenshot({
        fullPage: true,
      })
      await uploadFile(
        accountId,
        stepId,
        task.id,
        'session-confirmation.png',
        saveSessionScreenshot
      )

      try {
        console.log('Checking for second save session button')
        await page.waitForSelector(
          '#ctl00_ContentPlaceHolder1_btnSaveSession',
          {
            timeout: 1000,
          }
        )
        await page.click('#ctl00_ContentPlaceHolder1_btnSaveSession')
        console.log('Clicked second save session button')

        await page.waitForLoadState('networkidle')
        await page.waitForSelector('.remodal-confirm', {
          timeout: 10000,
        })
        await page.click('.remodal-confirm')
        console.log('Clicked second confirm button')
        await page.waitForLoadState('networkidle')
      } catch (error) {
        console.log('No second save session button found, continuing...')
      }

      const saveSession2Screenshot = await page.screenshot({
        fullPage: true,
      })
      await uploadFile(
        accountId,
        stepId,
        task.id,
        'save-session-final.png',
        saveSession2Screenshot
      )
      const sessionNumberSelector =
        '#ctl00_ContentPlaceHolder1_lblSessionNumber'
      const expiryDateSelector =
        '#ctl00_ContentPlaceHolder1_lblsessionexpirydate'

      await Promise.all([
        page.waitForSelector(sessionNumberSelector, { timeout: 10000 }),
        page.waitForSelector(expiryDateSelector, { timeout: 10000 }),
      ])

      const sessionNumber = await page.$eval(sessionNumberSelector, (el: any) =>
        el.textContent?.trim()
      )
      const expiryDate = await page.$eval(expiryDateSelector, (el: any) =>
        el.textContent?.trim()
      )

      console.log('Session number:', sessionNumber)
      console.log('Expiry date:', expiryDate)
      console.log('Amount due:', amountDue)

      await updateTaskWithSessionAndCost(
        accountId,
        taskToUnlock,
        sessionNumber,
        amountDue
      )

      return { sessionNumber, expiryDate }
    } catch (error) {
      attempts++
      console.error(
        `Attempt ${attempts} failed in generateFranchiseTaxReport:`,
        error
      )

      if (attempts >= MAX_RETRIES) {
        console.error('Max retries reached, throwing error')
        throw error
      }

      console.log(`Waiting ${RETRY_DELAY}ms before retry...`)
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
    }
  }
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  console.log(`Received request ${JSON.stringify(req.body)}`)

  let page: any
  let context: any

  try {
    const { accountId, stepId, taskId } = req.body

    if (!accountId || !stepId || !taskId) {
      console.error('Missing required fields:', req.body)
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['accountId', 'stepId', 'taskId'],
      })
    }

    const [accountInfo, accountDetails, accountTable, task] = await Promise.all(
      [
        getInfoFromAccount(accountId),
        getDetailsFromAccount(accountId),
        getTableFromAccount(accountId),
        getTaskFromAccount(accountId, taskId),
      ]
    )

    const [relatedTask, taskToUnlock] = await Promise.all([
      getTaskFromAccount(accountId, task.related_task),
      getTaskFromAccount(accountId, task.unlocks[0]),
    ])

    try {
      await validateInput(
        accountInfo,
        accountDetails,
        accountTable,
        task,
        relatedTask,
        taskToUnlock
      )
    } catch (validationError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: JSON.parse((validationError as Error).message),
      })
    }

    await initializeBrowser()
    context = await browser.newContext()
    page = await context.newPage()

    await enterFileNumberAndSolveCaptcha(
      page,
      getFileNumberFromTaskToUnlock(taskToUnlock),
      accountId,
      stepId,
      taskId
    )

    await fillAnticipatedTerminationDate(page, accountId, stepId, taskId)
    const result = await generateFranchiseTaxReport(
      page,
      accountId,
      stepId,
      task,
      relatedTask,
      taskToUnlock,
      accountInfo,
      accountDetails,
      accountTable
    )
    await context.close()
    res.status(200).json({ success: true, ...result })
  } catch (err) {
    console.error('Error processing request:', err)

    if (page) {
      try {
        const errorScreenshot = await page.screenshot({
          fullPage: true,
        })

        await uploadFile(
          req.body.accountId,
          req.body.stepId,
          req.body.taskId,
          'error-state.png',
          errorScreenshot
        )
      } catch (screenshotError) {
        console.error('Failed to capture error screenshot:', screenshotError)
      }
    }

    // Clean up browser context if it exists
    if (context) {
      await context.close().catch(console.error)
    }

    res.status(500).json({ error: 'Error processing request: ' + err })
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

async function updateTaskWithSessionAndCost(
  accountId: string,
  task: any,
  sessionNumber: string,
  cost: string
) {
  const expirationDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days from now
  if (task.body.includes('Session Number - ____________')) {
    task.body = task.body.replace(
      'Session Number - ____________',
      `Session Number - ${sessionNumber}`
    )
  } else {
    task.body = task.body.replace(
      /Session Number - \d+/,
      `Session Number - ${sessionNumber}`
    )
  }

  if (task.body.includes('cost is $___.')) {
    task.body = task.body.replace('cost is $___.', `cost is $${cost}.`)
  } else {
    task.body = task.body.replace(/cost is \$[\d,]+\./, `cost is $${cost}.`)
  }

  await setTaskForAccount(accountId, task.id, {
    body: task.body,
    label: `Pay Final Franchise Taxes by ${expirationDate.toLocaleDateString()}`,
  })
  return task
}

function getFileNumberFromTaskToUnlock(task: any) {
  const body = task.body || ''
  const fileNumberMatch = body.match(/File Number - (\d+)/)
  if (!fileNumberMatch) {
    throw new Error('File number not found in task body')
  }
  return fileNumberMatch[1].trim()
}
