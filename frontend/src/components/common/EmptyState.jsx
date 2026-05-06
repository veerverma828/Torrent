export default function EmptyState({ message = "Nothing to show" }) {
  return (
    <div className="center-margin-top">
      <p style={{ color: "#888" }}>{message}</p>
    </div>
  );
}
