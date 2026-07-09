export default function SkeletonRail({ title, count = 8 }) {
  return (
    <div className="media-rail-section">
      {title && <h2 className="section-title">{title}</h2>}
      <div className="media-rail">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="poster-card-skeleton" />
        ))}
      </div>
    </div>
  );
}
