export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div>
      <h1 className="text-2xl font-bold">Project Detail</h1>
      <p className="text-sm text-gray-500 mt-1">ID: {id}</p>
    </div>
  )
}
