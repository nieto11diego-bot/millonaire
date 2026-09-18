export default function PlayPage() {
  return (
    <>
      <a
        href="/"
        style={{
          position: "fixed",
          top: 10,
          left: 10,
          zIndex: 20,
          padding: "0.45rem 0.75rem",
          borderRadius: 8,
          background: "rgba(15,28,46,0.85)",
          color: "#f4f0e6",
          border: "1px solid rgba(232,184,74,0.35)",
          fontFamily: "Fredoka, Segoe UI, sans-serif",
          fontSize: 14,
          textDecoration: "none",
        }}
      >
        Menú
      </a>
      <iframe
        className="play-frame"
        title="Millionaire City"
        src="/game/index.html"
        allow="autoplay"
      />
    </>
  );
}
