'use client'
import { useRouter } from 'next/navigation'
import ProjectForm from './project-form'

export default function NewProjectButton() {
  const router = useRouter()
  return <ProjectForm onSuccess={() => router.refresh()} />
}
