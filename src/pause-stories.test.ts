import { describe, expect, it } from 'vitest';
import { PAUSE_STORIES, nextPauseStory, pauseStoryById } from './pause-stories';

describe('pause stories', () => {
  it('ships three complete, uniquely illustrated four-card stories', () => {
    expect(PAUSE_STORIES).toHaveLength(3);
    expect(new Set(PAUSE_STORIES.map((story) => story.id)).size).toBe(3);
    expect(new Set(PAUSE_STORIES.map((story) => story.image)).size).toBe(3);
    for (const story of PAUSE_STORIES) {
      expect(story.pages).toHaveLength(4);
      expect(story.sourceUrl).toMatch(/^https:\/\//);
      expect(story.pages.every((page) => page.title.length > 0 && page.body.length > 0)).toBe(true);
    }
  });

  it('cycles through stories and resolves a known story', () => {
    expect(pauseStoryById('music').id).toBe('music');
    expect(nextPauseStory('moon').id).toBe('music');
    expect(nextPauseStory('music').id).toBe('scent');
    expect(nextPauseStory('scent').id).toBe('moon');
  });
});
