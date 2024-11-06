import { getDownloadURL } from 'firebase-admin/storage'
import { storage } from './firebase-config'

export const FILES_PREFIX = '/files'

export function shortenPublicUrl(url: string) {
  const pos = url.lastIndexOf('/')
  return `${FILES_PREFIX}${url.slice(pos)}`
}

async function downloadLink(file: any) {
  const url = await getDownloadURL(file)
  return shortenPublicUrl(url)
}

export async function uploadFile(
  account_id: string,
  path: string,
  buffer: any
) {
  const fullpath = `accounts/${account_id}/${path}`
  const file = storage
    .bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
    .file(fullpath)

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
