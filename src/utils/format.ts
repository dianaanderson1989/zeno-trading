import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(value: number, decimals = 2): string {
  if (value >= 1) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)
  }
  // For small values like ADA, show more decimals
  return '$' + value.toFixed(6)
}

export function formatNumber(value: number, decimals = 4): string {
  if (value === 0) return '0'
  if (value >= 1000) return new Intl.NumberFormat('en-US').format(Math.round(value))
  return value.toFixed(decimals)
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function getChangeColor(value: number): string {
  if (value > 0) return 'text-brand-400'
  if (value < 0) return 'text-red-400'
  return 'text-gray-400'
}

export function getChangeBg(value: number): string {
  if (value > 0) return 'bg-brand-500/10 text-brand-400'
  if (value < 0) return 'bg-red-500/10 text-red-400'
  return 'bg-gray-500/10 text-gray-400'
}
