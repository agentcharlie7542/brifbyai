import { BrandSidebar } from '@/components/brand-sidebar';
import { listBrands } from '@/lib/db/repositories/brands';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [brands, user] = await Promise.all([listBrands(), getCurrentUser()]);
  return (
    <div className="flex min-h-screen">
      <BrandSidebar
        brands={brands.map((b) => ({
          id: b.id,
          name: b.name,
          nameJa: b.nameJa,
        }))}
        user={
          user
            ? { email: user.email, name: user.name, role: user.role }
            : null
        }
      />
      <div className="flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
