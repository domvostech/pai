export function getReceiptStoragePath(userId: string, expenseId: string, extension: string): string {
  return `${userId}/${expenseId}.${extension.toLowerCase()}`
}

export function shouldCompressAsImage(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

export const IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 0.3,
  maxWidthOrHeight: 1500,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
  initialQuality: 0.8,
}
