import { Request, Response } from 'express'
import {
  getStepFromAccount,
  getTaskFromAccount,
} from '../../../lib/firebase/firebase-rtdb-server'
import { submitDelawareForm } from '../submit/de-dissolution'

export const testRoute = async (req: Request, res: Response) => {
  const accountId = 'aaaa'
  const taskId = 'xktr'
  console.log('Hello world')
  console.log('Incoming request headers:', req.headers)
  const task = await getTaskFromAccount(accountId, taskId)
  if (!task) {
    throw new Error(`Task not found for ID: ${taskId}`)
  }
  console.log('Task found:', task)

  const relatedTaskId = task.related_task
  const relatedStepId = task.related_step

  if (!relatedTaskId || !relatedStepId) {
    console.error('Related task or step information missing from task data')
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
    'cert',
    task,
    relatedTask,
    relatedStep,
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
