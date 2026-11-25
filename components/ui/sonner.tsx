"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// Below the status bar, which the home-screen app draws over the page; 24px and 16px are Sonner's own gaps.
const OFFSET = { top: "calc(env(safe-area-inset-top) + 24px)" }
const MOBILE_OFFSET = { top: "calc(env(safe-area-inset-top) + 16px)" }

const Toaster = ({ ...props }: ToasterProps) => {
  // Colours come from the theme tokens below, so the app's own theme switcher applies.
  return (
    <Sonner
      className="toaster group"
      offset={OFFSET}
      mobileOffset={MOBILE_OFFSET}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
