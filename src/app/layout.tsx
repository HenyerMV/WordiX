import type { Metadata, Viewport } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { PlayerProvider } from "@/components/PlayerProvider";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WordiX",
  description:
    "Juego multijugador de categorías y palabras. Gira la ruleta, escribe rápido y gana la ronda.",
};

export const viewport: Viewport = {
  themeColor: "#100b26",
  width: "device-width",
  initialScale: 1,
  // En el celular, el teclado reduce el alto disponible en lugar de tapar la pantalla.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body>
        <PlayerProvider>{children}</PlayerProvider>
      </body>
    </html>
  );
}
