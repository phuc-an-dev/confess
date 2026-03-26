import { Loader2 } from 'lucide-react'

export default function Button({ 
  children, 
  onClick, 
  isLoading = false, 
  disabled = false, 
  className = '', 
  type = 'button',
  variant = 'primary' // primary, secondary, danger, ghost
}) {
  const baseStyles = "relative font-black uppercase tracking-widest border-4 border-black transition-all active:translate-y-0.5 active:translate-x-0.5 active:shadow-none disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 px-6 py-3"
  
  const variants = {
    primary: "bg-black text-white hover:bg-white hover:text-black shadow-[4px_4px_0_0_#000]",
    secondary: "bg-white text-black hover:bg-gray-100 shadow-[4px_4px_0_0_#000]",
    danger: "bg-red-500 text-white hover:bg-white hover:text-red-500 shadow-[4px_4px_0_0_#000]",
    ghost: "border-transparent bg-transparent hover:bg-black/5 shadow-none"
  }

  const variantStyles = variants[variant] || variants.primary

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variantStyles} ${className}`}
    >
      {isLoading && <Loader2 size={20} className="animate-spin" />}
      <span className={`${isLoading ? "opacity-0" : "opacity-100"} flex items-center justify-center gap-2`}>
        {children}
      </span>
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center font-black">
          WAIT...
        </span>
      )}
    </button>
  )
}
