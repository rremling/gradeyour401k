export default function HomePage() {
  return (
    <main style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>Welcome to GradeYour401k</h1>
      <p style={{ fontSize: "1.2rem", maxWidth: 600, margin: "0 auto 2rem" }}>
        Analyze and grade your 401k allocation with personalized insights.
      </p>
      <a
        href="/grade/new"
        style={{
          display: "inline-block",
          backgroundColor: "#0070f3",
          color: "white",
          padding: "12px 20px",
          borderRadius: "8px",
          textDecoration: "none",
        }}
      >
        Get Started
      </a>
    </main>
  );
}
