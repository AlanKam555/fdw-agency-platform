import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-5xl">That desk is not yours</h1>
      <p className="mt-4">Your role does not include this page.</p>
      <Link className="btn mt-6" href="/">
        Back home
      </Link>
    </div>
  );
}
