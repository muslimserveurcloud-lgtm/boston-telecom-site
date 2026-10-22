(() => {
  const $ = id => document.getElementById(id);
  const url = window.BOSTON_SUPABASE_URL;
  const key = window.BOSTON_SUPABASE_KEY;
  if (!window.supabase || !url || !key) {
    $("auth-message").textContent = "Configuration Supabase introuvable. Vérifie supabase-config.js.";
    return;
  }
  const db = window.supabase.createClient(url, key);
  let user = null, isAdmin = false, signup = false, products = [], cart = [];

  const money = n => new Intl.NumberFormat("fr-FR").format(Number(n || 0)) + " FCFA";
  const escapeHTML = s => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  function message(text, where="app-message") {
    const el = $(where); el.textContent = text; el.classList.remove("hidden");
  }
  function clearMessage(where) { $(where).textContent = ""; $(where).classList.add("hidden"); }

  function authMode(mode) {
    signup = mode === "signup";
    $("tab-login").classList.toggle("active", !signup);
    $("tab-signup").classList.toggle("active", signup);
    $("confirm-wrap").classList.toggle("hidden", !signup);
    $("auth-submit").textContent = signup ? "Créer mon compte" : "Se connecter";
    $("password").autocomplete = signup ? "new-password" : "current-password";
    $("auth-message").textContent = "";
  }
  $("tab-login").onclick = () => authMode("login");
  $("tab-signup").onclick = () => authMode("signup");

  $("auth-form").onsubmit = async e => {
    e.preventDefault();
    const email = $("email").value.trim(), password = $("password").value;
    const btn = $("auth-submit"); btn.disabled = true;
    $("auth-message").textContent = "Traitement en cours…";
    try {
      if (signup) {
        if (password !== $("confirm-password").value) throw new Error("Les mots de passe ne correspondent pas.");
        const {data,error} = await db.auth.signUp({email,password});
        if (error) throw error;
        if (!data.session) {
          $("auth-message").textContent = "Compte créé. Vérifie ta boîte e-mail, puis connecte-toi.";
        } else {
          $("auth-message").textContent = "Compte créé. Chargement de ton espace…";
        }
      } else {
        const {error} = await db.auth.signInWithPassword({email,password});
        if (error) throw error;
      }
    } catch(err) {
      $("auth-message").textContent = err.message || "Une erreur est survenue.";
    } finally { btn.disabled = false; }
  };

  $("logout").onclick = async () => { await db.auth.signOut(); };
  $("nav-tabs").querySelectorAll("[data-page]").forEach(btn => {
    btn.onclick = () => showPage(btn.dataset.page);
  });
  function showPage(page) {
    if (page === "admin" && !isAdmin) page = "catalog";
    ["catalog","orders","admin"].forEach(p => $("page-"+p).classList.toggle("hidden",p!==page));
    $("nav-tabs").querySelectorAll("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
    if (page==="orders") loadOrders(false);
    if (page==="admin" && isAdmin) {loadOrders(true); loadAdminProducts();}
  }
  async function start(sessionUser) {
    user = sessionUser;
    if (!user) {
      isAdmin = false; $("app-screen").classList.add("hidden"); $("auth-screen").classList.remove("hidden");
      $("session-label").textContent = "Espace sécurisé"; return;
    }
    $("auth-screen").classList.add("hidden"); $("app-screen").classList.remove("hidden");
    $("session-label").textContent = user.email;
    $("welcome").textContent = "Mon espace";
    const {data:adminData,error:adminError} = await db.from("site_admins").select("user_id").eq("user_id",user.id).maybeSingle();
    isAdmin = !adminError && !!adminData;
    $("role-label").textContent = isAdmin ? "Administrateur vérifié" : "Espace client";
    $("admin-tab").classList.toggle("hidden",!isAdmin);
    showPage("catalog"); await loadProducts();
  }
  async function loadProducts() {
    $("products").innerHTML = '<p class="muted">Chargement des produits…</p>';
    const {data,error} = await db.from("products")
      .select("id,name,description,category,price,currency,image_url,stock,is_published")
      .eq("is_published",true).order("created_at",{ascending:false});
    if(error) { $("products").textContent="Impossible de charger le catalogue : "+error.message; return; }
    products=data||[];
    renderProducts();
  }
  function renderProducts() {
    $("products").innerHTML = products.length ? products.map(p=>`
      <article class="item">
      ${p.image_url ? `<img src="${escapeHTML(p.image_url)}" alt="${escapeHTML(p.name)}" loading="lazy">`:""}
      <p class="muted">${escapeHTML(p.category)}</p><h3>${escapeHTML(p.name)}</h3>
      <p>${escapeHTML(p.description)}</p><p class="price">${money(p.price)}</p>
      <p class="muted">Stock : ${Number(p.stock||0)}</p>
      <button class="btn" data-add="${escapeHTML(p.id)}" ${Number(p.stock||0)<=0?"disabled":""}>Ajouter au panier</button>
      </article>`).join("") : '<p class="muted">Aucun produit publié pour le moment. Reviens bientôt.</p>';
    $("products").querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{
      const p=products.find(x=>x.id===b.dataset.add); if(!p)return;
      const line=cart.find(x=>x.id===p.id);
      if(line) {if(line.quantity>=Number(p.stock||0))return;line.quantity++;}
      else cart.push({id:p.id,name:p.name,price:Number(p.price||0),quantity:1,stock:Number(p.stock||0)});
      renderCart();
    });
  }
  function renderCart() {
    $("cart-lines").innerHTML=cart.length ? cart.map(x=>`
      <div class="row"><span>${escapeHTML(x.name)} × ${x.quantity}</span>
      <span>${money(x.price*x.quantity)} <button type="button" class="tab" data-remove="${escapeHTML(x.id)}">−</button></span></div>`).join("") : "Ton panier est vide.";
    $("cart-total").textContent=money(cart.reduce((s,x)=>s+x.price*x.quantity,0));
    $("cart-lines").querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{
      const line=cart.find(x=>x.id===b.dataset.remove);if(line)line.quantity--;
      cart=cart.filter(x=>x.quantity>0);renderCart();
    });
  }
  $("refresh-products").onclick=loadProducts;

  $("order-form").onsubmit=async e=>{
    e.preventDefault();
    if(!cart.length){message("Ajoute au moins un produit avant de commander.");return;}
    const btn=e.submitter; if(btn)btn.disabled=true;
    try{
      // Recheck current prices and stock; never trust the browser's cart values.
      const {data:current,error:checkError}=await db.from("products")
        .select("id,name,price,stock,is_published").in("id",cart.map(x=>x.id));
      if(checkError)throw checkError;
      const lines=cart.map(line=>{
        const p=(current||[]).find(x=>x.id===line.id);
        if(!p||!p.is_published)throw new Error("Un produit n'est plus disponible.");
        if(line.quantity>Number(p.stock||0))throw new Error("Stock insuffisant pour "+p.name+".");
        return {product_id:p.id,name:p.name,quantity:line.quantity,unit_price:Number(p.price),line_total:Number(p.price)*line.quantity};
      });
      const subtotal=lines.reduce((s,x)=>s+x.line_total,0);
      const {data:created,error}=await db.from("orders").insert({
        user_id:user.id,customer_name:$("customer-name").value.trim(),
        customer_phone:$("customer-phone").value.trim(),
        delivery_address:$("delivery-address").value.trim()||null,
        notes:$("order-notes").value.trim()||null,items:lines,subtotal,total:subtotal,currency:"FCFA"
      }).select("order_number").single();
      if(error)throw error;
      message("Commande "+created.order_number+" enregistrée. Notre équipe te contactera pour confirmer la disponibilité et la livraison.");
      cart=[];renderCart();$("order-form").reset();await loadOrders(false);
    }catch(err){message(err.message||"Commande impossible.");}
    finally{if(btn)btn.disabled=false;}
  };

  async function loadOrders(admin) {
    const target=$(admin?"admin-orders":"orders-list");target.textContent="Chargement…";
    let query=db.from("orders").select("id,order_number,customer_name,customer_phone,items,total,currency,status,payment_status,created_at,user_id").order("created_at",{ascending:false}).limit(100);
    if(!admin)query=query.eq("user_id",user.id);
    const {data,error}=await query;
    if(error){target.textContent="Erreur de chargement : "+error.message;return;}
    if(!data?.length){target.textContent="Aucune commande pour le moment.";return;}
    target.innerHTML=`<div style="overflow-x:auto"><table><thead><tr><th>Commande</th><th>Client</th><th>Total</th><th>État</th>${admin?"<th>Action</th>":""}</tr></thead><tbody>${data.map(o=>`<tr>
      <td>${escapeHTML(o.order_number)}<br><small class="muted">${new Date(o.created_at).toLocaleDateString("fr-FR")}</small></td>
      <td>${escapeHTML(o.customer_name)}<br>${escapeHTML(o.customer_phone)}</td>
      <td>${money(o.total)}</td><td>${escapeHTML(o.status)}</td>
      ${admin?`<td><select data-status="${escapeHTML(o.id)}"><option value="pending">En attente</option><option value="confirmed">Confirmée</option><option value="processing">En préparation</option><option value="shipped">Expédiée</option><option value="delivered">Livrée</option><option value="cancelled">Annulée</option></select><button class="tab" data-save="${escapeHTML(o.id)}">Enregistrer</button></td>`:""}
      </tr>`).join("")}</tbody></table></div>`;
    if(admin)data.forEach(o=>{
      const sel=target.querySelector(`[data-status="${o.id}"]`);if(sel)sel.value=o.status;
      const b=target.querySelector(`[data-save="${o.id}"]`);if(b)b.onclick=async()=>{
        const status=sel.value;
        const {error}=await db.from("orders").update({status,updated_at:new Date().toISOString()}).eq("id",o.id);
        if(error)message("Modification refusée : "+error.message);else{message("Commande mise à jour.");loadOrders(true);}
      };
    });
  }
  $("product-form").onsubmit=async e=>{
    e.preventDefault();if(!isAdmin)return;
    const btn=e.submitter;if(btn)btn.disabled=true;
    try{
      const {error}=await db.from("products").insert({
        name:$("p-name").value.trim(),description:$("p-description").value.trim(),
        category:$("p-category").value,price:Number($("p-price").value),
        stock:Number($("p-stock").value),image_url:$("p-image").value.trim()||null,
        currency:"FCFA",is_published:$("p-published").checked
      });
      if(error)throw error;
      e.target.reset();$("p-stock").value="1";$("p-published").checked=true;
      message("Produit enregistré.");await loadProducts();await loadAdminProducts();
    }catch(err){message("Enregistrement impossible : "+err.message);}
    finally{if(btn)btn.disabled=false;}
  };
  async function loadAdminProducts(){
    const target=$("admin-products");target.textContent="Chargement…";
    const {data,error}=await db.from("products").select("id,name,price,stock,is_published").order("created_at",{ascending:false}).limit(100);
    if(error){target.textContent="Erreur : "+error.message;return;}
    target.innerHTML=(data||[]).map(p=>`<article class="item"><h3>${escapeHTML(p.name)}</h3><p>${money(p.price)} · Stock ${Number(p.stock||0)}</p><p>${p.is_published?"Publié":"Masqué"}</p><div class="actions"><button class="tab" data-publish="${escapeHTML(p.id)}" data-value="${!p.is_published}">${p.is_published?"Masquer":"Publier"}</button><button class="tab" data-stock="${escapeHTML(p.id)}">Modifier stock</button></div></article>`).join("")||"Aucun produit.";
    target.querySelectorAll("[data-publish]").forEach(b=>b.onclick=async()=>{
      const {error}=await db.from("products").update({is_published:b.dataset.value==="true"}).eq("id",b.dataset.publish);
      if(error)message("Erreur : "+error.message);else{await loadProducts();await loadAdminProducts();}
    });
    target.querySelectorAll("[data-stock]").forEach(b=>b.onclick=async()=>{
      const p=data.find(x=>x.id===b.dataset.stock);const value=prompt("Nouveau stock pour "+p.name,p.stock);
      if(value===null)return;const stock=Number(value);if(!Number.isInteger(stock)||stock<0){message("Stock invalide.");return;}
      const {error}=await db.from("products").update({stock}).eq("id",p.id);
      if(error)message("Erreur : "+error.message);else{await loadProducts();await loadAdminProducts();}
    });
  }

  db.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>start(session?.user||null),0);});
  db.auth.getSession().then(({data})=>start(data.session?.user||null));
})();
