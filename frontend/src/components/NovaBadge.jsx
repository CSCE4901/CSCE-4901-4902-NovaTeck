/** Shared vector artwork also serves as the favicon. Size is in CSS pixels. */
export default function NovaBadge({ size = 64 }) {
  return <img
    src="/nova-badge.svg?v=twemoji-2"
    alt="NovaTeck"
    width={size}
    height={size}
    draggable={false}
    style={{ display: 'block', width: size, height: size, flexShrink: 0 }}
  />;
}
