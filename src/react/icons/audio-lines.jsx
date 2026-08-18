import { motion } from 'motion/react';
import { forwardRef, useEffect, useState } from 'react';

const lineVariants = [
  { y1: [10, 5, 8, 6, 10], y2: [13, 18, 15, 17, 13] },
  { y1: [6, 10, 5, 8, 6], y2: [17, 13, 18, 15, 17] },
  { y1: [3, 6, 3, 8, 3], y2: [21, 17, 21, 15, 21] },
  { y1: [8, 3, 7, 5, 8], y2: [15, 21, 16, 19, 15] },
  { y1: [5, 9, 6, 10, 5], y2: [18, 14, 17, 13, 18] },
  { y1: [10, 6, 8, 5, 10], y2: [13, 17, 15, 18, 13] },
];

const lineTimes = [0, 0.08, 0.16, 0.24, 0.32];

export const AudioLines = forwardRef(function AudioLines(
  {
    size = 28,
    strokeWidth = 2,
    active = true,
    animateOnHover = false,
    animateOnTap = false,
    reducedMotion = false,
    className = '',
    label,
    ...props
  },
  ref,
) {
  const [hovered, setHovered] = useState(false);
  const [tapped, setTapped] = useState(false);
  const shouldAnimate = !reducedMotion && (active || (animateOnHover && hovered) || (animateOnTap && tapped));

  useEffect(() => {
    if (!tapped) return undefined;
    const timer = window.setTimeout(() => setTapped(false), 700);
    return () => window.clearTimeout(timer);
  }, [tapped]);

  return (
    <motion.svg
      ref={ref}
      className={`audio-lines ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={() => animateOnTap && setTapped(true)}
      {...props}
    >
      {lineVariants.map((line, index) => (
        <motion.line
          key={index}
          x1={2 + index * 4}
          x2={2 + index * 4}
          initial={{ y1: line.y1[0], y2: line.y2[0] }}
          animate={shouldAnimate ? { y1: line.y1, y2: line.y2 } : { y1: 10, y2: 13 }}
          transition={{ duration: 1.5, ease: 'linear', repeat: shouldAnimate ? Infinity : 0, delay: lineTimes[index] }}
        />
      ))}
    </motion.svg>
  );
});

AudioLines.displayName = 'AudioLines';
