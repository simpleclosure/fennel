import admin, { AppOptions } from 'firebase-admin'
import { cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const config = {
  credential: {},
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
} as AppOptions
const base64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64
const serviceAccount = JSON.parse(atob(base64!))
config.credential = cert(serviceAccount)

const app = admin.apps[0] || admin.initializeApp(config, 'admin-auth')
export const auth = getAuth(app)
export const db = app.database()
export const storage = app.storage()
