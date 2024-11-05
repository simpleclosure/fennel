import express from 'express'
import deDissolutionHandler from './app/api/submit/de-dissolution'
import { testRoute } from './app/api/testing/test'

const app = express()
app.use(express.json())

app.get('/api/test', testRoute)
app.post('/api/submit/de-dissolution', deDissolutionHandler)

const port = process.env.PORT || 8080
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})

export default app
