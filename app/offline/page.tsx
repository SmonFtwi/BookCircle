import Link from "next/link";
export default function Offline() {
  return (
    <main className="welcome">
      <div className="auth-card">
        <h1>A quiet moment offline.</h1>
        <p>
          Your reading circle needs an internet connection. Your saved activity
          is safe; reconnect to continue.
        </p>
        <Link className="primary-link" href="/home">
          Try again
        </Link>
      </div>
    </main>
  );
}
