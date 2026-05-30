'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  FileText,
  LayoutDashboard,
  Library,
  ListChecks,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Brand } from '@/db/schema';

interface SidebarUser {
  email: string;
  name?: string;
  role: 'admin' | 'editor' | 'viewer';
}

export function BrandSidebar({
  brands,
  user,
}: {
  brands: Pick<Brand, 'id' | 'name' | 'nameJa'>[];
  user?: SidebarUser | null;
}) {
  const pathname = usePathname();
  const match = pathname.match(/^\/brands\/([^\/]+)/);
  const candidate = match?.[1];
  const activeBrandId =
    candidate && candidate !== 'new' ? candidate : undefined;
  const activeBrand = brands.find((b) => b.id === activeBrandId);

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r bg-muted/30">
      <div className="border-b px-4 py-4">
        <Link href="/brands" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">brifbyai</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              v0.1
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 text-sm">
        <SidebarSection label="Workspace">
          <SidebarLink
            href="/brands"
            icon={<Building2 className="h-4 w-4" />}
            active={pathname === '/brands'}
          >
            모든 브랜드
          </SidebarLink>
          <SidebarLink
            href="/brands/new"
            icon={<Plus className="h-4 w-4" />}
            active={pathname === '/brands/new'}
          >
            새 브랜드 추가
          </SidebarLink>
        </SidebarSection>

        <SidebarSection label="브랜드">
          {brands.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              아직 브랜드가 없습니다
            </p>
          ) : (
            <ul className="space-y-0.5">
              {brands.map((brand) => {
                const isActive = brand.id === activeBrandId;
                return (
                  <li key={brand.id}>
                    <Link
                      href={`/brands/${brand.id}`}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                        isActive
                          ? 'bg-background font-medium shadow-sm'
                          : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {brand.name.slice(0, 1)}
                      </span>
                      <span className="truncate">{brand.name}</span>
                    </Link>
                    {isActive ? (
                      <ul className="ml-6 mt-1 space-y-0.5 border-l pl-2">
                        <SidebarSubLink
                          href={`/brands/${brand.id}`}
                          icon={<LayoutDashboard className="h-3.5 w-3.5" />}
                          active={pathname === `/brands/${brand.id}`}
                        >
                          대시보드
                        </SidebarSubLink>
                        <SidebarSubLink
                          href={`/brands/${brand.id}/new`}
                          icon={<Sparkles className="h-3.5 w-3.5" />}
                          active={pathname.startsWith(`/brands/${brand.id}/new`)}
                        >
                          새 시트 만들기
                        </SidebarSubLink>
                        <SidebarSubLink
                          href={`/brands/${brand.id}/sheets`}
                          icon={<FileText className="h-3.5 w-3.5" />}
                          active={pathname.startsWith(
                            `/brands/${brand.id}/sheets`
                          )}
                        >
                          시트 목록
                        </SidebarSubLink>
                        <SidebarSubLink
                          href={`/brands/${brand.id}/influencers`}
                          icon={<Users className="h-3.5 w-3.5" />}
                          active={pathname.startsWith(
                            `/brands/${brand.id}/influencers`
                          )}
                        >
                          인플루언서
                        </SidebarSubLink>
                        <SidebarSubLink
                          href={`/brands/${brand.id}/library`}
                          icon={<Library className="h-3.5 w-3.5" />}
                          active={pathname.startsWith(
                            `/brands/${brand.id}/library`
                          )}
                        >
                          학습 PDF
                        </SidebarSubLink>
                        <SidebarSubLink
                          href={`/brands/${brand.id}/settings`}
                          icon={<Settings className="h-3.5 w-3.5" />}
                          active={pathname.startsWith(
                            `/brands/${brand.id}/settings`
                          )}
                        >
                          설정
                        </SidebarSubLink>
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </SidebarSection>

        <SidebarSection label="Tools">
          <SidebarLink
            href="/validate"
            icon={<ShieldCheck className="h-4 w-4" />}
            active={pathname.startsWith('/validate')}
          >
            약기법 플레이그라운드
          </SidebarLink>
          {user?.role === 'admin' ? (
            <SidebarLink
              href="/admin/audit"
              icon={<ListChecks className="h-4 w-4" />}
              active={pathname.startsWith('/admin/audit')}
            >
              감사 로그
            </SidebarLink>
          ) : null}
        </SidebarSection>
      </nav>

      {activeBrand ? (
        <div className="border-t px-4 py-3 text-xs">
          <p className="text-muted-foreground">현재 작업 중</p>
          <p className="mt-0.5 font-medium">{activeBrand.name}</p>
          {activeBrand.nameJa ? (
            <p className="text-muted-foreground">{activeBrand.nameJa}</p>
          ) : null}
        </div>
      ) : null}

      {user ? (
        <div className="border-t px-4 py-3">
          <p className="truncate text-xs font-medium">
            {user.name || user.email}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {user.email} · {user.role}
          </p>
          <form action="/api/auth/logout" method="post" className="mt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-3 w-3" />
              로그아웃
            </button>
          </form>
        </div>
      ) : null}
    </aside>
  );
}

function SidebarSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function SidebarLink({
  href,
  icon,
  active,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
        active
          ? 'bg-background font-medium shadow-sm'
          : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

function SidebarSubLink({
  href,
  icon,
  active,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors',
          active
            ? 'bg-background font-medium shadow-sm'
            : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
        )}
      >
        {icon}
        {children}
      </Link>
    </li>
  );
}
