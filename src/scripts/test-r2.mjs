import { randomUUID } from 'node:crypto'
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

const requiredNames = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_ENDPOINT',
  'R2_BUCKET',
  'R2_PUBLIC_URL',
]
for (const name of requiredNames) {
  if (!String(process.env[name] || '').trim()) {
    console.error(`Missing required environment variable: ${name}`)
    process.exit(1)
  }
}

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})
const body = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)
const key = `uploads/diagnostics/script/${Date.now()}-${randomUUID()}-test.png`

try {
  console.log(`Testing bucket ${process.env.R2_BUCKET} at ${process.env.R2_ENDPOINT}`)
  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: 'image/png',
  }))
  const object = await client.send(new HeadObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
  }))
  if (Number(object.ContentLength) !== body.byteLength) {
    throw new Error(`Size mismatch: expected ${body.byteLength}, received ${object.ContentLength}`)
  }
  console.log('PASS: upload and HEAD verification succeeded')
  console.log(`${String(process.env.R2_PUBLIC_URL).replace(/\/+$/, '')}/${key}`)
} catch (error) {
  console.error('FAIL:', error?.name || 'Error', error?.message || error)
  process.exitCode = 1
} finally {
  try {
    await client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }))
    console.log('Cleanup complete')
  } catch (error) {
    console.error('Cleanup failed:', error?.message || error)
    process.exitCode = 1
  }
}
