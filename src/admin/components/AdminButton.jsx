export default function AdminButton({
  children,
  variant = 'primary',
  type = 'button',
  onClick,
  disabled = false,
  className = '',
}) {
  return (
    <button
      type={type}
      className={`admin-button admin-button-${variant} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
