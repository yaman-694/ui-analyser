import Description from '@/components/description'
import Footer from '@/components/footer'
import Hero from '@/components/hero'

export default function page() {
  return (
    <div className='container mx-auto px-4'>
      <Hero />
      <Description />
      <Footer />
    </div>
  )
}
