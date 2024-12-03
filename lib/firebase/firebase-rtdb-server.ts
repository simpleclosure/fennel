import {
  PlanTask,
  SubmissionStatus,
  SubmitType,
} from '../../app/api/submit/de-dissolution'
import { User } from '../types/global'
import { db } from './firebase-config'

function getUpdated() {
  return new Date().toLocaleDateString('en-GB', {
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
  })
}

export async function getVal(path: string) {
  const ref = db.ref(path)
  const snapshot = await ref.once('value')
  return snapshot.val() || {}
}

export async function setVal(path: string, value: object) {
  const ref = db.ref(path)
  return await ref.update(value)
}

export async function setValueForAccount(
  aid: string,
  path: string,
  value: any
) {
  const fullpath = `accounts/${aid}` + (path ? `/${path}` : '')
  return await setVal(fullpath, value)
}

export async function getGroupForStep(
  accountId: string,
  stepId: string
): Promise<{ [key: string]: any } | undefined> {
  const groups: { [key: string]: any } = await getVal(
    `accounts/${accountId}/plan/groups`
  )
  return Object.values(groups).find((group: any) =>
    group.step_ids.split(',').includes(stepId)
  )
}

export async function getInfoFromAccount(aid: string) {
  return await getVal(`accounts/${aid}/info`)
}

export async function getDetailsFromAccount(aid: string) {
  return await getVal(`accounts/${aid}/details`)
}

export async function getTableFromAccount(aid: string) {
  return await getVal(`accounts/${aid}/table`)
}

export async function getStepFromAccount(aid: string, stepId: string) {
  return {
    id: stepId,
    ...(await getVal(`accounts/${aid}/plan/steps/${stepId}`)),
  }
}

export async function getTaskFromAccount(aid: string, taskId: string) {
  return {
    id: taskId,
    ...(await getVal(`accounts/${aid}/plan/tasks/${taskId}`)),
  }
}

export async function setTaskForAccount(
  aid: string,
  taskId: string,
  fields: Partial<PlanTask>
) {
  const updated = getUpdated()
  const task = {
    ...fields,
    updated,
  }

  await setVal(`accounts/${aid}/plan/tasks/${taskId}`, task)
}

export async function updateStateSubmissionStatus(
  stateId: string,
  caseNumber: string,
  status: SubmissionStatus
) {
  return await setVal(`submits/${stateId}/${caseNumber}`, { status })
}

export async function setStateSubmission(
  stateId: SubmitType,
  caseNumber: string,
  accountId: string,
  stepId: string,
  status: SubmissionStatus,
  taskId?: string
) {
  return await setVal(`submits/${stateId}/${caseNumber}`, {
    accountId,
    stepId,
    status,
    taskId,
  })
}

export async function getUser(uid: string): Promise<User> {
  const user = await getVal('users/' + uid)
  user.id = uid
  user.name = `${user.first_name} ${user.last_name}`
  return user
}
