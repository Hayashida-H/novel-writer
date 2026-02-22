"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";

interface HeaderProps {
  projectId?: string;
  projectTitle?: string;
  title?: string;
}

export function Header({ projectId, projectTitle, title }: HeaderProps) {
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
            <Sidebar projectId={projectId} projectTitle={projectTitle} />
          </SheetContent>
        </Sheet>
      )}
      {title && <h1 className="text-lg font-semibold">{title}</h1>}
    </header>
  );
}
