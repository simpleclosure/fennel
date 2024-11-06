import axios from 'axios'
import { Request, Response } from 'express'
import { chromium } from 'playwright'
import { RETRYABLE_ERROR_PATTERNS } from '../../../lib/consts'
import {
  getInfoFromAccount,
  getStepFromAccount,
  getTaskFromAccount,
  setStateSubmission,
  setTaskForAccount,
  setValueForAccount,
} from '../../../lib/firebase/firebase-rtdb-server'
import {
  getDownloadUrl,
  uploadFile,
} from '../../../lib/firebase/firebase-storage'

const MAX_RETRIES = 3
const RETRY_DELAY = 5000
const DELAWARE_LOGIN_URL = 'https://icis.corp.delaware.gov/ecorp2/account/login'
const DELAWARE_EFILING_URL =
  'https://icis.corp.delaware.gov/ecorp2/services/e-filing'
let browser: any

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { accountId, stepId, taskId, phase } = req.body

    if (!accountId || !stepId || !taskId || !phase) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['accountId', 'stepId', 'taskId', 'phase'],
      })
    }

    const task = await getTaskFromAccount(accountId, taskId)
    if (!task) {
      throw new Error(`Task not found for ID: ${taskId}`)
    }

    const relatedTaskId = task.related_task
    const relatedStepId = task.related_step

    if (!relatedTaskId || !relatedStepId) {
      return res.status(400).json({
        success: false,
        error: 'Related task or step information missing from task data',
      })
    }

    const [relatedTask, relatedStep] = await Promise.all([
      getTaskFromAccount(accountId, relatedTaskId),
      getStepFromAccount(accountId, relatedStepId),
    ])

    if (!relatedTask || !relatedStep) {
      throw new Error('Failed to fetch related task or step data')
    }

    const serviceRequestNumber = await submitDelawareForm(
      accountId,
      stepId,
      task,
      relatedTask,
      relatedStep,
      phase
    )

    res.status(200).json({
      success: true,
      message: 'Dissolution form submitted successfully',
      data: {
        serviceRequestNumber,
      },
    })
  } catch (error: any) {
    console.error('Dissolution process failed:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
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

  console.info('Launching browser in', 'development', 'mode')

  try {
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
    console.info('Browser launched successfully')
  } catch (error) {
    console.error('Failed to launch browser:', error)
    throw new Error(`Failed to launch browser: ${error}`)
  }
}

async function loginToDelaware(page: any) {
  try {
    console.info('Navigating to Delaware login page...')
    const response = await page.goto(DELAWARE_LOGIN_URL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })

    if (response) {
      console.info('Response status:', response.status())
    }

    console.info('Waiting for login form...')
    await page.waitForSelector('input[formcontrolname="userName"]', {
      state: 'visible',
      timeout: 30000,
    })

    console.info('Filling login credentials...')
    await page.fill(
      'input[formcontrolname="userName"]',
      process.env.DELAWARE_USERNAME!
    )
    await page.fill(
      'input[formcontrolname="password"]',
      process.env.DELAWARE_PASSWORD!
    )

    console.info('Submitting login form...')
    await page.click('button[type="submit"]')

    await page.waitForNavigation({ waitUntil: 'networkidle' })
    console.info('Login completed successfully')
  } catch (error: any) {
    console.error('Login error:', error.message)
    throw error
  }
}

export async function extractServiceRequestNumber(page: any): Promise<string> {
  console.info('Attempting to extract service request number...')
  await page.waitForSelector('table.table-borderless', {
    state: 'visible',
    timeout: 30000,
  })

  const requestNumberText = await page.evaluate(() => {
    const tableCell = Array.from(
      document.querySelectorAll('table.table-borderless tr')
    )
      .find((row) =>
        row
          .querySelector('td')
          ?.textContent?.includes('Service Request Number:')
      )
      ?.querySelector('td:last-child')
      ?.textContent?.trim()

    if (tableCell) return tableCell

    const infoBlock = document.querySelector('.info-block p')?.textContent
    if (infoBlock) {
      const match = infoBlock.match(/request number:\s*(\d+)/)
      if (match) return match[1]
    }

    return null
  })

  if (!requestNumberText) {
    await page.screenshot({
      path: `service-request-error-${Date.now()}.png`,
      fullPage: true,
    })
    throw new Error(
      'Could not find service request number on completion page. See screenshot.'
    )
  }
  return requestNumberText
}

