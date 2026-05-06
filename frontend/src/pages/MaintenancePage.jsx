export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-xl w-full text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 border border-white/10 mb-8">
          <span className="text-4xl">🛠️</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">
          Site Under Maintenance
        </h1>

        <p className="text-zinc-400 text-lg leading-relaxed mb-8">
          We’re currently improving the experience and performing important updates.
          The site will resume shortly.
        </p>

        <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-zinc-300">
          <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
          Maintenance in progress...
        </div>
      </div>
    </div>
  );
}
