import Link from "next/link";
import { createClientSafe } from "@/lib/supabase/safe";
import { signOut } from "./actions";

export default async function HomePage() {
  const supabase = await createClientSafe();
  const user = supabase
    ? (await supabase.auth.getUser()).data.user
    : null;

  return (
    <div className="shell">
      <h1 className="brand">Millionaire City</h1>
      <p className="tagline">
        Construye tu ciudad. Inicia sesión para sincronizar tu partida entre
        navegadores y dispositivos.
      </p>

      <div className="panel">
        {user ? (
          <>
            <div className="user-bar">
              <span>{user.email}</span>
              <form action={signOut}>
                <button type="submit" className="btn btn-ghost">
                  Cerrar sesión
                </button>
              </form>
            </div>
            <div className="actions">
              <Link className="btn btn-primary" href="/play">
                Continuar partida
              </Link>
              <Link className="btn btn-ghost" href="/play?mode=guest">
                Jugar como invitado
              </Link>
            </div>
            <p className="hint">
              Continuar usa tu cuenta (nube). Invitado es una partida aparte, solo
              en este navegador.
            </p>
          </>
        ) : (
          <>
            <h2>Jugar</h2>
            <div className="actions">
              <Link className="btn btn-primary" href="/play?mode=guest">
                Jugar como invitado
              </Link>
              <Link className="btn btn-ghost" href="/login">
                Iniciar sesión / Registrarse
              </Link>
            </div>
            <p className="hint">
              Como invitado la partida solo se guarda en este navegador y no usa
              la nube.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
