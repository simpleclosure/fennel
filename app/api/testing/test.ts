import { Request, Response } from 'express'

export const testRoute = (req: Request, res: Response) => {
  console.log('Hello world')
  console.log('Incoming request headers:', req.headers)

  res.status(200).json({ message: 'Hello collard' })
}
