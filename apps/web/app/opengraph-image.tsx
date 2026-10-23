import { ImageResponse } from "next/og";
import { BRAND_MARK_PATH } from "@/components/ui/brand-mark";

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
          backgroundColor: "#F2F2F7",
          padding: "80px",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif',
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {/* Official Vyana Brand Mark */}
          <svg
            width="140"
            height="140"
            viewBox="0 0 24 24"
            style={{ borderRadius: 32 }}
          >
            <rect width="24" height="24" rx="5.4" fill="#0D9488" />
            <path
              d={BRAND_MARK_PATH}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: 64,
                fontWeight: 800,
                color: "#1C1C1E",
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
              }}
            >
              Vyana
            </span>
            <span
              style={{
                fontSize: 22,
                color: "#0D9488",
                fontWeight: 600,
                marginTop: 6,
              }}
            >
              vyanahealth.app
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: "#1C1C1E",
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
              maxWidth: 960,
            }}
          >
            Your health, in one calm place.
          </div>
          <div
            style={{
              fontSize: 22,
              color: "rgba(60,60,67,0.72)",
              fontWeight: 400,
              lineHeight: 1.4,
              maxWidth: 920,
            }}
          >
            Medicine reminders, emergency SOS, pharmacy links, and doctor-approved care plans.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            borderTop: "1px solid rgba(60,60,67,0.12)",
            paddingTop: 24,
            fontSize: 18,
            color: "rgba(60,60,67,0.6)",
          }}
        >
          <span>The calm healthcare companion for India</span>
          <span style={{ fontWeight: 600, color: "#0D9488" }}>
            Web & Mobile
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
