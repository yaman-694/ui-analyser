import Footer from '@/components/footer'
import Header from '@/components/header'
import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import Script from 'next/script'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'UI Analyser',
  description: 'A tool for analyzing user interfaces'
}

const GA_ID = 'G-T8VDM4N602'

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>

          {/* Google Analytics */}
          {GA_ID && (
            <>
              <script
                async
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}></script>
              <script
                dangerouslySetInnerHTML={{
                  __html: `
                                window.dataLayer = window.dataLayer || [];
                                function gtag(){dataLayer.push(arguments);}
                                gtag('js', new Date());
                                gtag('config', '${GA_ID}', {
                                    page_path: window.location.pathname,
                                });
                            `
                }}
              />
            </>
          )}
        </head>
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
