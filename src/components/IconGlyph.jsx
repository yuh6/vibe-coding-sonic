const ICON_BASE = '/icons';

export function iconGlyphSrc(name) {
  return `${ICON_BASE}/${name}.png`;
}

export default function IconGlyph({ name, alt = '', className = 'h-4 w-4', ...props }) {
  if (!name) return null;

  return (
    <img
      src={iconGlyphSrc(name)}
      alt={alt}
      aria-hidden={alt === '' ? true : undefined}
      className={`inline-block shrink-0 object-contain ${className}`}
      draggable={false}
      decoding="async"
      {...props}
    />
  );
}
