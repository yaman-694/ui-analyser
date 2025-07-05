import SvgWaves from './waves'

export default function Background() {
  return (
    <div className='fixed inset-0 w-full h-screen overflow-hidden' id="background">
      <SvgWaves className="h-full" />
    </div>
  )
}

