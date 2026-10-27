import Link from "next/link";
export default function NotFound() {
  return (
    <main className="welcome">
      <div className="auth-card">
        <h1>This page has turned.</h1>
        <p>We couldn’t find that page.</p>
        <Link className="primary-link" href="/home">
          Back to your circle
        </Link>
      </div>
    </main>
  );
}
