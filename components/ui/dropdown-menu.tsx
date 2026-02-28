"use client";

import * as React from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuTriggerPrimitive = DropdownMenuPrimitive.Trigger;
const DropdownMenuContentPrimitive = DropdownMenuPrimitive.Content;
const DropdownMenuItemPrimitive = DropdownMenuPrimitive.Item;
const DropdownMenuLabelPrimitive = DropdownMenuPrimitive.Label;
const DropdownMenuSeparatorPrimitive = DropdownMenuPrimitive.Separator;

function DropdownMenuTriggerStyled({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuTriggerPrimitive>) {
  return (
    <DropdownMenuTriggerPrimitive
      className={cn(
        "flex size-9 items-center justify-center rounded-md border border-input bg-background text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuContentStyled({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuContentPrimitive>) {
  return (
    <DropdownMenuContentPrimitive
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[10rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuItemStyled({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuItemPrimitive>) {
  return (
    <DropdownMenuItemPrimitive
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuLabelStyled({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuLabelPrimitive>) {
  return (
    <DropdownMenuLabelPrimitive
      className={cn("px-2 py-1.5 text-sm font-semibold", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparatorStyled({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuSeparatorPrimitive>) {
  return (
    <DropdownMenuSeparatorPrimitive
      className={cn("-mx-1 my-1 h-px bg-muted", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTriggerStyled as DropdownMenuTrigger,
  DropdownMenuContentStyled as DropdownMenuContent,
  DropdownMenuItemStyled as DropdownMenuItem,
  DropdownMenuLabelStyled as DropdownMenuLabel,
  DropdownMenuSeparatorStyled as DropdownMenuSeparator,
  DropdownMenuPortal,
};
