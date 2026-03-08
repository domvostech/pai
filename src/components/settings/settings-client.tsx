'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Check } from 'lucide-react'

interface Props {
  inboundAddress: string | null
}

export default function SettingsClient({ inboundAddress }: Props) {
  const [copied, setCopied] = useState(false)

  async function copyAddress() {
    if (!inboundAddress) return
    await navigator.clipboard.writeText(inboundAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold mb-1">Receipt Forwarding Address</h2>
        <p className="text-sm text-gray-500 mb-3">
          Forward digital receipts or email receipts to this address. They will appear in your Inbox automatically.
          You can also set up automatic forwarding rules in your email client.
        </p>
        {inboundAddress ? (
          <div className="flex gap-2">
            <Input value={inboundAddress} readOnly className="font-mono text-sm" />
            <Button variant="outline" size="icon" onClick={copyAddress} title="Copy address">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-red-600">Could not generate inbound address. Please refresh.</p>
        )}
      </div>
    </div>
  )
}
