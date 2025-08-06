import Background from '@/components/background'
import CheckSession from '@/components/check-session'
import type { Metadata } from 'next'
import { Suspense } from 'react'
  
export const metadata: Metadata = {
  title: 'Analyzing Website UI',
  description: 'A tool for analyzing user interfaces',
}
  
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <section className="min-h-screen w-full bg-amber-500">
      <Background />
      <div className='relative'>
        <Suspense fallback="...loading">
          <CheckSession>
            {children}
          </CheckSession>
        </Suspense>
      </div>
    </section>
  )
}