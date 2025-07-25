import Link from 'next/link'
import React from 'react'

export default function Footer() {
  return (
    <div className='text-input flex items-center justify-center flex-col mt-40 mb-20 font-body relative'>
      <p>Build with love by <Link target='_blank' className='font-growigh' href="https://growigh.com">Growigh</Link></p>
    </div>
  )
}
