export default function Loading() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <div className="h-4 w-28 rounded skeleton mb-6" />
      <div className="p-6 border border-slate-200 rounded-2xl bg-white mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full skeleton shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-6 w-40 rounded skeleton" />
            <div className="h-4 w-56 rounded skeleton" />
            <div className="h-5 w-32 rounded-full skeleton" />
          </div>
        </div>
        <div className="flex gap-2 mt-5 pt-5 border-t border-slate-100">
          <div className="h-9 w-44 rounded-xl skeleton" />
          <div className="h-9 w-36 rounded-xl skeleton" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-16 border border-slate-200 rounded-2xl bg-white flex items-center gap-3 px-4"
          >
            <div className="w-6 h-6 rounded-full skeleton shrink-0" />
            <div className="w-8 h-8 rounded-lg skeleton shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/3 rounded skeleton" />
              <div className="h-3 w-1/4 rounded skeleton" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
