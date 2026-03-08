const USABLE_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
const MIN_BODY_LENGTH = 20

export function extractTokenFromEmail(toAddress: string, inboundDomain: string): string | null {
  if (!toAddress) return null
  const escaped = inboundDomain.replace(/\./g, '\\.')
  const match = toAddress.match(new RegExp(`^([a-f0-9]+)@${escaped}$`, 'i'))
  return match ? match[1].toLowerCase() : null
}

export function hasUsableContent({
  attachments,
  textBody,
  htmlBody,
}: {
  attachments: Array<{ ContentType: string }>
  textBody?: string
  htmlBody?: string
}): boolean {
  const hasUsableAttachment = attachments.some(a =>
    USABLE_ATTACHMENT_TYPES.includes(a.ContentType)
  )
  if (hasUsableAttachment) return true

  const body = textBody ?? htmlBody ?? ''
  return body.trim().length >= MIN_BODY_LENGTH
}
