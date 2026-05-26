import { Link } from "react-router-dom";

const SUPPORT_WHATSAPP = "5492612733660";
const SUPPORT_MESSAGE = "Necesito soporte relacionado con un demo o cuenta";

/**
 * Pantalla inicial cuando no hay VITE_DEFAULT_DEMO_SLUG:
 * los demos se abren con /d/{slug}/login (slug = columna restaurants.demo_slug).
 */
export default function DemoHome() {
  const example = "mi-restaurante";
  const supportUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(SUPPORT_MESSAGE)}`;

  return (
    <div className="dark min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-lg space-y-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">RestoBot · demos</h1>
        <p className="text-sm text-slate-400">
          Cada cliente recibe un enlace con su identificador. Pedí al equipo tu acceso o usá el que tenés
          asignado.
        </p>
        <p className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 font-mono text-xs text-slate-300">
          {typeof window !== "undefined" ? window.location.origin : ""}
          <span className="text-emerald-400">/d/{example}/login</span>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <a
            href={supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 min-w-[7.5rem] items-center justify-center rounded-lg border border-emerald-500/50 bg-emerald-900/30 px-5 text-sm font-semibold text-emerald-50 transition-colors hover:bg-emerald-800/40"
          >
            Soporte
          </a>
          <Link
            to="/login"
            className="inline-flex h-10 min-w-[7.5rem] items-center justify-center rounded-lg border border-slate-600 bg-slate-800/80 px-5 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-700/80"
          >
            Principal
          </Link>
        </div>
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-100/90">
          Entorno de demostración: datos de prueba, sin SLA; pueden borrase o resetearse en cualquier momento.
        </p>
      </div>
    </div>
  );
}