function getPriorityFromInput(input?: string): DocumentPriorityOptions {
  if (!input) return DocumentPriorityOptions.NormalProcessing

  const normalizedInput = input.trim().toLowerCase()
  if (['yes', 'y'].includes(normalizedInput)) {
    return DocumentPriorityOptions.TwentyFourHourService
  }
  if (['no', 'n'].includes(normalizedInput)) {
    return DocumentPriorityOptions.NormalProcessing
  }

  return DocumentPriorityOptions.NormalProcessing
}

async function initializeSubmission(
  accountId: string,
  relatedStep: any,
  relatedTask: any
) {
  const accountInfo = await getInfoFromAccount(accountId)

  let fileUrl
  if (relatedStep?.timeline) {
    const timelineEvents = Object.values(
      relatedStep.timeline
    ) as TimelineEvent[]
    const stepCompleteEvent = timelineEvents.find(
      (event) => event.type === TimelineEventType.STEP_COMPLETE
    )
    if (stepCompleteEvent?.file_url) {
      fileUrl = stepCompleteEvent.file_url
    }
  }

  if (!fileUrl) {
    throw new Error(
      `Could not find Executed CoD file URL for account ${accountId} and related step ${relatedStep.id}`
    )
  }

  console.info(`Successfully found Executed CoD file at: ${fileUrl}`)

  const response = await axios.get(await getDownloadUrl(fileUrl), {
    responseType: 'arraybuffer',
  })
  const certificateBuffer = Buffer.from(response.data)

  await initializeBrowser()
  const context = await browser.newContext()
  const page = await context.newPage()
  await loginToDelaware(page)

  return {
    accountInfo,
    certificateBuffer,
    context,
    page,
    priority: getPriorityFromInput(relatedTask?.invalue),
  }
}

async function fillInitialDelawareForm(
  page: any,
  priority: DocumentPriorityOptions,
  accountInfo: any,
  certificateBuffer: Buffer
) {
  try {
    console.info('Navigating to the Delaware page...')
    await page.goto(DELAWARE_EFILING_URL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })

    page.on('console', (msg: any) =>
      console.info('Browser console:', msg.text())
    )

    console.info('Waiting for form to load...')
    await page.waitForSelector('select[formcontrolname="workFlowPriority"]', {
      state: 'visible',
    })

    console.info('Filling out the form...')
    await page.selectOption(
      'select[formcontrolname="workFlowPriority"]',
      priority
    )
    await page.selectOption(
      'select[formcontrolname="documentUploadRequestType"]',
      DocumentRequestType.DocumentFilingRequest
    )
    await page.selectOption(
      'select[formcontrolname="returnMethod"]',
      'RegularMail'
    )

    await page.fill(
      'input[formcontrolname="corporationName"]',
      accountInfo.company_name
    )
    await page.fill(
      'input[formcontrolname="documentType"]',
      'Cert of Dissolution'
    )

    console.info('Uploading file buffer...')
    await page.evaluate(() => {
      const input: any = document.querySelector('input[type="file"]')
      if (input) input.value = ''
    })

    await page.setInputFiles('input[type="file"]', {
      name: `Certificate-of-Dissolution-${accountInfo.company_name}.pdf`,
      mimeType: 'application/pdf',
      buffer: certificateBuffer,
    })

    const formScreenshotBuffer = await takeFormScreenshot(
      page,
      accountInfo.company_name
    )
    await submitFormAndHandleModal(page)

    return formScreenshotBuffer
  } catch (error) {
    throw error
  }
}

async function takeFormScreenshot(page: any, companyName: string) {
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    let lastHeight = document.body.scrollHeight
    let currentHeight = 0

    while (currentHeight < lastHeight) {
      currentHeight += 100
      window.scrollTo(0, currentHeight)
    }

    window.scrollTo(0, 0)
  })

  return await page.screenshot({
    fullPage: true,
  })
}

async function submitFormAndHandleModal(page: any) {
  const continueButton = await page.waitForSelector(
    'button:has-text("Continue")',
    {
      state: 'visible',
      timeout: 30000,
    }
  )

  await continueButton.click()
  await page.waitForSelector('.k-dialog', { state: 'visible' })
  await page.click('.k-dialog .k-primary')
  await page.waitForNavigation({ waitUntil: 'networkidle' })
}

