/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ADMIN — Edge Function Supabase
 *
 *  RAISON D'ÊTRE
 *  Aujourd'hui la clé `service_role` est écrite en clair dans index.html.
 *  Quiconque ouvre le code source de la page obtient un accès TOTAL à la base :
 *  lire toutes les fiches clients, les modifier, tout supprimer.
 *
 *  Cette fonction déplace ce pouvoir côté serveur. La clé ne quitte plus
 *  jamais Supabase. Le navigateur n'envoie qu'un mot de passe admin, et ne
 *  reçoit que le résultat demandé.
 *
 *  DÉPLOIEMENT
 *    supabase functions deploy admin --no-verify-jwt
 *    supabase secrets set ADMIN_PASSWORD='<un mot de passe long et unique>'
 *
 *  (SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement
 *   par Supabase à la fonction — rien à configurer pour eux.)
 * ═══════════════════════════════════════════════════════════════════════════
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") ?? "";

// Origines autorisées à appeler cette fonction. À adapter à ton domaine.
const ORIGINES = [
  "https://renaissance-yanisbgh.com",
  "https://strassweb67.github.io",
  "http://localhost:3000",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const autorise = origin && ORIGINES.includes(origin) ? origin : ORIGINES[0];
  return {
    "Access-Control-Allow-Origin": autorise,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

/**
 * Comparaison à temps constant.
 * Un `===` classique s'arrête au premier caractère différent : le temps de
 * réponse trahit alors le nombre de caractères corrects, ce qui permet de
 * deviner le mot de passe lettre par lettre. Ici le temps ne dépend jamais
 * du contenu.
 */
function memeSecret(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

/** Appel PostgREST avec la clé service_role — jamais exposée au navigateur. */
async function sb(chemin: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Prefer": "return=representation",
      ...(init.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const ct = r.headers.get("content-type") ?? "";
  return ct.includes("json") ? await r.json() : null;
}

async function rpc(nom: string, params: unknown) {
  return await sb(`rpc/${nom}`, { method: "POST", body: JSON.stringify(params) });
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: cors });
  }

  const json = (corps: unknown, status = 200) =>
    new Response(JSON.stringify(corps), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const { action, password, params = {} } = await req.json();

    if (!ADMIN_PASSWORD) {
      return json({ error: "ADMIN_PASSWORD non configuré côté serveur" }, 500);
    }
    if (!memeSecret(String(password ?? ""), ADMIN_PASSWORD)) {
      // Délai fixe : ne distingue pas « mauvais mot de passe » d'autre chose.
      await new Promise((r) => setTimeout(r, 400));
      return json({ error: "Accès refusé" }, 401);
    }

    switch (action) {
      // ── Lecture ────────────────────────────────────────────────────────
      case "leads":
        return json(await sb("diag_leads?order=ts.desc&limit=1000"));

      case "visitors":
        return json(await sb(
          "visitors?select=*,visitor_events(id,label,event_time,created_at)" +
          "&order=created_at.desc&limit=500",
        ));

      case "stats":
        return json(await sb("page_visits?order=visit_date.desc&limit=365"));

      case "arbitrage":
        return json(await sb("rn_arbitrage?limit=200"));

      // ── Paiements ──────────────────────────────────────────────────────
      case "resolve_payment":
        return json(await rpc("rn_resolve_payment", {
          p_payment_id: params.payment_id,
          p_lead_id: params.lead_id,
        }));

      case "force_unlock":
        return json(await rpc("rn_force_unlock", {
          p_lead_id: params.lead_id,
          p_note: params.note ?? null,
        }));

      // ── Configuration du site (prix + lien Revolut) ────────────────────
      case "config_get":
        return json(await sb(
          "diag_leads?source=eq.__site_config&select=potentiel,axe_prioritaire" +
          "&order=ts.desc&limit=1",
        ));

      case "config_set": {
        const corps = {
          potentiel: params.price,
          axe_prioritaire: params.link,
          ts: new Date().toISOString(),
        };
        const exist = await sb(
          "diag_leads?source=eq.__site_config&select=id&limit=1",
        );
        if (Array.isArray(exist) && exist.length) {
          return json(await sb("diag_leads?source=eq.__site_config", {
            method: "PATCH",
            body: JSON.stringify(corps),
          }));
        }
        return json(await sb("diag_leads", {
          method: "POST",
          body: JSON.stringify({ ...corps, source: "__site_config" }),
        }));
      }

      // ── Suppression (admin uniquement) ─────────────────────────────────
      case "delete_lead":
        return json(await sb(
          `diag_leads?id=eq.${encodeURIComponent(params.id)}`,
          { method: "DELETE" },
        ));

      case "delete_visitor":
        return json(await sb(
          `visitors?id=eq.${encodeURIComponent(params.id)}`,
          { method: "DELETE" },
        ));

      default:
        return json({ error: `action inconnue : ${action}` }, 400);
    }
  } catch (e) {
    console.error("[admin]", e);
    // Message générique : ne divulgue ni schéma ni détail interne.
    return json({ error: "Erreur serveur" }, 500);
  }
});
