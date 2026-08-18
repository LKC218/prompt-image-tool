import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AudioLines } from './audio-lines.jsx';

describe('AudioLines', () => {
  it('renders six animated waveform lines', () => {
    const { container } = render(React.createElement(AudioLines, { label: '音频播放中' }));

    expect(screen.getByRole('img', { name: '音频播放中' })).toBeTruthy();
    expect(container.querySelectorAll('line')).toHaveLength(6);
  });

  it('renders a static icon when reduced motion is enabled', () => {
    const { container } = render(React.createElement(AudioLines, { reducedMotion: true }));

    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelectorAll('line')).toHaveLength(6);
  });
});
