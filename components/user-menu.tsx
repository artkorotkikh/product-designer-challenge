'use client'

import * as React from 'react'
import { User, ChevronDown, Wallet } from 'lucide-react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { cn } from '@/lib/utils'

export function UserMenu() {
  const [isOpen, setIsOpen] = React.useState(false)

  React.useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('[data-user-menu]')) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative" data-user-menu>
      {/* User Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary to-arrakis-blue border-2 border-background hover:opacity-90 transition-opacity cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
        aria-label="User menu"
      >
        <User className="w-6 h-6 text-primary-foreground" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border/40 bg-popover shadow-lg z-50 overflow-hidden">
          <div className="p-2">
            {/* Demo User Info */}
            <div className="px-3 py-2 mb-2 border-b border-border/40">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-arrakis-blue flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">Demo User</p>
                  <p className="text-xs text-muted-foreground truncate">Not connected</p>
                </div>
              </div>
            </div>

            {/* Connect Wallet Button */}
            <div className="px-1">
              <div className="[&>button]:w-full [&>button]:justify-center">
                <ConnectButton />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

