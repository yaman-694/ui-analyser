import Footer from '@/components/footer';
import Header from '@/components/header';
import {
  ClerkProvider,
} from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Toaster } from "react-hot-toast";
import './globals.css';

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
        <Footer />
        </body>
      </html>
    </ClerkProvider>
  )
}