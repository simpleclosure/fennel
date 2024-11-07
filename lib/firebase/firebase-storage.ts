import { getDownloadURL } from 'firebase-admin/storage'
import { storage } from './firebase-config'
import { getGroupForStep } from './firebase-rtdb-server'

export const FILES_PREFIX = '/files'

export function shortenPublicUrl(url: string) {
  const pos = url.lastIndexOf('/')
  return `${FILES_PREFIX}${url.slice(pos)}`
}

async function downloadLink(file: any) {
  const url = await getDownloadURL(file)
  return shortenPublicUrl(url)
}

async function getRouteForTask(
  accountId: string,
  stepId: string,
  taskId: string
): Promise<string> {
  const group = await getGroupForStep(accountId, stepId)
  if (!group)
    throw new Error(
      `Could not generate route for accountId: ${accountId}, stepId: ${stepId} and task: ${taskId}`
    )
  return `accounts/${accountId}${group.route}/${taskId}`
}

export async function uploadFile(
  account_id: string,
  stepId: string,
  taskId: string,
  fileName: string,
  buffer: any
) {
  const route = await getRouteForTask(account_id, stepId, taskId)
  const file = storage
    .bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
    .file(`${route}/${fileName}`)

  await file.save(buffer, { metadata: { metadata: { admin: 'admin' } } })
  return await downloadLink(file)
}

export async function getDownloadUrl(fileUrl: string): Promise<string> {
  try {
    const cleanedUrl = decodeURIComponent(
      fileUrl
        .replace(/^\/files\//, '')
        .replace(/%2F/g, '/')
        .split('?')[0]
    )
    const file = storage
      .bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
      .file(cleanedUrl)
    console.log('Getting download URL for', fileUrl, '->', cleanedUrl)
    return await getDownloadURL(file)
  } catch (error) {
    throw new Error('Failed to get download URL')
  }
}
