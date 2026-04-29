"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { MoreVertical, User, Settings, Archive, LogOut, Bug, MessageSquare } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL = "support@floop.design";

export function DashboardNavActions() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild aria-label="Open menu">
        <Button variant="outline" size="icon" className="size-9 bg-background">
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href="/dashboard/profile" className="flex items-center gap-2">
            <User className="size-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings" className="flex items-center gap-2">
            <Settings className="size-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Report error or bug`}
            className="flex items-center gap-2"
          >
            <Bug className="size-4" />
            Report error and bugs
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Feedback`}
            className="flex items-center gap-2"
          >
            <MessageSquare className="size-4" />
            Give feedback
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/archived" className="flex items-center gap-2">
            <Archive className="size-4" />
            Archived websites
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <button
            type="button"
            className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="size-4" />
            Log out
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
