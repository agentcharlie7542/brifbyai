'use client';

import { FileDown } from 'lucide-react';

/**
 * 시트를 PDF 로 저장/인쇄하는 버튼.
 *
 * 별도 서버 렌더링 없이 브라우저의 인쇄 → "PDF로 저장" 을 사용한다.
 * 화면에 이미 렌더된 시트 레이아웃을 그대로 PDF 로 출력하므로 텍스트가
 * 선택 가능한 고품질 PDF 가 만들어진다. 인쇄 시 사이드바·편집 버튼·제안
 * 생성 UI 등은 globals.css 의 @media print 규칙과 print:hidden 으로 숨겨진다.
 *
 * document.title 을 잠시 바꿔 Chrome 등의 기본 저장 파일명을 제어하고,
 * 인쇄 대화상자가 닫히면(afterprint) 원래 제목으로 되돌린다.
 */
export function SheetPdfButton({ fileName }: { fileName: string }) {
  function handlePrint() {
    const safeName =
      fileName
        .replace(/[\\/:*?"<>|]+/g, ' ') // 파일명 금지 문자 제거
        .replace(/\s+/g, ' ')
        .trim() || 'orient-sheet';

    const prevTitle = document.title;
    document.title = safeName;

    const restore = () => {
      document.title = prevTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);

    window.print();
  }

  return (
    <div className="mt-10 flex justify-center border-t pt-8 print:hidden">
      <button
        type="button"
        onClick={handlePrint}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow transition hover:opacity-90"
      >
        <FileDown className="h-4 w-4" />
        PDF로 저장 / 인쇄
      </button>
    </div>
  );
}
