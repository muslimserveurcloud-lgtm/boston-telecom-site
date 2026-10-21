(() => {
  const URL = window.BOSTON_SUPABASE_URL;
  const KEY = window.BOSTON_SUPABASE_KEY;
  const WA = "237697557671";

  if (!URL || !KEY || !window.supabase) {
    console.error("Configuration Supabase incomplète.");
    return;
  }

  const db = window.supabase.createClient(URL, KEY);

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;",
    '"':"&quot;", "'":"&#39;"
  })[c]);

  const first = (obj, keys, fallback = "") => {
    for (const key of keys) {
      if (obj?.[key] !== undefined && obj[key] !== null && obj[key] !== "")
        return obj[key];
    }
    return fallback;
  };

  function section(id, title) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("section");
      el.id = id;
      el.className = "boston-live-section";
      el.style.cssText =
        "max-width:1200px;margin:35px auto;padding:24px;color:inherit";
      el.innerHTML = `<h2>${title}</h2><div class="boston-live-content">Chargement…</div>`;
      const footer = document.querySelector("footer");
      if (footer) footer.before(el);
      else document.body.appendChild(el);
    }
    return el.querySelector(".boston-live-content");
  }

  async function loadTable(table) {
    const { data, error } = await db.from(table).select("*").limit(30);
    if (error) {
      console.warn("Supabase / " + table + ":", error.message);
      return [];
    }
    return data || [];
  }

  function cards(rows, kind) {
    if (!rows.length) return "<p>Aucun contenu publié pour le moment.</p>";

    return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px">
      ${rows.map(row => {
        const title = first(row, ["name","title","product_name","nom"], "BOSTON TELECOM");
        const desc = first(row, ["description","content","body","details"], "");
        const price = first(row, ["price","prix","amount","price_fcfa"], "");
        const image = first(row, ["image_url","image","photo_url","thumbnail"], "");
        const published = first(row, ["is_active","published","active"], true);
        if (published === false) return "";

        const imageHtml = image
          ? `<img src="${esc(image)}" alt="${esc(title)}" loading="lazy" style="width:100%;height:170px;object-fit:cover;border-radius:10px">`
          : "";

        const order = kind === "products"
          ? `<a href="https://wa.me/${WA}?text=${encodeURIComponent("Bonjour BOSTON TELECOM, je souhaite commander : " + title + (price ? " — " + price + " FCFA" : ""))}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 16px;background:#d5a62e;color:#111;border-radius:8px;text-decoration:none;font-weight:bold">Commander sur WhatsApp</a>`
          : "";

        return `<article style="padding:16px;border:1px solid #b38b32;border-radius:14px;display:flex;flex-direction:column;gap:10px">
          ${imageHtml}<h3>${esc(title)}</h3>
          <p>${esc(desc)}</p>
          ${price !== "" ? `<strong>${esc(price)} FCFA</strong>` : ""}
          ${order}
        </article>`;
      }).join("")}
    </div>`;
  }

  async function refresh() {
    const products = await loadTable("products");
    const news = await loadTable("news_posts");
    const promos = await loadTable("promotions");

    section("boston-live-products", "Nos produits")
      .innerHTML = cards(products, "products");

    section("boston-live-news", "Actualités BOSTON TELECOM")
      .innerHTML = cards(news, "news");

    section("boston-live-promotions", "Promotions")
      .innerHTML = cards(promos, "promotions");
  }

  function authPanel() {
    if (document.getElementById("boston-account")) return;

    const content = section("boston-account", "Espace client");
    content.innerHTML = `
      <p>Crée ton compte client ou connecte-toi.</p>
      <form id="boston-signup" style="display:grid;gap:12px;max-width:440px">
        <input name="name" placeholder="Nom complet" required autocomplete="name"
          style="padding:12px;border-radius:8px">
        <input name="email" type="email" placeholder="Adresse e-mail" required autocomplete="email"
          style="padding:12px;border-radius:8px">
        <input name="password" type="password" placeholder="Mot de passe (8 caractères minimum)"
          required minlength="8" autocomplete="new-password"
          style="padding:12px;border-radius:8px">
        <button type="submit" style="padding:12px;background:#d5a62e;color:#111;border:0;border-radius:8px;font-weight:bold">
          Créer mon compte
        </button>
      </form>
      <hr style="margin:22px 0">
      <form id="boston-login" style="display:grid;gap:12px;max-width:440px">
        <strong>Déjà client ? Connecte-toi</strong>
        <input name="email" type="email" placeholder="Adresse e-mail" required autocomplete="email"
          style="padding:12px;border-radius:8px">
        <input name="password" type="password" placeholder="Mot de passe" required autocomplete="current-password"
          style="padding:12px;border-radius:8px">
        <button type="submit" style="padding:12px;border:1px solid #d5a62e;border-radius:8px">
          Se connecter
        </button>
      </form>
      <p id="boston-auth-message" role="status" aria-live="polite"></p>
      <button id="boston-logout" hidden style="padding:10px;margin-top:10px">Se déconnecter</button>
    `;

    const msg = document.getElementById("boston-auth-message");
    const logout = document.getElementById("boston-logout");

    async function showSession() {
      const { data } = await db.auth.getSession();
      const user = data.session?.user;
      if (user) {
        msg.textContent = "Connecté : " + user.email;
        logout.hidden = false;
      } else {
        logout.hidden = true;
      }
    }

    document.getElementById("boston-signup").addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      msg.textContent = "Création du compte…";
      const { error } = await db.auth.signUp({
        email: f.get("email"),
        password: f.get("password"),
        options: { data: { full_name: f.get("name") } }
      });
      msg.textContent = error
        ? error.message
        : "Demande envoyée. Vérifie ton e-mail si la confirmation est activée.";
    });

    document.getElementById("boston-login").addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      msg.textContent = "Connexion…";
      const { error } = await db.auth.signInWithPassword({
        email: f.get("email"),
        password: f.get("password")
      });
      msg.textContent = error ? error.message : "Connexion réussie.";
      await showSession();
    });

    logout.addEventListener("click", async () => {
      const { error } = await db.auth.signOut();
      msg.textContent = error ? error.message : "Déconnexion effectuée.";
      await showSession();
    });

    showSession();
  }

  function addSocialLinks() {
    if (document.getElementById("boston-social-links")) return;
    const box = document.createElement("section");
    box.id = "boston-social-links";
    box.style.cssText = "text-align:center;padding:20px";
    box.innerHTML = `
      <h2>Suivez BOSTON TELECOM</h2>
      <p>Retrouvez nos nouveautés et contactez notre équipe.</p>
      <a href="https://wa.me/${WA}" target="_blank" rel="noopener"
        style="display:inline-block;padding:12px 18px;background:#d5a62e;color:#111;border-radius:8px;text-decoration:none">
        WhatsApp : commander ou demander un renseignement
      </a>
    `;
    const footer = document.querySelector("footer");
    if (footer) footer.before(box);
    else document.body.appendChild(box);
  }

  async function start() {
    authPanel();
    addSocialLinks();
    await refresh();
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start);
  else start();
})();
