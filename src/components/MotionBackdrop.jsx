import { useEffect, useRef, useState } from 'react';

const DEFAULT_MEDIA_CLASS = 'absolute inset-0 h-full w-full object-cover';

export default function MotionBackdrop({
  active = false,
  children,
  className = '',
  mediaClassName = DEFAULT_MEDIA_CLASS,
  mp4,
  opacity = 1,
  poster,
  style,
  webm,
}) {
  const [canHover, setCanHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(true);
  const [ready, setReady] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setCanHover(hoverQuery.matches);
      setMotionAllowed(!motionQuery.matches);
    };

    update();
    hoverQuery.addEventListener('change', update);
    motionQuery.addEventListener('change', update);

    return () => {
      hoverQuery.removeEventListener('change', update);
      motionQuery.removeEventListener('change', update);
    };
  }, []);

  const shouldPlay = motionAllowed && (active || focused || (canHover && hovered));

  useEffect(() => {
    if (!shouldPlay) {
      setReady(false);
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    const playPromise = video.play();
    if (playPromise?.catch) playPromise.catch(() => {});
  }, [shouldPlay, mp4, webm]);

  const handleBlur = (event) => {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setFocused(false);
    }
  };

  return (
    <div
      className={className}
      style={style}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerMove={() => setHovered(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={() => setHovered(true)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={handleBlur}
    >
      <img
        src={poster}
        alt=""
        decoding="async"
        aria-hidden="true"
        className={`pointer-events-none ${mediaClassName}`}
        style={{ opacity }}
      />
      {shouldPlay && (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="metadata"
          poster={poster}
          aria-hidden="true"
          className={`pointer-events-none ${mediaClassName}`}
          style={{ opacity: ready ? opacity : 0 }}
          onCanPlay={() => setReady(true)}
        >
          {webm && <source src={webm} type="video/webm" />}
          {mp4 && <source src={mp4} type="video/mp4" />}
        </video>
      )}
      {children}
    </div>
  );
}
