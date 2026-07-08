"use client";

import type { BottleType } from "@/lib/types";

interface BottlePreviewProps {
  type: BottleType;
  quantity: number;
  vip?: boolean;
}

export default function BottlePreview({ type, quantity, vip = false }: BottlePreviewProps) {
  // Determine color matching for the liquid inside
  let liquidColor = "rgba(255, 99, 43, 0.6)"; // default orange
  let bottleShape = "standard"; // standard, decanter, flask, tall

  switch (type) {
    case "whisky":
      liquidColor = "url(#whiskyGrad)";
      bottleShape = "decanter";
      break;
    case "rhum":
      liquidColor = "url(#rhumGrad)";
      bottleShape = "standard";
      break;
    case "vodka":
      liquidColor = "url(#vodkaGrad)";
      bottleShape = "tall";
      break;
    case "gin":
      liquidColor = "url(#ginGrad)";
      bottleShape = "flask";
      break;
    case "tequila":
      liquidColor = "url(#tequilaGrad)";
      bottleShape = "standard";
      break;
    case "liqueur":
      liquidColor = "url(#liqueurGrad)";
      bottleShape = "flask";
      break;
    case "vin":
      liquidColor = "url(#vinGrad)";
      bottleShape = "wine";
      break;
    case "champagne":
      liquidColor = "url(#champagneGrad)";
      bottleShape = "wine";
      break;
    case "biere":
      liquidColor = "url(#biereGrad)";
      bottleShape = "standard";
      break;
    case "mixer":
      liquidColor = "url(#mixerGrad)";
      bottleShape = "tall";
      break;
    default:
      liquidColor = "url(#defaultGrad)";
      bottleShape = "standard";
  }

  // Calculate percentage of liquid. 0 = 0%, 1 bottle = 80% (top of body), 2+ = 95% (full neck)
  const fillPct = Math.min(100, Math.max(0, quantity === 0 ? 0 : 25 + Math.min(quantity, 1.5) * 45));

  return (
    <div className="relative w-16 h-28 flex items-center justify-center filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.4)] hover:scale-105 transition-transform duration-300">
      <svg
        viewBox="0 0 100 200"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Liquid Gradients */}
          <linearGradient id="whiskyGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#8f3e00" />
            <stop offset="60%" stopColor="#e37400" />
            <stop offset="100%" stopColor="#ffb03a" />
          </linearGradient>
          <linearGradient id="rhumGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#4a1a00" />
            <stop offset="70%" stopColor="#8c3e07" />
            <stop offset="100%" stopColor="#d9822b" />
          </linearGradient>
          <linearGradient id="vodkaGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(195, 230, 245, 0.4)" />
            <stop offset="100%" stopColor="rgba(240, 248, 255, 0.15)" />
          </linearGradient>
          <linearGradient id="ginGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(110, 204, 185, 0.55)" />
            <stop offset="100%" stopColor="rgba(215, 247, 235, 0.25)" />
          </linearGradient>
          <linearGradient id="tequilaGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#cfa11d" />
            <stop offset="80%" stopColor="#eacf61" />
            <stop offset="100%" stopColor="#fdf3a7" />
          </linearGradient>
          <linearGradient id="liqueurGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#b30047" />
            <stop offset="70%" stopColor="#ff1a75" />
            <stop offset="100%" stopColor="#ffb3d1" />
          </linearGradient>
          <linearGradient id="vinGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#2b0004" />
            <stop offset="70%" stopColor="#660011" />
            <stop offset="100%" stopColor="#a31429" />
          </linearGradient>
          <linearGradient id="champagneGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#a6873c" />
            <stop offset="60%" stopColor="#d9bf77" />
            <stop offset="100%" stopColor="#fff8e3" />
          </linearGradient>
          <linearGradient id="biereGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#a86208" />
            <stop offset="75%" stopColor="#d9910d" />
            <stop offset="90%" stopColor="#ffe994" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
          <linearGradient id="mixerGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ff4d00" />
            <stop offset="60%" stopColor="#ff8c00" />
            <stop offset="100%" stopColor="#ffd700" />
          </linearGradient>
          <linearGradient id="defaultGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#e04b16" />
            <stop offset="100%" stopColor="#ff7d4d" />
          </linearGradient>

          {/* Liquid Clipping Mask depending on the shape */}
          <clipPath id="liquidClip">
            <rect x="0" y={200 - (fillPct * 1.7 + 15)} width="100" height="200" />
          </clipPath>
        </defs>

        {/* Bottle Renderings based on shape */}
        {bottleShape === "decanter" && (
          <>
            {/* Liquid */}
            <path
              d="M 38,40 L 62,40 L 62,70 L 85,110 L 85,185 L 15,185 L 15,110 L 38,70 Z"
              fill={liquidColor}
              clipPath="url(#liquidClip)"
            />
            {/* Glass Outline */}
            <path
              d="M 38,40 L 62,40 L 62,70 L 85,110 L 85,185 L 15,185 L 15,110 L 38,70 Z"
              stroke={vip ? "#f5be4f" : "#ffffff"}
              strokeWidth="4"
              strokeOpacity={vip ? "0.85" : "0.3"}
            />
            {/* Cork */}
            <rect x="42" y="20" width="16" height="20" rx="3" fill="#8c583a" />
          </>
        )}

        {bottleShape === "flask" && (
          <>
            {/* Liquid */}
            <path
              d="M 42,30 L 58,30 L 58,60 L 78,80 L 78,185 L 22,185 L 22,80 L 42,60 Z"
              fill={liquidColor}
              clipPath="url(#liquidClip)"
            />
            {/* Glass Outline */}
            <path
              d="M 42,30 L 58,30 L 58,60 L 78,80 L 78,185 L 22,185 L 22,80 L 42,60 Z"
              stroke={vip ? "#f5be4f" : "#ffffff"}
              strokeWidth="4"
              strokeOpacity={vip ? "0.85" : "0.3"}
            />
            {/* Cap */}
            <rect x="44" y="15" width="12" height="15" fill={vip ? "#f5be4f" : "#888888"} />
          </>
        )}

        {bottleShape === "wine" && (
          <>
            {/* Liquid */}
            <path
              d="M 44,20 L 56,20 L 56,80 L 72,110 L 72,185 L 28,185 L 28,110 L 44,80 Z"
              fill={liquidColor}
              clipPath="url(#liquidClip)"
            />
            {/* Glass Outline */}
            <path
              d="M 44,20 L 56,20 L 56,80 L 72,110 L 72,185 L 28,185 L 28,110 L 44,80 Z"
              stroke={vip ? "#f5be4f" : "#a2b5a5"}
              strokeWidth="4"
              strokeOpacity={vip ? "0.85" : "0.35"}
            />
            {/* Foil/Cap */}
            <path d="M 44,20 L 56,20 L 56,38 L 44,38 Z" fill={type === "champagne" ? "#f5be4f" : "#a31429"} />
          </>
        )}

        {bottleShape === "tall" && (
          <>
            {/* Liquid */}
            <path
              d="M 45,25 L 55,25 L 55,55 L 70,75 L 70,185 L 30,185 L 30,75 L 45,55 Z"
              fill={liquidColor}
              clipPath="url(#liquidClip)"
            />
            {/* Glass Outline */}
            <path
              d="M 45,25 L 55,25 L 55,55 L 70,75 L 70,185 L 30,185 L 30,75 L 45,55 Z"
              stroke={vip ? "#f5be4f" : "#ffffff"}
              strokeWidth="4"
              strokeOpacity={vip ? "0.85" : "0.35"}
            />
            {/* Cap */}
            <rect x="46" y="13" width="8" height="12" fill="#dddddd" />
          </>
        )}

        {bottleShape === "standard" && (
          <>
            {/* Liquid */}
            <path
              d="M 43,25 L 57,25 L 57,65 L 74,90 L 74,185 L 26,185 L 26,90 L 43,65 Z"
              fill={liquidColor}
              clipPath="url(#liquidClip)"
            />
            {/* Glass Outline */}
            <path
              d="M 43,25 L 57,25 L 57,65 L 74,90 L 74,185 L 26,185 L 26,90 L 43,65 Z"
              stroke={vip ? "#f5be4f" : "#ffffff"}
              strokeWidth="4"
              strokeOpacity={vip ? "0.85" : "0.3"}
            />
            {/* Cap */}
            <rect x="45" y="13" width="10" height="12" fill={vip ? "#f5be4f" : "#888888"} />
          </>
        )}

        {/* Dynamic bubble decoration for sparkles in champagne/biere */}
        {(type === "champagne" || type === "biere" || type === "mixer") && quantity > 0 && (
          <g fill="#ffffff" opacity="0.6">
            <circle cx="45" cy="140" r="2" />
            <circle cx="55" cy="120" r="1.5" />
            <circle cx="38" cy="160" r="1" />
            <circle cx="62" cy="150" r="2.5" />
            <circle cx="50" cy="170" r="1.5" />
          </g>
        )}

        {/* Reflex reflection on glass */}
        <path
          d="M 32,110 Q 35,140 35,170"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeOpacity="0.25"
        />
      </svg>

      {/* Numerical Badge for Quantity on visual */}
      <div className={`absolute -bottom-1 right-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
        quantity === 0
          ? "bg-red-600 text-white"
          : vip
          ? "bg-gold text-ink"
          : "bg-orange text-white"
      }`}>
        {quantity}
      </div>
    </div>
  );
}
