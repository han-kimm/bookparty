import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-all overflow-hidden backdrop-blur-sm",
  {
    variants: {
      variant: {
        default:
          "bg-primary/15 text-primary border border-primary/25 [a&]:hover:bg-primary/25",
        secondary:
          "bg-violet-100/70 text-secondary-foreground border border-violet-300/60 [a&]:hover:bg-violet-200/70",
        destructive:
          "bg-destructive/15 text-destructive border border-destructive/25 [a&]:hover:bg-destructive/25",
        outline:
          "bg-violet-100/50 border border-violet-300/50 text-foreground [a&]:hover:bg-violet-200/60",
        ghost: "[a&]:hover:bg-violet-100/50 text-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
