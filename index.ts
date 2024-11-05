import express, { Request, Response } from 'express'
import { chromium } from 'playwright'
import handler from './app/api/submit/de-dissolution'

const app = express()

app.use(express.json())

app.get('/', (req: Request, res: Response) => {
  res.send(`
    <html>
      <body>
        <h1>Hello ${process.env.NAME || 'World'}!</h1>
        <button onclick="submitDissolution()">Submit DE Dissolution</button>
        
        <script>
          async function submitDissolution() {
            try {
              const response = await fetch('/api/submit/de-dissolution', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  accountId: "arifactor-debug",
                  stepId: "cert",
                  taskId: "yrmx",
                  phase: "dissolution"
                })
              });
              
              const result = await response.json();
              alert(JSON.stringify(result, null, 2));
            } catch (error) {
              alert('Submission failed: ' + error);
            }
          }
        </script>
      </body>
    </html>
  `)
})

app.get('/run-test', async (req: Request, res: Response) => {
  try {
    const browser = await chromium.launch()
    const page = await browser.newPage()

    const serviceUrl = 'https://icis.corp.delaware.gov/eCorp/'
    await page.goto(serviceUrl)
    const title = await page.title()

    await browser.close()
    res.send(`Test completed successfully! Page title: ${title}`)
  } catch (error) {
    console.error('Browser test failed:', error)
    res.status(500).send(`Test failed: ${error}`)
  }
})

app.post('/api/submit/de-dissolution', async (req: Request, res: Response) => {
  try {
    const { accountId, stepId, taskId, phase } = req.body

    const result = await handler(req, res)
    res.json(result)
  } catch (error: any) {
    console.error('DE Dissolution submission failed:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

const port: number = parseInt(process.env.PORT || '8080')
const server = app.listen(port, () => {
  console.log(`helloworld: listening on port ${port}`)
})

export default app
