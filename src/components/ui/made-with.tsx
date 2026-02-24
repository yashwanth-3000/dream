const TECH = [
  {
    name: "Azure AI Foundry",
    href: "https://azure.microsoft.com/en-us/products/ai-foundry",
    icon: (
      <svg viewBox="0 0 96 96" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="mw-az-a" x1="-1032.17" x2="-1059.21" y1="145.31" y2="65.43" gradientTransform="matrix(1 0 0 -1 1075 158)" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#114a8b"/>
            <stop offset="1" stopColor="#0669bc"/>
          </linearGradient>
          <linearGradient id="mw-az-b" x1="-1023.73" x2="-1029.98" y1="108.08" y2="105.97" gradientTransform="matrix(1 0 0 -1 1075 158)" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopOpacity=".3"/>
            <stop offset=".07" stopOpacity=".2"/>
            <stop offset=".32" stopOpacity=".1"/>
            <stop offset=".62" stopOpacity=".05"/>
            <stop offset="1" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="mw-az-c" x1="-1027.16" x2="-997.48" y1="147.64" y2="68.56" gradientTransform="matrix(1 0 0 -1 1075 158)" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#3ccbf4"/>
            <stop offset="1" stopColor="#2892df"/>
          </linearGradient>
        </defs>
        <path fill="url(#mw-az-a)" d="M33.34 6.54h26.04l-27.03 80.1a4.15 4.15 0 0 1-3.94 2.81H8.15a4.14 4.14 0 0 1-3.93-5.47L29.4 9.38a4.15 4.15 0 0 1 3.94-2.83z"/>
        <path fill="#0078d4" d="M71.17 60.26H29.88a1.91 1.91 0 0 0-1.3 3.31l26.53 24.76a4.17 4.17 0 0 0 2.85 1.13h23.38z"/>
        <path fill="url(#mw-az-b)" d="M33.34 6.54a4.12 4.12 0 0 0-3.95 2.88L4.25 83.92a4.14 4.14 0 0 0 3.91 5.54h20.79a4.44 4.44 0 0 0 3.4-2.9l5.02-14.78 17.91 16.7a4.24 4.24 0 0 0 2.67.97h23.29L71.02 60.26H41.24L59.47 6.55z"/>
        <path fill="url(#mw-az-c)" d="M66.6 9.36a4.14 4.14 0 0 0-3.93-2.82H33.65a4.15 4.15 0 0 1 3.93 2.82l25.18 74.62a4.15 4.15 0 0 1-3.93 5.48h29.02a4.15 4.15 0 0 0 3.93-5.48z"/>
      </svg>
    ),
  },
  {
    name: "MS Agentic Framework",
    href: "https://learn.microsoft.com/en-us/azure/ai-agent-service/",
    icon: (
      <svg viewBox="0 0 21 21" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
        <path fill="#f25022" d="M0 0h10v10H0z"/>
        <path fill="#00a4ef" d="M11 0h10v10H11z"/>
        <path fill="#7fba00" d="M0 11h10v10H0z"/>
        <path fill="#ffb900" d="M11 11h10v10H11z"/>
      </svg>
    ),
  },
  {
    name: "A2A Protocol",
    href: "https://google.github.io/A2A",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    ),
  },
  {
    name: "CrewAI",
    href: "https://www.crewai.com",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="#FF5A50" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.482.18C7.161 1.319 1.478 9.069 1.426 15.372c-.051 5.527 3.1 8.68 8.68 8.627 6.716-.05 14.259-6.87 12.09-10.9-.672-1.292-1.396-1.344-2.687-.207-1.602 1.395-1.654.31-.207-2.893 1.757-3.98 1.705-5.322-.31-7.544C17.03.388 14.962-.388 12.482.181Zm5.322 2.068c2.273 2.015 2.376 4.236.465 8.42-1.395 3.1-2.17 3.515-3.824 1.86-1.24-1.24-1.343-3.46-.258-6.044 1.137-2.635.982-3.1-.568-1.653-3.72 3.358-6.458 9.765-5.424 12.503.464 1.189.825 1.395 2.737 1.395 2.79 0 6.303-1.705 7.957-3.926 1.756-2.274 2.79-2.274 2.79-.052 0 3.875-6.459 8.627-11.625 8.627-6.251 0-9.351-4.752-7.491-11.47.878-2.995 4.443-7.904 7.077-9.66 3.255-2.17 5.684-2.17 8.164 0z"/>
      </svg>
    ),
  },
  {
    name: "Vercel",
    href: "https://vercel.com",
    icon: (
      <svg viewBox="0 0 256 222" width="16" height="14" xmlns="http://www.w3.org/2000/svg">
        <path fill="#000" d="m128 0 128 221.705H0z"/>
      </svg>
    ),
  },
  {
    name: "Railway",
    href: "https://railway.app",
    icon: (
      <svg viewBox="0 0 1024 1024" width="16" height="16" fill="#000" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.8 438.2A520.7 520.7 0 000 489.7h777.8c-2.7-5.3-6.4-10-10-14.7-133-171.8-204.5-157-306.9-161.3-34-1.4-57.2-2-193-2-72.7 0-151.7.2-228.6.4A621 621 0 0015 386.3h398.6v51.9H4.8zm779.1 103.5H.4c.8 13.8 2.1 27.5 4 41h723.4c32.2 0 50.3-18.3 56.1-41zM45 724.3s120 294.5 466.5 299.7c207 0 385-123 465.9-299.7H45z"/>
        <path d="M511.5 0A512.2 512.2 0 0065.3 260.6l202.7-.2c158.4 0 164.2.6 195.2 2l19.1.6c66.7 2.3 148.7 9.4 213.2 58.2 35 26.5 85.6 85 115.7 126.5 27.9 38.5 35.9 82.8 17 125.2-17.5 39-55 62.2-100.4 62.2H16.7s4.2 18 10.6 37.8h970.6a510.4 510.4 0 0026.1-160.7A512.4 512.4 0 00511.5 0z"/>
      </svg>
    ),
  },
];

export default function MadeWith() {
  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "8px",
    }}>
      <span style={{
        fontSize: "10.5px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#9a7a65",
        flexShrink: 0,
        marginRight: "4px",
      }}>
        Made with
      </span>
      {TECH.map((t) => (
        <a
          key={t.name}
          href={t.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 10px 4px 7px",
            borderRadius: "8px",
            background: "#ede7dd",
            border: "1px solid #dbc9b7",
            textDecoration: "none",
            color: "#4f3a2b",
            fontSize: "11.5px",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            transition: "background 0.16s, color 0.16s, transform 0.16s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#e0d5c7";
            e.currentTarget.style.color = "#2b180a";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#ede7dd";
            e.currentTarget.style.color = "#4f3a2b";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {t.icon}
          </span>
          {t.name}
        </a>
      ))}
    </div>
  );
}
