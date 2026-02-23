"use client";

import { useMemo } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";

function getUserRole(): "manager" | "reviewer" | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|;\s*)user_role=(\w+)/);
  return match ? (match[1] as "manager" | "reviewer") : undefined;
}

interface HeaderProps {
  projectId?: string;
  projectTitle?: string;
  title?: string;
}

export function Header({ projectId, projectTitle, title }: HeaderProps) {
  const userRole = useMemo(() => getUserRole(), []);

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6">
      {projectId && (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">ナビゲーション</SheetTitle>
            <Sidebar
              projectId={projectId}
              projectTitle={projectTitle}
              userRole={userRole}
            />
          </SheetContent>
        </Sheet>
      )}
      {title && <h1 className="text-lg font-semibold">{title}</h1>}
    </header>
  );
}
