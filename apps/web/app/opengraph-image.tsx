import { ImageResponse } from "next/og";

export const alt = "Vyana: your health, in one calm place";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          backgroundColor: "#042F2E",
          padding: "70px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 24,
              backgroundColor: "#0D9488",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: 48,
              fontWeight: 800,
            }}
          ><svg width="64" height="64" viewBox="0 0 24 24"><path d="M4.5 12.5h3l2-4.5 2.5 9 2.5-9 2 4.5h3" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg></div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 44, fontWeight: 800, color: "#FFFFFF" }}>
              Vyana
            </span>
            <span style={{ fontSize: 22, color: "#5EEAD4", fontWeight: 600 }}>
              https://vyanahealth.app
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 50,
              fontWeight: 800,
              color: "#FFFFFF",
              lineHeight: 1.2,
              maxWidth: 1020,
            }}
          >
            Your One-Stop Solution for Complete Healthcare in India
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#CCFBF1",
              lineHeight: 1.4,
              maxWidth: 960,
            }}
          >
            Real-time medication reminders · Offline Medical ID · Lab trend analysis · OPD tokens · Jan Aushadhi generic savings
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            borderTop: "2px solid #115E59",
            paddingTop: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 28,
              color: "#99F6E4",
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            <span>🏥 OPD Discovery</span>
            <span>💊 Medicine Tracker</span>
            <span>🚨 108 Emergency SOS</span>
          </div>
          <div style={{ color: "#5EEAD4", fontSize: 20, fontWeight: 700 }}>
            DPDP Act 2023 Compliant
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
