import Footer from '@/components/footer'
import Header from '@/components/header'
import CONST from '@/utils/constant'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <title>{CONST.SITE_NAME}</title>
          <meta charSet="UTF-8" />
          <meta name="description" content={CONST.DESCRIPTION} />
          <meta name="author" content="Growigh" />
          <meta name="owner" content="Growigh" />
          <meta
            name="viewport"
            content="width=device-width,initial-scale=1.0,maximum-scale=5.0"
          />

          <meta name="theme-color" content="#FEAD0B" />

          <meta property="og:locale" content="en" />
          <meta property="og:site_name" content={CONST.SITE_NAME} />
          <meta property="og:title" content={CONST.TITLE} />
          <meta property="og:type" content="website" />
          <meta
            property="og:image:alt"
            content={`Logo of ${CONST.SITE_NAME}`}
          />

          <meta property="og:image" content={`${CONST.SITE_URL}/logo.png`} />
          <meta property="og:url" content={CONST.SITE_URL} />
          <meta property="og:description" content={CONST.DESCRIPTION} />

          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:site" content="@wearegrowigh" />
          <meta name="twitter:creator" content="@wearegrowigh" />
          <meta name="twitter:title" content={CONST.TITLE} />
          <meta name="twitter:description" content={CONST.DESCRIPTION} />

          <meta name="twitter:image" content={`${CONST.SITE_URL}/logo.png`} />

          <meta name="apple-mobile-web-app-title" content={CONST.SITE_NAME} />
          <meta name="apple-mobile-web-app-status-bar-style" content="black" />
          <link
            rel="apple-touch-icon"
            sizes="180x180"
            href="/apple-touch-icon.png"
          />

          <link rel="icon" type="image/x-icon" href="/favicon.ico" />
          <link
            rel="icon"
            type="image/png"
            href="/favicon-96x96.png"
            sizes="96x96"
          />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="shortcut icon" href="/favicon.ico" />

          <link rel="manifest" href="/site.webmanifest" />
          <link rel="sitemap" href="/sitemap-index.xml" />
          <link rel="canonical" href={CONST.CANONICAL_URL} />

          {/* Google Analytics */}
          {CONST.GA_ID && (
            <>
              <script
                async
                src={`https://www.googletagmanager.com/gtag/js?id=${CONST.GA_ID}`}></script>
              <script
                dangerouslySetInnerHTML={{
                  __html: `
                                window.dataLayer = window.dataLayer || [];
                                function gtag(){dataLayer.push(arguments);}
                                gtag('js', new Date());
                                gtag('config', '${CONST.GA_ID}', {
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