async function handlePaymentAndSubmission(page: any) {
  await page.selectOption(
    'select[formcontrolname="paymentType"]',
    PaymentType.CREDITCARD
  )

  await page.fill(
    'input[formcontrolname="cardNumber"]',
    process.env.DELAWARE_CARD_NUMBER!
  )
  await page.fill(
    'input[formcontrolname="cVVNumber"]',
    process.env.DELAWARE_CARD_CVV!
  )
  await page.selectOption(
    'select[formcontrolname="expirationMonth"]',
    process.env.DELAWARE_CARD_MONTH!
  )
  await page.selectOption(
    'select[formcontrolname="expirationYear"]',
    process.env.DELAWARE_CARD_YEAR!
  )

  await page.fill(
    'input[formcontrolname="firstName"]',
    process.env.DELAWARE_BILLING_FIRST_NAME!
  )
  await page.fill(
    'input[formcontrolname="lastName"]',
    process.env.DELAWARE_BILLING_LAST_NAME!
  )

  await page.fill(
    '[formgroupname="payment"] input[formcontrolname="address1"]',
    '44 Billing St'
  )
  await page.fill(
    '[formgroupname="payment"] input[formcontrolname="address2"]',
    'Addy 2'
  )
  await page.fill(
    '[formgroupname="payment"] input[formcontrolname="city"]',
    'City'
  )
  await page.selectOption(
    '[formgroupname="payment"] select[formcontrolname="stateId"]',
    '9'
  )
  await page.fill(
    '[formgroupname="payment"] input[formcontrolname="postalCode"]',
    '11111'
  )
  await page.selectOption(
    '[formgroupname="payment"] select[formcontrolname="countryId"]',
    '230'
  )
  await page.fill(
    '[formgroupname="payment"] input[formcontrolname="email"]',
    'jdaubert@simpleclosure.com'
  )
  await page.fill(
    '[formgroupname="payment"] kendo-maskedtextbox[formcontrolname="phone"] input',
    '12351234'
  )

  // Production
  // await page.fill('[formgroupname="payment"] input[formcontrolname="address1"]', '440 North Barranca Avenue')
  // await page.fill('[formgroupname="payment"] input[formcontrolname="address2"]', '7373')
  // await page.fill('[formgroupname="payment"] input[formcontrolname="city"]', 'Covina')
  // await page.selectOption('[formgroupname="payment"] select[formcontrolname="stateId"]', '9')
  // await page.fill('[formgroupname="payment"] input[formcontrolname="postalCode"]', '91723')
  // await page.selectOption('[formgroupname="payment"] select[formcontrolname="countryId"]', '230')
  // await page.fill('[formgroupname="payment"] input[formcontrolname="email"]', 'notices@simpleclosure.com')
  // await page.fill('[formgroupname="payment"] kendo-maskedtextbox[formcontrolname="phone"] input', '7024016434')

  await page.waitForTimeout(1000)
  await page.click('button[type="submit"].btn-primary')
  await page.waitForSelector(
    'p:has-text("Your request has been successfully submitted")'
  )
}

async function submitDelawareForm(
  accountId: string,
  stepId: string,
  task: any,
  relatedTask: any,
  relatedStep: any,
  phase: string
) {
  let lastError

  try {
    const { accountInfo, certificateBuffer, context, page, priority } =
      await initializeSubmission(accountId, relatedStep, relatedTask)

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.info(`Form submission attempt ${attempt}/${MAX_RETRIES}...`)

        const formScreenshotBuffer = await fillInitialDelawareForm(
          page,
          priority,
          accountInfo,
          certificateBuffer
        )

        await handlePaymentAndSubmission(page)
        console.info('Payment and submission handled')

        const serviceRequestNumber = await extractServiceRequestNumber(page)
        console.info('Extracted service request number:', serviceRequestNumber)

        await handleScreenshots(
          page,
          accountId,
          serviceRequestNumber,
          phase,
          task,
          formScreenshotBuffer
        )
        await context.close()
        console.info(
          `DE form submission successful for accountId: ${accountId}, taskId: ${task.taskId}, service request number: ${serviceRequestNumber}!`
        )
        await updateAccountRecords(
          accountId,
          serviceRequestNumber,
          stepId,
          task
        )

        return serviceRequestNumber
      } catch (error: any) {
        lastError = error
        console.error(`Attempt ${attempt} failed:`, error.message)

        const isRetryableError = RETRYABLE_ERROR_PATTERNS.some((pattern) =>
          error.message.includes(pattern)
        )

        if (!isRetryableError || attempt === MAX_RETRIES) {
          console.error(error)
          throw new Error(
            `Form not submitted after ${attempt} attempts. Last error: ${error.message}`
          )
        }

        const delayTime = RETRY_DELAY * attempt
        console.info(
          `Waiting ${delayTime / 1000} seconds before next attempt...`
        )
        await new Promise((resolve) => setTimeout(resolve, delayTime))
      }
    }
  } catch (error: any) {
    lastError = error
    console.error(`Attempt failed:`, error.message)

    const isRetryableError = RETRYABLE_ERROR_PATTERNS.some((pattern) =>
      error.message.includes(pattern)
    )

    if (!isRetryableError) {
      console.error(error)
      throw new Error(
        `Form not submitted after attempts. Last error: ${error.message}`
      )
    }

    const delayTime = RETRY_DELAY * MAX_RETRIES
    console.info(`Waiting ${delayTime / 1000} seconds before next attempt...`)
    await new Promise((resolve) => setTimeout(resolve, delayTime))
  }
}

