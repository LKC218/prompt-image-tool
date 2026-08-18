import React from 'react';
import { createRoot } from 'react-dom/client';
import { AudioLines } from './audio-lines.jsx';

const ICON_REGISTRY = {
  'audio-lines': AudioLines,
};

const mountedRoots = new WeakMap();

function getIconProps(node) {
  return {
    size: Number.parseInt(node.dataset.iconSize, 10) || 20,
    active: node.dataset.iconActive !== 'false',
    animateOnHover: node.dataset.iconHover === 'true',
    animateOnTap: node.dataset.iconTap === 'true',
    reducedMotion: node.dataset.iconReducedMotion === 'true',
    label: node.dataset.iconLabel || undefined,
    className: node.className,
  };
}

export function mountAnimatedIcons(container) {
  const placeholders = container.querySelectorAll('[data-react-icon]');
  const cleanups = [];

  placeholders.forEach((node) => {
    if (mountedRoots.has(node)) return;

    const name = node.dataset.reactIcon;
    const Component = ICON_REGISTRY[name];
    if (!Component) {
      console.warn(`[mountAnimatedIcons] Unknown animated icon: ${name}`);
      return;
    }

    const root = createRoot(node);
    mountedRoots.set(node, root);

    root.render(React.createElement(Component, getIconProps(node)));

    cleanups.push(() => {
      if (mountedRoots.has(node)) {
        mountedRoots.get(node).unmount();
        mountedRoots.delete(node);
      }
    });
  });

  return () => cleanups.forEach((cleanup) => cleanup());
}

export function unmountAnimatedIcons(container) {
  container.querySelectorAll('[data-react-icon]').forEach((node) => {
    if (!mountedRoots.has(node)) return;
    mountedRoots.get(node).unmount();
    mountedRoots.delete(node);
  });
}
