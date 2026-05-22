import { BrandSidebar } from '@/components/brand-sidebar';
import { listBrands } from '@/lib/db/repositories/brands';

export const dynamic = 'force-dynamic';

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const brands = await listBrands();
  return (
    <div className="flex min-h-screen">
      <BrandSidebar
        brands={brands.map((b) => ({
          id: b.id,
          name: b.name,
          nameJa: b.nameJa,
        }))}
      />
      <div className="flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
