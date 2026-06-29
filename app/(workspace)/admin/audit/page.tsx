import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/current-user';
import { listAuditLogs } from '@/lib/db/repositories/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const ACTION_LABEL: Record<string, string> = {
  login: '로그인',
  login_failed: '로그인 실패',
  logout: '로그아웃',
  upload_pdf: 'PDF 업로드',
  delete_reference_sheet: '학습 PDF 삭제',
  qoo10_import: 'Qoo10 가져오기',
  generate_sheet: '시트 생성',
  update_sheet: '시트 수정',
  delete_sheet: '시트 삭제',
  create_brand: '브랜드 생성',
  update_brand: '브랜드 수정',
  create_user: '유저 생성',
  update_user: '유저 수정',
};

const ACTION_FILTERS = [
  '',
  'login',
  'login_failed',
  'upload_pdf',
  'generate_sheet',
  'update_sheet',
];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { action?: string };
}) {
  noStore();
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') notFound();

  const action = searchParams.action || undefined;
  const logs = await listAuditLogs({ action, limit: 300 });

  return (
    <main className="px-10 py-10">
      <h1 className="text-3xl font-bold tracking-tight">감사 로그</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        로그인 및 데이터 변경 활동 기록 · 최근 {logs.length}건
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {ACTION_FILTERS.map((a) => (
          <a
            key={a || 'all'}
            href={a ? `/admin/audit?action=${a}` : '/admin/audit'}
            className={
              (action ?? '') === a
                ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                : 'rounded-full border border-input px-3 py-1 text-xs text-muted-foreground hover:bg-accent'
            }
          >
            {a ? (ACTION_LABEL[a] ?? a) : '전체'}
          </a>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">시각</th>
              <th className="px-4 py-2 font-medium">사용자</th>
              <th className="px-4 py-2 font-medium">행동</th>
              <th className="px-4 py-2 font-medium">대상</th>
              <th className="px-4 py-2 font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  기록이 없습니다.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                    {new Date(l.createdAt).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-2">
                    {l.userName || l.userEmail || (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {l.userEmail && l.userName ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {l.userEmail}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    <ActionBadge action={l.action} />
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {l.entityType ? (
                      <>
                        {l.entityType}
                        {l.entityId ? `:${l.entityId.slice(0, 8)}` : ''}
                      </>
                    ) : l.metadata && Object.keys(l.metadata).length > 0 ? (
                      <code className="break-all">
                        {JSON.stringify(l.metadata)}
                      </code>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                    {l.ip ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function ActionBadge({ action }: { action: string }) {
  const danger = action === 'login_failed' || action.startsWith('delete');
  const label = ACTION_LABEL[action] ?? action;
  return (
    <span
      className={
        danger
          ? 'inline-flex rounded px-1.5 py-0.5 text-xs font-medium text-yakkihou-ng'
          : 'inline-flex rounded px-1.5 py-0.5 text-xs font-medium'
      }
    >
      {label}
    </span>
  );
}
