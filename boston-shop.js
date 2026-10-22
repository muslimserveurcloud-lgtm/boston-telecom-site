(() => {
  const db = window.supabase?.createClient(
    window.BOSTON_SUPABASE_URL,
    window.BOSTON_SUPABASE_KEY
  );
  if (!db) return;

  const money = n => Number(n || 0).toLocaleString("fr-FR") + " FCFA";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);

  let products = [];
  let cart = {};

  function mount() {
    const section = document.getElementById("produits");
    if (!section || document.getElementById("bt-live-catalog")) return;
    const oldGrid = section.querySelector(".product-grid");
    if (oldGrid) oldGrid.hidden = true;

    const catalog = document.createElement("div");
    catalog.id = "bt-live-catalog";
    catalog.innerHTML = `
      <p id="bt-shop-status">Chargement du catalogue…</p>
      <div id="bt-shop-grid" class="product-grid"></div>
      <section class="bt-cart">
        <h2>Mon panier</h2>
        <div id="bt-cart-items">Votre panier est vide.</div>
        <p>Total indicatif : <strong id="bt-cart-total">0 FCFA</strong></p>
        <form id="bt-order-form">
          <input name="name" placeholder="Votre nom complet" required>
          <input name="phone" placeholder="Votre numéro WhatsApp" required>
          <input name="address" placeholder="Adresse de livraison">
          <button type="submit">Envoyer la commande sur WhatsApp</button>
        </form>
      </section>`;
    section.appendChild(catalog);

    catalog.querySelector("#bt-order-form").addEventListener("submit", e => {
      e.preventDefault();
      const items = products.filter(p => cart[p.id]).map(p =>
        `${p.name} x${cart[p.id]} — ${money(p.price)}`
      );
      if (!items.length) return alert("Votre panier est vide.");
      const f = new FormData(e.currentTarget);
      const total = products.reduce((s,p) => s + Number(p.price || 0) * (cart[p.id] || 0), 0);
      const message = [
        "Bonjour BOSTON TELECOM, je souhaite commander :",
        ...items, `Total indicatif : ${money(total)}`,
        `Nom : ${f.get("name")}`, `Téléphone : ${f.get("phone")}`,
        `Adresse : ${f.get("address") || "À préciser"}`,
        "Merci de confirmer le stock, le prix final et la livraison."
      ].join("\n");
      location.href = "https://wa.me/237697557671?text=" + encodeURIComponent(message);
    });
  }

  function renderCart() {
    const box = document.getElementById("bt-cart-items");
    if (!box) return;
    const chosen = products.filter(p => cart[p.id]);
    box.innerHTML = chosen.length ? chosen.map(p => `
      <p>${esc(p.name)} × ${cart[p.id]}
      <button type="button" data-remove="${esc(p.id)}">−</button>
      <button type="button" data-add="${esc(p.id)}">+</button>
      <strong>${money(Number(p.price || 0) * cart[p.id])}</strong></p>
    `).join("") : "Votre panier est vide.";
    const total = chosen.reduce((s,p) => s + Number(p.price || 0) * cart[p.id], 0);
    document.getElementById("bt-cart-total").textContent = money(total);
    box.querySelectorAll("[data-add]").forEach(b => b.onclick = () => {
      const p = products.find(x => x.id === b.dataset.add);
      if (p && cart[p.id] < Number(p.stock || 0)) cart[p.id]++;
      renderCart();
    });
    box.querySelectorAll("[data-remove]").forEach(b => b.onclick = () => {
      const id = b.dataset.remove;
      cart[id] = Math.max(0, (cart[id] || 0) - 1);
      renderCart();
    });
  }

  async function load() {
    mount();
    const status = document.getElementById("bt-shop-status");
    const grid = document.getElementById("bt-shop-grid");
    if (!grid) return;
    const {data, error} = await db.from("products")
      .select("id,name,description,category,price,currency,image_url,stock")
      .eq("is_published", true)
      .order("created_at", {ascending:false});
    if (error) {
      status.textContent = "Catalogue indisponible pour le moment. Contactez-nous sur WhatsApp.";
      console.error(error);
      return;
    }
    products = data || [];
    status.textContent = products.length
      ? `${products.length} produit(s) disponible(s)`
      : "Les produits seront bientôt disponibles. Contactez-nous sur WhatsApp.";
    grid.innerHTML = products.map(p => `
      <article class="product-card">
        <div class="product-image">
          ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy" style="width:100%;height:100%;object-fit:contain">` : ""}
        </div>
        <div class="product-info">
          <div class="product-type">${esc(p.category)}</div>
          <h3>${esc(p.name)}</h3><p>${esc(p.description)}</p>
          <strong>${p.price == null ? "Prix sur demande" : money(p.price)}</strong>
          <p>${Number(p.stock || 0) > 0 ? `Stock : ${Number(p.stock)}` : "Disponibilité à confirmer"}</p>
          <button type="button" data-buy="${esc(p.id)}"
            ${Number(p.stock || 0) <= 0 ? "disabled" : ""}>
            Ajouter au panier
          </button>
        </div>
      </article>`).join("");
    grid.querySelectorAll("[data-buy]").forEach(b => b.onclick = () => {
      const p = products.find(x => x.id === b.dataset.buy);
      if (p && (cart[p.id] || 0) < Number(p.stock || 0)) cart[p.id] = (cart[p.id] || 0) + 1;
      renderCart();
    });
    renderCart();
  }

  const style = document.createElement("style");
  style.textContent = `
    #bt-live-catalog{margin-top:25px}
    .bt-cart{margin-top:35px;padding:22px;border:1px solid #b38b32;border-radius:14px}
    .bt-cart form{display:grid;gap:12px;max-width:520px}
    .bt-cart input,.bt-cart button,#bt-shop-grid button{padding:12px;border-radius:8px}
    .bt-cart button,#bt-shop-grid button{background:#d5a62e;color:#111;border:0;font-weight:bold}
    #bt-shop-grid button:disabled{opacity:.5}
    #bt-shop-grid .product-image{overflow:hidden}
  `;
  document.head.appendChild(style);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
})();
