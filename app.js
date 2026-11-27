import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const rupiah = n => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
let products = [], cart = JSON.parse(localStorage.getItem("cacamaricca-cart") || "[]");
let currentFilter = "all";

document.addEventListener("DOMContentLoaded", async () => {
  setTimeout(()=>document.getElementById("opening")?.classList.add("hide"), 1700);
  bindUI();
  await loadProducts();
  subscribeRealtime();
  renderCart();
});

function bindUI(){
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
  document.getElementById("cartBtn").onclick=openCart;
  document.getElementById("closeCart").onclick=closeCart;
  document.getElementById("drawerBackdrop").onclick=closeCart;
  document.getElementById("checkoutBtn").onclick=openCheckout;
  document.getElementById("checkoutForm").onsubmit=submitOrder;

  document.querySelectorAll(".filter").forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      currentFilter=btn.dataset.filter;
      renderProducts();
    };
  });

  document.querySelectorAll(".category-card").forEach(card=>{
    card.onclick=(e)=>{
      e.preventDefault();
      currentFilter=card.dataset.category;
      document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x.dataset.filter===currentFilter));
      document.getElementById("shopTitle").textContent=currentFilter;
      document.getElementById("shop").scrollIntoView({behavior:"smooth"});
      renderProducts();
    };
  });
}

async function loadProducts(){
  const {data,error}=await supabase.from("products").select("*, product_variants(*)").eq("active",true).order("created_at",{ascending:false});
  if(error){console.error(error); document.getElementById("productGrid").innerHTML=`<div class="loading">Database belum tersambung. Cek config.js & SQL setup.</div>`;return}
  products=data||[]; renderProducts();
}

function renderProducts(){
  const list=currentFilter==="all"?products:products.filter(p=>p.category===currentFilter);
  const grid=document.getElementById("productGrid");
  if(!list.length){grid.innerHTML=`<div class="loading">Belum ada produk di kategori ini.</div>`;return}
  grid.innerHTML=list.map(p=>{
    const stock=p.product_variants?.reduce((a,v)=>a+Number(v.stock||0),0)||0;
    return `<article class="product-card">
      <div class="product-img">
        <img src="${safe(p.image_url||placeholder())}" alt="${safe(p.name)}" loading="lazy">
        ${stock<=0?'<span class="sold-out">SOLD OUT</span>':''}
      </div>
      <div class="product-info">
        <div class="product-cat">${safe(p.category)}</div>
        <div class="product-name">${safe(p.name)}</div>
        <div class="price">${rupiah(p.price)}</div>
        <div class="stock">${stock>0?`${stock} pcs available`:"habis"}</div>
        <div class="card-actions">
          <button class="small-btn" onclick="openProduct('${p.id}')">details</button>
          <button class="small-btn dark" ${stock<=0?"disabled":""} onclick="quickAdd('${p.id}')">+ bag</button>
        </div>
      </div>
    </article>`;
  }).join("");
}

window.openProduct = function(id){
  const p=products.find(x=>x.id===id); if(!p)return;
  const variants=p.product_variants||[];
  document.getElementById("productDetailContent").innerHTML=`
    <div class="product-detail-grid">
      <img class="detail-image" src="${safe(p.image_url||placeholder())}" alt="${safe(p.name)}">
      <div>
        <div class="product-cat">${safe(p.category)}</div>
        <h2>${safe(p.name)}</h2>
        <div class="detail-price">${rupiah(p.price)}</div>
        <p>${safe(p.description||"cute everyday essential dari Cacamaricca.")}</p>
        <div class="variant-label">PILIH WARNA</div>
        <div class="colors" id="colors-${p.id}">
          ${variants.length?variants.map((v,i)=>`<button class="color-btn ${i===0?"selected":""}" data-variant="${v.id}" onclick="selectColor(this,'${p.id}')">${safe(v.color_name)} · ${v.stock} pcs</button>`).join(""):"<small>Belum ada pilihan warna.</small>"}
        </div>
        <button class="primary-btn full" style="margin-top:25px" onclick="addSelected('${p.id}')">add to cart +</button>
      </div>
    </div>`;
  openModal("productModal");
};

