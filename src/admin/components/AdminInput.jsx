export default function AdminInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input
        className="admin-input"
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
    </label>
  );
}
