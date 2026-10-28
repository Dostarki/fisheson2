# FISHESRH (Frostfish / fishesbetav1)

Gorev: https://github.com/Dostarki/fishesbetav1 reposunu cek ve calistir; ustune market genisletmesi.

## Mimari
- React (CRA) + react-three-fiber voxel ada; FastAPI + MongoDB; SIWE cuzdan girisi (Robinhood Chain 4663); token odemeli balikci satin alma.
- Gizli admin paneli: `/errorlogin404495959` (ADMIN_PASSWORD backend/.env).
- Karakter tanimlari: `backend/game.py` CHARACTERS + `frontend/src/lib/gameData.js` CREW (ayna).

## Yapilanlar
### 2026-06 (ilk fork)
- Repo /app altina kuruldu, bagimliliklar yuklendi, backend+frontend calisiyor.
- Env: ROBINHOOD_CHAIN_ID=4663, public RPC, APP_URL=preview, ADMIN_PASSWORD, WalletConnect Project ID.
- Sol ust "FROSTFISH" yazisi -> "FISHESRH".

### 2026-06 (market genisletmesi) — test edildi (iteration_1, 25/25 backend, frontend %100)
- 4 yeni karakter: yacht (The Yachtsman, $100, 3x, 60s dinlenme), sub (The Submariner, $200, 5x, 30s, koyda dolasir),
  flagship (The Admiral, $400, 10x, 30s, dolasir), mothership (The Legend, $1000, 20x, KILITLI).
- Kazanc: carpanli karakterler Kaptan'in saatlik kazancinin (boat fiyati/48) katini kazanir; fiyattan bagimsiz. Worker'a satin alma aninda `hourly_usd` yazilir.
- Kilit: `locked_characters` ayari (varsayilan ['mothership']); quote ve confirm 423 doner. Admin panelde "7th character on sale" toggle.
- Admin panelde 7 fiyat alani; eksik fiyat gonderilirse mevcut deger korunur.
- Market: yatay kaydirmali serit + sag/sol oklar (market-prev/next-button), carpan rozeti, LOCKED/COMING SOON karti.
- 3D: yat/denizalti/amiral gemisi/mothership voxel modelleri; tum gemiler ortak global slot grid'inde (4.5 x 7 birim hucre) park eder -> park yerleri asla cakismaz. Denizalti ve amiral gemisi balik tutarken kendi hucresinde kucuk daire cizer.
- Kart gorselleri (CharacterArt) Kaptan kartindan turetilmis gelismis tekne SVG'leri.
- Testler: backend/tests/test_frostfish_characters.py eklendi; admin ayarlarini degistiren moduller dosya kilidiyle serilestirildi.

### 2026-06 (anlik market cap) — agent-tested (2 yeni backend testi gecti, screenshot)
- `chain.erc20_total_supply` + `pricing.total_supply/market_cap` (60s cache): mcap = totalSupply x canli token fiyati.
- `/api/config` -> `marketCapUsd`, `totalSupply`; `/api/admin/settings` -> `marketCap`.
- UI: `MarketCapBadge` (data-testid market-cap-badge/-value) ust header'da (karsilama) ve oyun ici HUD'da (hud-sub); launchpad'e link. Admin "Live status" karti: Market cap.


## Backlog
- TREASURY_PRIVATE_KEY eklenirse claim aktif olur.
- Reown panelinde preview/prod domainleri allowlist'e eklenmeli.
- Gemiler limana giderken ayni kanalda bulusabilir (sadece park yerleri garanti); istenirse liman yanasma seritleri genisletilebilir.
- Admin panel kilit toggle'i sadece mothership icin; baska karakter kilitlenecekse genel coklu toggle gerekir.
