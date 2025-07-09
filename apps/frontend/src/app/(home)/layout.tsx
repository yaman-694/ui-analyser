import Background from '@/components/background'
import type { Metadata } from 'next'
  
export const metadata: Metadata = {
  title: 'UI Analyser',
  description: 'A tool for analyzing user interfaces',
}
  
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <section className=" min-h-screen w-full">
      <Background />
      <div className="relative">
        {children}
      </div>
    </section>
  )
}