import Background from '@/components/background'
import type { Metadata } from 'next'
import { Suspense } from 'react'
  
export const metadata: Metadata = {
  title: 'Analyzing Websiter UI',
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
          {children}
        </Suspense>
        </div>
    </section>
  )
}