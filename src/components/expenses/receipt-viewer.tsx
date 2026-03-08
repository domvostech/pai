'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  path: string
}

export default function ReceiptViewer({ path }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const isPdf = path.endsWith('.pdf')

  useEffect(() => {
    const supabase = createClient()
    supabase.storage
      .from('receipts')
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (data) setUrl(data.signedUrl)
      })
      .finally(() => setLoading(false))
  }, [path])

  if (loading) return <div className="h-48 bg-gray-100 animate-pulse rounded" />
  if (!url) return <p className="text-sm text-gray-500">Could not load receipt.</p>

  return isPdf ? (
    <iframe src={url} className="w-full h-96 rounded border" title="Receipt" />
  ) : (
    <img src={url} alt="Receipt" className="max-w-full rounded border" />
  )
}