window.selectColor=function(btn,pid){
  document.querySelectorAll(`#colors-${pid} .color-btn`).forEach(x=>x.classList.remove("selected"));
  btn.classList.add("selected");
};
window.addSelected=function(pid){
  const p=products.find(x=>x.id===pid); if(!p)return;
  const selected=document.querySelector(`#colors-${pid} .selected`);
  if(!selected){alert("Pilih warna dulu.");return}
  const v=p.product_variants.find(x=>x.id===selected.dataset.variant);
  addToCart(p,v); closeModal("productModal");
};
window.quickAdd=function(pid){
  const p=products.find(x=>x.id===pid), v=(p.product_variants||[]).find(x=>x.stock>0);
  if(v)addToCart(p,v); else alert("Produk sedang habis.");
};

function addToCart(p,v){
  const key=`${p.id}:${v.id}`;
  const found=cart.find(x=>x.key===key);
  if(found) found.qty=Math.min(found.qty+1,v.stock);
  else cart.push({key,product_id:p.id,variant_id:v.id,name:p.name,color:v.color_name,price:Number(p.price),image:p.image_url||placeholder(),qty:1,maxStock:v.stock});
  saveCart(); renderCart(); openCart();
}

function saveCart(){localStorage.setItem("cacamaricca-cart",JSON.stringify(cart));document.getElementById("cartCount").textContent=cart.reduce((a,x)=>a+x.qty,0)}
function renderCart(){
  saveCart();
  const el=document.getElementById("cartItems");
  if(!cart.length){el.innerHTML=`<div class="loading">Keranjang masih kosong ♡</div>`;document.getElementById("cartTotal").textContent=rupiah(0);return}
  el.innerHTML=cart.map((x,i)=>`<div class="cart-item">
    <img src="${safe(x.image)}" alt="">
    <div><h4>${safe(x.name)}</h4><small>${safe(x.color)} · ${rupiah(x.price)}</small>
      <div class="qty"><button onclick="changeQty(${i},-1)">−</button><b>${x.qty}</b><button onclick="changeQty(${i},1)">+</button></div>
    </div>
    <button class="remove" onclick="removeItem(${i})">remove</button>
  </div>`).join("");
  document.getElementById("cartTotal").textContent=rupiah(cart.reduce((a,x)=>a+x.price*x.qty,0));
}
window.changeQty=function(i,d){cart[i].qty=Math.max(1,Math.min(cart[i].qty+d,cart[i].maxStock));saveCart();renderCart()}
window.removeItem=function(i){cart.splice(i,1);saveCart();renderCart()}
function openCart(){document.getElementById("cartDrawer").classList.add("open");document.getElementById("drawerBackdrop").classList.remove("hidden")}
function closeCart(){document.getElementById("cartDrawer").classList.remove("open");document.getElementById("drawerBackdrop").classList.add("hidden")}
function openModal(id){document.getElementById(id).classList.remove("hidden")}
function closeModal(id){document.getElementById(id).classList.add("hidden")}

function openCheckout(){
  if(!cart.length){alert("Keranjang masih kosong.");return}
  closeCart();
  document.getElementById("checkoutPreview").innerHTML=cart.map(x=>`<div class="preview-line"><span>${safe(x.name)} (${safe(x.color)}) × ${x.qty}</span><b>${rupiah(x.price*x.qty)}</b></div>`).join("");
  document.getElementById("checkoutTotal").textContent=rupiah(cart.reduce((a,x)=>a+x.price*x.qty,0));
  openModal("checkoutModal");
}

async function submitOrder(e){
  e.preventDefault();
  const btn=e.submitter; btn.disabled=true; btn.textContent="processing...";
  const payload={
    buyer_name:document.getElementById("buyerName").value.trim(),
    buyer_class:document.getElementById("buyerClass").value.trim(),
    payment_method:document.getElementById("paymentMethod").value,
    items:cart.map(x=>({product_id:x.product_id,variant_id:x.variant_id,qty:x.qty}))
  };
  const {data,error}=await supabase.rpc("create_order",payload);
  btn.disabled=false;btn.textContent="place order";
  if(error){alert(error.message||"Order gagal dibuat. Coba lagi.");return}
  cart=[];saveCart();renderCart();closeModal("checkoutModal");
  document.getElementById("successText").textContent=`Order ${data.order_code} berhasil dibuat. Total ${rupiah(data.total)}.`;
  openModal("successModal");
}

function subscribeRealtime(){
  supabase.channel("store-stock").on("postgres_changes",{event:"*",schema:"public",table:"product_variants"},()=>loadProducts()).subscribe();
}
function placeholder(){return "https://placehold.co/800x800/F3E8ED/241C22?text=CACAMARICCA"}
function safe(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
