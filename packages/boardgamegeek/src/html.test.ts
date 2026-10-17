import { describe, expect, it } from 'vitest';

import { htmlToPlainText } from './html.ts';

describe('htmlToPlainText', () => {
  it('turns line and paragraph breaks into newlines and drops other tags', () => {
    expect(htmlToPlainText('<p>One<br/>two</p><p><b>Three</b></p>')).toBe('One\ntwo\n\nThree');
  });

  it('decodes named, decimal and hex entities', () => {
    expect(htmlToPlainText('Tom &amp; Jerry&#10;&hellip; &#x41;&rsquo;')).toBe('Tom & Jerry\n… A’');
  });

  it('leaves an unknown named entity as written', () => {
    expect(htmlToPlainText('a &bogus; b')).toBe('a &bogus; b');
  });

  it('collapses three or more newlines and trims', () => {
    expect(htmlToPlainText('\n\nOne<br><br><br><br>Two  ')).toBe('One\n\nTwo');
  });

  it('returns an empty string for empty input', () => {
    expect(htmlToPlainText('')).toBe('');
  });
});
