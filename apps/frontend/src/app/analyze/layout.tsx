import type { Metadata } from 'next'
  
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
        {children}
    </section>
  )
}