import express from 'express'
import deDissolutionHandler from './app/api/submit/de-dissolution'
import deFranchiseTaxHandler from './app/api/submit/de-franchise-tax'
const app = express()
app.use(express.json())

app.post('/api/submit/de-dissolution', deDissolutionHandler)
app.post('/api/submit/de-franchise-tax', deFranchiseTaxHandler)

const port = process.env.PORT || 8080
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})

export default app
