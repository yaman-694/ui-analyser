import { AnalyzeField } from '@/app/(home)/_components/analyze-field'
import { ChevronDown } from 'lucide-react'

export default function Hero() {
  return (
    <div className='flex flex-col items-center justify-center h-screen gap-4 text-center relative'>
        <h1 className='text-[44px] md:text-[54px] text-input font-heading text-balance'><span>Analyze any Website’s UI in</span> <br /> <span>Seconds for Free.</span></h1>
        <AnalyzeField />
        <ChevronDown className='absolute bottom-5 text-input'/>
    </div>
  )
}
