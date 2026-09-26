export function HeroParticles() {
  return <div aria-hidden="true" className="hero-particles pointer-events-none absolute inset-0 overflow-hidden">
    {Array.from({ length: 12 }, (_, index) => <span key={index} style={{ left: `${8 + (index * 23) % 86}%`, top: `${10 + (index * 37) % 78}%`, animationDelay: `${index * -0.55}s` }} />)}
  </div>;
}
