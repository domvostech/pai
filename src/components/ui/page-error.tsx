interface Props {
  message?: string
}

export default function PageError({ message = 'Something went wrong.' }: Props) {
  return (
    <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {message}
    </div>
  )
}
