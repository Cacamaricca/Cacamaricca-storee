-- CACAMARICCA STORE DATABASE
-- Jalankan di Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('jedai','karet','jepit','bando','clothes')),
  price integer not null check (price >= 0),
  image_url text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  color_name text not null,
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  created_at timestamptz not null default now(),
  unique(product_id,color_name)
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  buyer_name text not null,
  buyer_class text not null,
  payment_method text not null check (payment_method in ('transfer','cash')),
  total integer not null check (total >= 0),
  status text not null default 'new' check (status in ('new','waiting_payment','paid','ready','done','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  variant_id uuid not null references product_variants(id),
  product_name text not null,
  color_name text not null,
  price integer not null,
  qty integer not null check (qty > 0),
  subtotal integer not null
);

alter table products enable row level security;
alter table product_variants enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

drop policy if exists "public read active products" on products;
create policy "public read active products" on products for select using (active = true);

drop policy if exists "public read variants" on product_variants;
create policy "public read variants" on product_variants for select using (true);

-- Admin CRUD dilakukan oleh user yang login.
drop policy if exists "authenticated manage products" on products;
create policy "authenticated manage products" on products for all to authenticated using (true) with check (true);

drop policy if exists "authenticated manage variants" on product_variants;
create policy "authenticated manage variants" on product_variants for all to authenticated using (true) with check (true);

-- Order dibuat lewat RPC di bawah, bukan direct insert dari browser.
revoke all on orders from anon, authenticated;
revoke all on order_items from anon, authenticated;

create or replace function create_order(
  buyer_name text,
  buyer_class text,
  payment_method text,
  items jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  order_id uuid := gen_random_uuid();
  code text := 'CC-' || upper(substr(replace(order_id::text,'-',''),1,6));
  total integer := 0;
  item jsonb;
  v record;
  p record;
  q integer;
  subtotal integer;
begin
  if trim(buyer_name) = '' or trim(buyer_class) = '' then
    raise exception 'Nama dan kelas wajib diisi.';
  end if;

  if payment_method not in ('transfer','cash') then
    raise exception 'Metode pembayaran tidak valid.';
  end if;

  if jsonb_array_length(items) = 0 then
    raise exception 'Keranjang kosong.';
  end if;

  -- Lock semua variant yang dibeli supaya stock tidak oversold
  for item in select * from jsonb_array_elements(items)
  loop
    q := (item->>'qty')::integer;
    if q <= 0 then raise exception 'Jumlah item tidak valid.'; end if;

    select pv.*, p.name, p.price
      into v
      from product_variants pv
      join products p on p.id=pv.product_id
      where pv.id=(item->>'variant_id')::uuid
        and p.id=(item->>'product_id')::uuid
        and p.active=true
      for update;

    if not found then raise exception 'Produk/warna tidak ditemukan.'; end if;
    if v.stock < q then raise exception 'Stock % untuk % tidak cukup.', v.stock, v.name; end if;

    subtotal := v.price * q;
    total := total + subtotal;
  end loop;

  insert into orders(order_id, order_code, buyer_name, buyer_class, payment_method, total, status)
  values(order_id, code, trim(buyer_name), trim(buyer_class), payment_method, total,
         case when payment_method='transfer' then 'waiting_payment' else 'new' end);

  for item in select * from jsonb_array_elements(items)
  loop
    q := (item->>'qty')::integer;
    select pv.*, p.name, p.price into v
      from product_variants pv join products p on p.id=pv.product_id
      where pv.id=(item->>'variant_id')::uuid for update;

    update product_variants set stock=stock-q where id=v.id;

    insert into order_items(order_id,product_id,variant_id,product_name,color_name,price,qty,subtotal)
    values(order_id,v.product_id,v.id,v.name,v.color_name,v.price,q,v.price*q);
  end loop;

  return json_build_object('order_code',code,'total',total);
end;
$$;

grant execute on function create_order(text,text,text,jsonb) to anon, authenticated;

-- Realtime untuk stock.
alter table product_variants replica identity full;