async function handleScreenshots(
  page: any,
  accountId: string,
  serviceRequestNumber: string,
  phase: string,
  task: any,
  formScreenshotBuffer: Buffer
) {
  const successScreenshotBuffer = await page.screenshot({
    fullPage: true,
  })

  const storageRoute = `${phase}/${task.id}/Delaware-Dissolution`
  await Promise.all([
    uploadFile(accountId, `${storageRoute}-Form.png`, formScreenshotBuffer),
    uploadFile(
      accountId,
      `${storageRoute}-Success-${serviceRequestNumber}.png`,
      successScreenshotBuffer
    ),
  ])
}

async function updateAccountRecords(
  accountId: string,
  serviceRequestNumber: string,
  stepId: string,
  task: any
) {
  const dissolvedAt = Date.now()

  await Promise.all([
    setValueForAccount(accountId, 'details/operations', {
      de_dissolved_at: dissolvedAt,
    }),
    setTaskForAccount(accountId, task.id, {
      case_number: serviceRequestNumber,
      submission_status: SubmissionStatus.PENDING,
    }),
    setStateSubmission(
      SubmitType.DE_DISSOLUTION,
      serviceRequestNumber,
      accountId,
      stepId,
      SubmissionStatus.PENDING,
      task.id
    ),
  ])
}

enum DocumentPriorityOptions {
  OneHourService = '_1HourService',
  TwoHourService = '_2HourService',
  SameDayService = 'SameDayService',
  TwentyFourHourService = '_24HourService',
  NormalProcessing = 'NormalProcessing',
}

enum DocumentRequestType {
  None = '',
  DocumentFilingRequest = 'documentFilingRequest',
  CertificateRequest = 'certificateRequest',
}

enum PaymentType {
  CREDITCARD = 'CREDITCARD',
  ACH = 'ACH',
}

export enum SubmissionStatus {
  INITIAL = 'initial',
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum SubmitType {
  DE_DISSOLUTION = 'de_dissolution',
  FL_PAYROLL = 'fl_payroll',
}

export type PlanTask = {
  case_number: string
  submission_status: SubmissionStatus
}

export type TimelineEvent = {
  id?: number
  type: TimelineEventType
  actor: TimelineEventActor
  uid?: string | null
  recipient_id?: string | null
  file_url?: string
  created_at: number
}

export enum TimelineEventType {
  DOC_CREATED = 'doc_created',
  DOC_UPDATED = 'doc_updated',
  DOC_APPROVED = 'doc_approved',
  DOC_SIGNED = 'doc_signed',
  SENT_TO_RECIPIENTS = 'sent_to_recipients',
  PERSON_REMINDED = 'person_reminded',
  PERSON_VIEWED = 'person_viewed',
  PERSON_SIGNED = 'person_signed',
  PERSON_SENT = 'person_sent',
  PERSON_BOUNCED = 'person_bounced',
  PERSON_UPDATED = 'person_updated',
  CLASS_COMPLETE = 'class_complete',
  STEP_COMPLETE = 'step_complete',
}

export enum TimelineEventActor {
  SYSTEM = 'system',
  USER = 'user',
}
