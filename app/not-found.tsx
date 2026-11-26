import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-5xl">Nothing on that page</h1>
      <Link className="btn mt-6" href="/">
        Back home
      </Link>
    </div>
  );
}
