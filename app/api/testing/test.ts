import { Request, Response } from 'express'
import { submitDelawareForm } from '../submit/de-dissolution'

export const testRoute = async (req: Request, res: Response) => {
  console.log('Hello world')
  console.log('Incoming request headers:', req.headers)
  const serviceRequestNumber = await submitDelawareForm(
    'aaaa',
    'cert',
    'xktr',
    'vrnl',
    'ldzu',
    'dissolution'
  )

  return res.status(200).json({
    success: true,
    message: 'Dissolution form submitted successfully',
    data: {
      serviceRequestNumber,
    },
  })
}
