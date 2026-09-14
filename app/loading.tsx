export default function Loading() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-11 h-11 rounded-2xl skeleton" />
        <div className="space-y-2">
          <div className="h-5 w-40 rounded skeleton" />
          <div className="h-3 w-56 rounded skeleton" />
        </div>
      </div>
      <div className="h-4 w-48 rounded skeleton mb-4" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="p-4 flex items-center gap-4 border border-slate-200 rounded-2xl bg-white"
          >
            <div className="w-11 h-11 rounded-full skeleton shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded skeleton" />
              <div className="h-3 w-1/2 rounded skeleton" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
