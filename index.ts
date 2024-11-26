import express from 'express'
import deDissolutionHandler from './app/api/submit/de-dissolution'

const app = express()
app.use(express.json())

app.post('/api/submit/de-dissolution', deDissolutionHandler)

const port = process.env.PORT || 8080
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})

export default app
