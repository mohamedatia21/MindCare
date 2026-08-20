import React from 'react';
import { BookOpen, ArrowSquareOut } from '@phosphor-icons/react';

export interface Source {
  title: string;
  url?: string;
  page?: string;
  sourceType?: 'CLINICAL' | 'ACADEMIC' | 'GUIDELINE' | 'GENERAL';
  origin?: 'BOOK_PRIMARY' | 'MCP_SEARCH' | 'GUIDELINE';
  snippet?: string;
}

interface SourceCitationProps {
  sources: Source[];
  language?: 'EGYPTIAN_ARABIC' | 'ENGLISH';
}

export function SourceCitation({ sources, language }: SourceCitationProps) {
  if (!sources || sources.length === 0) return null;

  const isArabic = language !== 'ENGLISH';

  const getBadgeLabel = (src: Source) => {
    if (src.origin === 'BOOK_PRIMARY') {
      return isArabic ? '📘 الكتاب المعتمد الأول' : '📘 Primary Reference Book';
    }
    if (src.origin === 'MCP_SEARCH') {
      return isArabic ? '🌐 بحث بروتوكول MCP' : '🌐 MCP Medical Search';
    }
    switch (src.sourceType) {
      case 'CLINICAL':
        return isArabic ? 'بروتوكول إكلينيكي' : 'Clinical Protocol';
      case 'ACADEMIC':
        return isArabic ? 'دراسة بحثية' : 'Academic Research';
      case 'GUIDELINE':
        return isArabic ? 'إرشادات معتمدة' : 'Clinical Guideline';
      default:
        return isArabic ? 'دليل إرشادي' : 'Reference';
    }
  };

  return (
    <div className="mc-source-citation">
      <div className="mc-source-header">
        <BookOpen size={15} weight="bold" />
        <span>{isArabic ? 'المصادر والكتب المعتمدة (RAG & MCP Protocol)' : 'Verified References & Books (RAG & MCP Protocol)'}</span>
      </div>
      <div className="mc-source-list">
        {sources.map((src, idx) => {
          const hasValidUrl = src.url && (src.url.startsWith('http://') || src.url.startsWith('https://'));
          const content = (
            <>
              <span className={`mc-source-type-badge ${src.origin === 'BOOK_PRIMARY' ? 'primary-book' : ''}`}>
                {getBadgeLabel(src)}
              </span>
              <span className="mc-source-title">{src.title}</span>
              {src.page && (
                <span className="mc-source-page-badge" title={src.page}>
                  {src.page.startsWith('ص') || src.page.startsWith('Page') ? src.page : `${isArabic ? 'ص' : 'p.'} ${src.page}`}
                </span>
              )}
              {hasValidUrl && <ArrowSquareOut size={13} weight="bold" className="mc-source-icon" />}
            </>
          );

          if (hasValidUrl) {
            return (
              <a
                key={idx}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mc-source-pill"
                title={src.snippet || src.title}
              >
                {content}
              </a>
            );
          }

          return (
            <div
              key={idx}
              className="mc-source-pill mc-source-pill-static"
              title={src.snippet || src.title}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

