export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-zinc-800">
          Customer Not Found
        </h1>
        <p className="text-zinc-500 mt-2">
          No customer exists with that ID, or they have been deleted.
        </p>
      </div>
    </div>
  );
}
