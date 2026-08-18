import { useState } from 'react';
import { AudioLines } from './audio-lines.jsx';
import './audio-lines.css';
import './audio-lines-demo.css';

export function AudioLinesDemo() {
  const [active, setActive] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  return (
    <main className="audio-lines-demo">
      <section className="audio-lines-demo__panel">
        <p className="audio-lines-demo__eyebrow">React motion icon</p>
        <h1>Audio Lines</h1>
        <p className="audio-lines-demo__description">独立波形线动画，可用于语音输入、播放中或提示词处理状态。</p>
        <div className="audio-lines-demo__stage" data-active={active}>
          <AudioLines size={96} active={active} reducedMotion={reducedMotion} label="音频播放状态" />
        </div>
        <div className="audio-lines-demo__controls">
          <button type="button" onClick={() => setActive((value) => !value)}>
            {active ? '暂停动画' : '播放动画'}
          </button>
          <button type="button" onClick={() => setReducedMotion((value) => !value)}>
            {reducedMotion ? '恢复动效' : '减少动效'}
          </button>
        </div>
      </section>
    </main>
  );
}
