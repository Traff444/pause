import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, BookOpen, Check, X } from 'lucide-react';
import { formatTimer } from './domain';
import {
  PAUSE_STORIES,
  nextPauseStory,
  type PauseStory,
  type PauseStoryId,
} from './pause-stories';

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;

export function PauseStoryPicker({
  onSelect,
  compact = false,
}: {
  onSelect: (storyId: PauseStoryId) => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <button
        type="button"
        className="pause-story-compact-button"
        onClick={() => onSelect(PAUSE_STORIES[0].id)}
      >
        <span><BookOpen /></span>
        <strong>КОРОТКАЯ ИСТОРИЯ</strong>
        <ArrowRight />
      </button>
    );
  }

  const [featured, ...moreStories] = PAUSE_STORIES;
  return (
    <div className="pause-story-picker">
      <button
        type="button"
        className="pause-story-feature"
        onClick={() => onSelect(featured.id)}
        aria-label={`Открыть историю: ${featured.title}`}
      >
        <img src={assetUrl(featured.image)} alt="" />
        <span className="pause-story-feature-shade" />
        <span className="pause-story-feature-copy">
          <small>ИСТОРИЯ ДНЯ · {featured.duration}</small>
          <strong>{featured.title}</strong>
          <i>4 короткие карточки</i>
        </span>
        <span className="pause-story-feature-arrow" aria-hidden="true"><ArrowRight /></span>
      </button>

      <div className="pause-story-more">
        {moreStories.map((story) => (
          <button
            type="button"
            key={story.id}
            onClick={() => onSelect(story.id)}
            aria-label={`Открыть историю: ${story.title}`}
          >
            <img src={assetUrl(story.image)} alt="" />
            <span>
              <small>{story.category}</small>
              <strong>{story.shortTitle}</strong>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PauseStoryViewer({
  story,
  remainingSeconds,
  onClose,
  onChangeStory,
}: {
  story: PauseStory;
  remainingSeconds: number;
  onClose: () => void;
  onChangeStory: (storyId: PauseStoryId) => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const pointerStart = useRef<number | undefined>(undefined);
  const page = story.pages[pageIndex];
  const finalPage = pageIndex === story.pages.length - 1;

  useEffect(() => setPageIndex(0), [story.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') {
        setPageIndex((current) => Math.min(story.pages.length - 1, current + 1));
      } else if (event.key === 'ArrowLeft') {
        setPageIndex((current) => Math.max(0, current - 1));
      } else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, story.pages.length]);

  const previous = () => {
    if (pageIndex === 0) onClose();
    else setPageIndex((current) => current - 1);
  };

  const next = () => {
    setPageIndex((current) => Math.min(story.pages.length - 1, current + 1));
  };

  const finishPointer = (event: PointerEvent<HTMLElement>) => {
    const start = pointerStart.current;
    pointerStart.current = undefined;
    if (start === undefined) return;
    const delta = event.clientX - start;
    if (delta < -54 && !finalPage) next();
    else if (delta > 54) previous();
  };

  const chooseNextStory = () => onChangeStory(nextPauseStory(story.id).id);

  return createPortal(
    <section
      className="pause-story-screen"
      role="dialog"
      aria-modal="true"
      aria-label={story.title}
      onPointerDown={(event) => { pointerStart.current = event.clientX; }}
      onPointerUp={finishPointer}
      onPointerCancel={() => { pointerStart.current = undefined; }}
    >
      <header className="pause-story-header">
        <button type="button" onClick={previous} aria-label={pageIndex === 0 ? 'Вернуться к таймеру' : 'Предыдущая карточка'}>
          <ArrowLeft />
        </button>
        <strong>
          ПАУЗА · {remainingSeconds <= 0 ? 'ЦЕЛЬ ПРОЙДЕНА' : formatTimer(remainingSeconds)}
        </strong>
        <button type="button" onClick={onClose} aria-label="Закрыть историю"><X /></button>
      </header>

      <div className="pause-story-progress" aria-label={`Карточка ${pageIndex + 1} из ${story.pages.length}`}>
        {story.pages.map((_, index) => (
          <button
            type="button"
            key={index}
            className={index <= pageIndex ? 'complete' : ''}
            onClick={() => setPageIndex(index)}
            aria-label={`Перейти к карточке ${index + 1}`}
          ><span /></button>
        ))}
      </div>

      <div className={`pause-story-image step-${pageIndex}`}>
        <img src={assetUrl(story.image)} alt={story.imageAlt} />
        {finalPage && <span className="pause-story-complete-mark" aria-hidden="true"><Check /></span>}
      </div>

      <article className="pause-story-copy" key={`${story.id}-${pageIndex}`}>
        <p>{page.eyebrow}</p>
        <h1>{page.title}</h1>
        <div>{page.body}</div>
        {page.note && <aside><strong>Попробуй:</strong> {page.note.replace(/^Попробуй[^:]*:\s*/i, '')}</aside>}
      </article>

      {finalPage ? (
        <footer className="pause-story-final-actions">
          <a href={story.sourceUrl} target="_blank" rel="noreferrer">Источник: {story.sourceLabel}</a>
          <button type="button" className="pause-story-another" onClick={chooseNextStory}>
            ОТКРЫТЬ ДРУГУЮ ИСТОРИЮ
          </button>
          <button type="button" className="button primary-button full" onClick={onClose}>
            ВЕРНУТЬСЯ К ТАЙМЕРУ
          </button>
        </footer>
      ) : (
        <footer className="pause-story-actions">
          <button type="button" className="button secondary-button" onClick={previous}>
            {pageIndex === 0 ? 'ЗАКРЫТЬ' : 'НАЗАД'}
          </button>
          <button type="button" className="button primary-button" onClick={next}>
            ДАЛЬШЕ <ArrowRight />
          </button>
        </footer>
      )}
    </section>,
    document.body,
  );
}
