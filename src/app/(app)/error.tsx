'use client'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4">
      <p className="text-gray-600">Something went wrong.</p>
      <Button variant="outline" onClick={reset}>Try again</Button>
    </div>
  )
}
