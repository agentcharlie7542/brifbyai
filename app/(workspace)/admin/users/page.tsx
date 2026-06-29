import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/current-user';
import { listUsers, updateUser } from '@/lib/db/repositories/users';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function UsersAdminPage() {
  noStore();
  const current = await getCurrentUser();
  if (!current || current.role !== 'admin') notFound();

  const users = await listUsers();

  return (
    <main className="px-10 py-10">
      <h1 className="text-3xl font-bold tracking-tight">가입 신청 / 사용자 관리</h1>
      <p className="mt-2 text-sm text-muted-foreground">가입 요청을 승인하거나 사용자 정보를 편집합니다.</p>

      <div className="mt-6 overflow-hidden rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">이메일</th>
              <th className="px-4 py-2 font-medium">이름</th>
              <th className="px-4 py-2 font-medium">역할</th>
              <th className="px-4 py-2 font-medium">활성</th>
              <th className="px-4 py-2 font-medium">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className="align-top">
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">{u.name ?? '—'}</td>
                <td className="px-4 py-2">{u.role}</td>
                <td className="px-4 py-2">{u.isActive ? '예' : '아니오'}</td>
                <td className="px-4 py-2">
                  {!u.isActive ? (
                    <form action={`/api/admin/users/${u.id}/approve`} method="post">
                      <button type="submit" className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground">승인</button>
                    </form>
                  ) : (
                    <form action={`/api/admin/users/${u.id}/deactivate`} method="post">
                      <button type="submit" className="rounded border px-3 py-1 text-xs">비활성</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
