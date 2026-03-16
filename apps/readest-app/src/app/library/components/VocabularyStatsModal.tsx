import clsx from 'clsx';
import React from 'react';
import { MdClose } from 'react-icons/md';
import { Book } from '@/types/book';
import { useTranslation } from '@/hooks/useTranslation';
import { VocabularyStatsResult } from '@/utils/vocabularyStats';

interface VocabularyStatsModalProps {
  book: Book;
  loading: boolean;
  error: string | null;
  stats: VocabularyStatsResult | null;
  onClose: () => void;
  onRetry: () => void;
}

const VocabularyStatsModal: React.FC<VocabularyStatsModalProps> = ({
  book,
  loading,
  error,
  stats,
  onClose,
  onRetry,
}) => {
  const _ = useTranslation();
  const ratioPercent = Math.round((stats?.vocabularyRatio || 0) * 100);

  return (
    <div className='modal-box bg-base-100 max-h-[88vh] w-[94vw] max-w-[540px] rounded-2xl p-0 shadow-2xl'>
      <div className='from-primary/10 to-secondary/10 border-base-300 border-b bg-gradient-to-r px-5 py-4'>
        <div className='flex items-start justify-between gap-4'>
          <div className='min-w-0'>
            <h2 className='line-clamp-2 text-lg font-semibold'>{book.title}</h2>
            <p className='text-base-content/65 mt-1 text-xs'>{_('Vocabulary Statistics')}</p>
          </div>
          <button
            type='button'
            className='btn btn-ghost btn-circle h-8 min-h-8 w-8'
            aria-label={_('Close')}
            onClick={onClose}
          >
            <MdClose size={18} />
          </button>
        </div>
      </div>

      <div className='space-y-5 p-5'>
        {loading && (
          <div className='space-y-3 py-6 text-center'>
            <span className='loading loading-dots loading-md' />
            <p className='text-base-content/70 text-sm'>{_('Analyzing words...')}</p>
          </div>
        )}

        {!loading && error && (
          <div className='space-y-3 py-4 text-center'>
            <p className='text-error text-sm'>{error}</p>
            <button type='button' className='btn btn-sm' onClick={onRetry}>
              {_('Retry')}
            </button>
          </div>
        )}

        {!loading && !error && stats && (
          <>
            <div className='grid grid-cols-2 gap-3'>
              <div className='bg-base-200/70 rounded-xl p-4 text-center'>
                <p className='text-base-content/65 text-xs'>{_('Vocabulary Types')}</p>
                <p className='mt-1 text-2xl font-semibold'>{stats.vocabularyCount.toLocaleString()}</p>
              </div>
              <div className='bg-base-200/70 rounded-xl p-4 text-center'>
                <p className='text-base-content/65 text-xs'>{_('Total Words')}</p>
                <p className='mt-1 text-2xl font-semibold'>{stats.wordCount.toLocaleString()}</p>
              </div>
            </div>

            <div className='bg-base-200/50 rounded-xl p-4'>
              <div className='mx-auto flex w-full max-w-[220px] items-center justify-center gap-4'>
                <div
                  className='relative h-20 w-20 rounded-full transition-all duration-500'
                  style={{
                    background: `conic-gradient(#22c55e ${ratioPercent * 3.6}deg, rgba(148, 163, 184, 0.35) 0deg)`,
                  }}
                >
                  <div className='bg-base-100 absolute inset-[7px] flex items-center justify-center rounded-full text-xs font-semibold'>
                    {ratioPercent}%
                  </div>
                </div>
                <div className='min-w-0'>
                  <p className='text-base-content/70 text-xs'>{_('Type/Token Ratio')}</p>
                  <p className='text-sm font-medium'>
                    {_('{{types}} / {{words}}', {
                      types: stats.vocabularyCount.toLocaleString(),
                      words: stats.wordCount.toLocaleString(),
                    })}
                  </p>
                </div>
              </div>
            </div>

            <div className='space-y-2'>
              <p className='text-base-content/75 text-xs font-medium'>{_('Top Words')}</p>
              {stats.topWords.length > 0 ? (
                <div className='space-y-2'>
                  {stats.topWords.map((entry, index) => {
                    const barWidth =
                      stats.topWords[0]?.count
                        ? Math.max(8, Math.round((entry.count / stats.topWords[0].count) * 100))
                        : 0;
                    return (
                      <div key={`${entry.word}-${index}`} className='space-y-1'>
                        <div className='flex items-center justify-between gap-2 text-xs'>
                          <span className='truncate font-medium'>{entry.word}</span>
                          <span className='text-base-content/70'>{entry.count}</span>
                        </div>
                        <div className='bg-base-300/60 h-1.5 rounded-full'>
                          <div
                            className={clsx('from-primary to-secondary h-1.5 rounded-full bg-gradient-to-r')}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className='text-base-content/65 text-xs'>{_('No words found in this book.')}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VocabularyStatsModal;
