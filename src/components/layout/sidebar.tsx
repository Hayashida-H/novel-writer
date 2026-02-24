"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  MessageSquare,
  Map,
  Users,
  Globe,
  GitBranch,
  PenTool,
  Eye,
  Bot,
  Download,
  ChevronLeft,
  BookText,
  ListTree,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SidebarProps {
  projectId: string;
  projectTitle?: string;
  userRole?: "manager" | "reviewer";
}

const navItems = [
  {
    group: "準備",
    items: [
      { href: "prepare/chat", label: "チャット", icon: MessageSquare },
      { href: "prepare/plot", label: "プロット", icon: Map },
      { href: "prepare/characters", label: "登場人物", icon: Users },
      { href: "prepare/world", label: "世界観", icon: Globe },
      { href: "prepare/foreshadowing", label: "伏線管理", icon: GitBranch },
      { href: "prepare/glossary", label: "用語集", icon: BookText },
      { href: "prepare/structure", label: "構成", icon: ListTree },
    ],
  },
  {
    group: "執筆",
    items: [
      { href: "write", label: "執筆", icon: PenTool },
      { href: "review", label: "レビュー", icon: Eye },
    ],
  },
  {
    group: "チェック",
    items: [
      { href: "prepare/consistency", label: "整合性チェック", icon: ShieldCheck },
    ],
  },
  {
    group: "設定",
    items: [
      { href: "agents", label: "エージェント", icon: Bot },
      { href: "export", label: "エクスポート", icon: Download },
    ],
  },
];

const reviewerNavItems = [
  {
    group: "レビュー",
    items: [{ href: "review", label: "レビュー", icon: Eye }],
  },
];

export function Sidebar({ projectId, projectTitle, userRole }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const basePath = `/p/${projectId}`;
  const items = userRole === "reviewer" ? reviewerNavItems : navItems;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Link
          href={userRole === "reviewer" ? "/reviewer" : "/"}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <Link href={basePath} className="flex items-center gap-2 truncate">
          <BookOpen className="h-5 w-5 shrink-0" />
          <span className="truncate font-medium text-sm">
            {projectTitle || "プロジェクト"}
          </span>
        </Link>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        {items.map((group) => (
          <div key={group.group} className="mb-4">
            <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">
              {group.group}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const fullHref = `${basePath}/${item.href}`;
                const isActive = pathname.startsWith(fullHref);
                return (
                  <Button
                    key={item.href}
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "w-full justify-start gap-2",
                      isActive && "font-medium"
                    )}
                    asChild
                  >
                    <Link href={fullHref}>
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </ScrollArea>

      <div className="border-t p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          ログアウト
        </Button>
      </div>
    </aside>
  );
}
