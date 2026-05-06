export default function Button({
  children,
  onClick,
  disabled = false,
  className = "",
  style = {},
  title = "",
}) {
  return (
    <button
      className={className}
      onClick={onClick}
      disabled={disabled}
      style={style}
      title={title}
    >
      {children}
    </button>
  );
}
