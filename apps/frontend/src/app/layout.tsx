import Header from '@/components/header'
import {
  ClerkProvider,
} from '@clerk/nextjs'
import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from "react-hot-toast";

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
    <ClerkProvider>
      <html lang="en">
        <body className={`antialiased font-body`}>
          <Header />
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  )
}