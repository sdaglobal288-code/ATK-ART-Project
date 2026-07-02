// =====================================
// BARANG MASUK
// =====================================
// Struktur tabel Supabase yang dipakai:
//   barang_masuk        : id, no_btb, tanggal, supplier, keterangan, gudang, created_by, created_at
//   barang_masuk_detail : id, no_btb, kode_barang, nama_barang, kategori, satuan, qty
//   master_barang       : kode_barang, nama_barang, kategori, satuan
//   master_supplier     : nama_supplier
//   stok_gudang         : kode_barang, sisa_stok  (opsional, jika tidak ada stok = 0)

const user = JSON.parse(sessionStorage.getItem("user"));
if (!user) { location.href = "login.html"; }

// Set tanggal hari ini sebagai default
document.getElementById("tanggal").value = new Date().toISOString().slice(0, 10);

// Cache
let masterBarang    = [];
let masterSupplier  = [];
let historiData     = [];
let editNoBtbAktif  = null;

// =====================================
// LOAD MASTER BARANG
// =====================================
async function loadMasterBarang() {
    try {
        const { data, error } = await supabaseClient
            .from("master_barang")
            .select("kode_barang, nama_barang, kategori, satuan")
            .order("nama_barang");
        if (error) throw error;
        masterBarang = data || [];
    } catch (err) { console.error("Gagal load master barang:", err); }
}

// =====================================
// LOAD SUPPLIER → COMBOBOX
// =====================================
async function loadSupplier() {
    try {
        const { data, error } = await supabaseClient
            .from("master_supplier")
            .select("nama_supplier")
            .order("nama_supplier");
        if (error) throw error;
        masterSupplier = (data || []).map(d => d.nama_supplier);
    } catch (err) { console.error("Gagal load supplier:", err); }
}

// =====================================
// COMBOBOX HELPER (Supplier & Edit Supplier)
// =====================================
function initCombo(inputId, hiddenId, dropdownId, items) {
    const inp  = document.getElementById(inputId);
    const hid  = document.getElementById(hiddenId);
    const drop = document.getElementById(dropdownId);
    if (!inp || !drop) return;

    function renderDrop(filter) {
        const list = filter
            ? items.filter(v => v.toLowerCase().includes(filter.toLowerCase()))
            : items;
        if (!list.length) {
            drop.innerHTML = `<div class="combo-empty">Tidak ditemukan</div>`;
        } else {
            drop.innerHTML = list.map(v =>
                `<div class="combo-item" data-val="${v}">${v}</div>`
            ).join("");
            drop.querySelectorAll(".combo-item").forEach(el => {
                el.addEventListener("click", () => {
                    inp.value = el.dataset.val;
                    if (hid) hid.value = el.dataset.val;
                    drop.classList.remove("show");
                });
            });
        }
        drop.classList.add("show");
    }

    inp.addEventListener("input",  () => renderDrop(inp.value));
    inp.addEventListener("focus",  () => renderDrop(inp.value));
    document.addEventListener("click", e => {
        if (!inp.contains(e.target) && !drop.contains(e.target))
            drop.classList.remove("show");
    });
}

// =====================================
// DETAIL ROWS (Form Tambah)
// =====================================
let rowCounter = 0;

function tambahBaris(container = "detailRows") {
    rowCounter++;
    const id = `row_${rowCounter}`;
    const row = document.createElement("div");
    row.className = "detail-row";
    row.id = id;
    row.innerHTML = `
        <div class="combo-wrapper">
            <input type="text" class="combo-input barang-search"
                   placeholder="Cari barang..." autocomplete="off">
            <input type="hidden" class="barang-kode">
            <div class="combo-dropdown barang-dropdown"></div>
        </div>
        <input type="text" class="input-readonly barang-kategori" readonly placeholder="—">
        <input type="text" class="input-readonly barang-satuan"   readonly placeholder="—">
        <div class="stok-badge barang-stok">—</div>
        <input type="number" class="input-qty barang-qty" min="1" placeholder="0" required>
        <button type="button" class="btn-hapus-baris" onclick="hapusBaris('${id}')">✕</button>
    `;
    document.getElementById(container).appendChild(row);
    initBarangCombo(row);
}

function hapusBaris(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function initBarangCombo(row) {
    const inp  = row.querySelector(".barang-search");
    const hid  = row.querySelector(".barang-kode");
    const drop = row.querySelector(".barang-dropdown");
    const kat  = row.querySelector(".barang-kategori");
    const sat  = row.querySelector(".barang-satuan");
    const stok = row.querySelector(".barang-stok");

    function renderDrop(filter) {
        const list = filter
            ? masterBarang.filter(b =>
                b.nama_barang.toLowerCase().includes(filter.toLowerCase()) ||
                b.kode_barang.toLowerCase().includes(filter.toLowerCase()))
            : masterBarang;

        if (!list.length) {
            drop.innerHTML = `<div class="combo-empty">Barang tidak ditemukan</div>`;
        } else {
            drop.innerHTML = list.slice(0, 50).map(b =>
                `<div class="combo-item" data-kode="${b.kode_barang}"
                      data-nama="${b.nama_barang}"
                      data-kat="${b.kategori ?? ''}"
                      data-sat="${b.satuan ?? ''}">
                    <strong>${b.kode_barang}</strong> — ${b.nama_barang}
                </div>`
            ).join("");
            drop.querySelectorAll(".combo-item").forEach(el => {
                el.addEventListener("click", async () => {
                    inp.value = `${el.dataset.kode} — ${el.dataset.nama}`;
                    hid.value = el.dataset.kode;
                    kat.value = el.dataset.kat;
                    sat.value = el.dataset.sat;
                    drop.classList.remove("show");
                    // Ambil sisa stok
                    try {
                        const { data } = await supabaseClient
                            .from("stok_gudang")
                            .select("sisa_stok")
                            .eq("kode_barang", el.dataset.kode)
                            .single();
                        stok.textContent = data?.sisa_stok ?? 0;
                    } catch { stok.textContent = "0"; }
                });
            });
        }
        drop.classList.add("show");
    }

    inp.addEventListener("input",  () => renderDrop(inp.value));
    inp.addEventListener("focus",  () => renderDrop(inp.value));
    document.addEventListener("click", e => {
        if (!inp.contains(e.target) && !drop.contains(e.target))
            drop.classList.remove("show");
    });
}

document.getElementById("btnTambahBaris")
    .addEventListener("click", () => tambahBaris("detailRows"));

// =====================================
// SIMPAN BARANG MASUK
// =====================================
document.getElementById("btnSimpanBTB").addEventListener("click", async () => {
    const tanggal    = document.getElementById("tanggal").value;
    const noBtb      = document.getElementById("no_btb").value.trim();
    const supplier   = document.getElementById("supplierSearch").value.trim();
    const keterangan = document.getElementById("keterangan").value.trim();

    if (!tanggal || !noBtb || !supplier) {
        alert("Tanggal, No. BTB, dan Supplier wajib diisi.");
        return;
    }

    const rows = document.querySelectorAll("#detailRows .detail-row");
    if (!rows.length) {
        alert("Tambahkan minimal 1 barang.");
        return;
    }

    const details = [];
    let valid = true;

    rows.forEach(row => {
        const kode = row.querySelector(".barang-kode").value;
        const nama = row.querySelector(".barang-search").value;
        const kat  = row.querySelector(".barang-kategori").value;
        const sat  = row.querySelector(".barang-satuan").value;
        const qty  = parseInt(row.querySelector(".barang-qty").value) || 0;
        if (!kode || qty < 1) { valid = false; return; }
        details.push({ no_btb: noBtb, kode_barang: kode, nama_barang: nama, kategori: kat, satuan: sat, qty });
    });

    if (!valid) {
        alert("Pastikan semua baris barang sudah dipilih dan qty > 0.");
        return;
    }

    // Cek duplikat no_btb
    const { data: cek } = await supabaseClient.from("barang_masuk").select("id").eq("no_btb", noBtb);
    if (cek && cek.length > 0) { alert("No. BTB sudah digunakan."); return; }

    const btn = document.getElementById("btnSimpanBTB");
    btn.disabled = true;
    btn.textContent = "⏳ Menyimpan...";

    try {
        const { error: e1 } = await supabaseClient.from("barang_masuk").insert([{
            no_btb, tanggal, supplier, keterangan: keterangan || null,
            gudang: user.gudang ?? "-", created_by: user.nama, created_at: new Date().toISOString()
        }]);
        if (e1) throw e1;

        const { error: e2 } = await supabaseClient.from("barang_masuk_detail").insert(details);
        if (e2) throw e2;

        alert("Barang Masuk berhasil disimpan.");
        document.getElementById("no_btb").value = "";
        document.getElementById("supplierSearch").value = "";
        document.getElementById("keterangan").value = "";
        document.getElementById("detailRows").innerHTML = "";
        rowCounter = 0;
        tambahBaris("detailRows");
        await loadHistori();
    } catch (err) {
        console.error(err);
        alert("Gagal menyimpan: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = "💾 Simpan Barang Masuk";
    }
});

// =====================================
// LOAD HISTORI
// =====================================
async function loadHistori() {
    const tbody = document.querySelector("#tableMasuk tbody");
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:#64748b;">
        <span style="display:inline-block;width:14px;height:14px;border:2px solid #334155;border-top-color:#3b82f6;border-radius:50%;animation:spin .7s linear infinite;margin-right:8px;vertical-align:middle;"></span>Memuat...
    </td></tr>`;

    try {
        const { data, error } = await supabaseClient
            .from("barang_masuk")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) throw error;

        historiData = data || [];
        renderHistori(historiData);
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:#ef5675;">⚠ Gagal memuat histori.</td></tr>`;
    }
}

function renderHistori(list) {
    const tbody = document.querySelector("#tableMasuk tbody");
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:#64748b;">Belum ada data.</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map((item, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${item.no_btb}</strong></td>
            <td>${item.tanggal ? new Date(item.tanggal).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) : "-"}</td>
            <td>${item.supplier ?? "-"}</td>
            <td style="text-align:center;">—</td>
            <td>${item.gudang ?? "-"}</td>
            <td>${item.created_by ?? "-"}</td>
            <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button onclick="lihatDetail('${item.no_btb}')"
                        style="background:rgba(59,130,246,.12);color:#60a5fa;border:1px solid rgba(59,130,246,.35);border-radius:7px;padding:6px 11px;font-size:12.5px;font-weight:600;cursor:pointer;">
                        👁 Detail
                    </button>
                    <button onclick="bukaEditBTB('${item.no_btb}')"
                        style="background:rgba(108,93,211,.15);color:#bcb2f5;border:1px solid #4d4499;border-radius:7px;padding:6px 11px;font-size:12.5px;font-weight:600;cursor:pointer;">
                        ✏ Edit
                    </button>
                    <button onclick="hapusBTB('${item.no_btb}')"
                        style="background:rgba(239,84,117,.12);color:#ef5675;border:1px solid #8a3548;border-radius:7px;padding:6px 11px;font-size:12.5px;font-weight:600;cursor:pointer;">
                        🗑 Hapus
                    </button>
                </div>
            </td>
        </tr>
    `).join("");
}

// Search histori
document.getElementById("search").addEventListener("input", function () {
    const kw = this.value.trim().toLowerCase();
    const filtered = historiData.filter(d =>
        (d.no_btb ?? "").toLowerCase().includes(kw) ||
        (d.supplier ?? "").toLowerCase().includes(kw)
    );
    renderHistori(filtered);
});

// =====================================
// HAPUS BTB  ← FITUR YANG DIPERBAIKI
// =====================================
async function hapusBTB(noBtb) {
    if (!confirm(`Hapus BTB "${noBtb}"?\nSemua detail barang di dalamnya juga akan dihapus.`)) return;

    try {
        // 1. Hapus detail terlebih dahulu
        const { error: e1 } = await supabaseClient
            .from("barang_masuk_detail")
            .delete()
            .eq("no_btb", noBtb);
        if (e1) throw e1;

        // 2. Hapus header
        const { error: e2 } = await supabaseClient
            .from("barang_masuk")
            .delete()
            .eq("no_btb", noBtb);
        if (e2) throw e2;

        alert(`BTB "${noBtb}" berhasil dihapus.`);
        await loadHistori();
    } catch (err) {
        console.error(err);
        alert("Gagal menghapus: " + err.message);
    }
}

// =====================================
// MODAL DETAIL BTB
// =====================================
async function lihatDetail(noBtb) {
    try {
        const { data: header } = await supabaseClient
            .from("barang_masuk").select("*").eq("no_btb", noBtb).single();

        const { data: detail } = await supabaseClient
            .from("barang_masuk_detail").select("*").eq("no_btb", noBtb);

        document.getElementById("modalNoBTB").textContent      = header?.no_btb ?? "-";
        document.getElementById("modalTanggal").textContent    = header?.tanggal
            ? new Date(header.tanggal).toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"})
            : "-";
        document.getElementById("modalSupplier").textContent   = header?.supplier ?? "-";
        document.getElementById("modalKeterangan").textContent = header?.keterangan ?? "-";

        const tbody = document.querySelector("#tableDetailBTB tbody");
        tbody.innerHTML = (detail || []).map((d, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${d.kode_barang}</td>
                <td>${d.nama_barang}</td>
                <td>${d.kategori ?? "-"}</td>
                <td>${d.satuan ?? "-"}</td>
                <td style="text-align:center;font-weight:700;">${d.qty}</td>
            </tr>
        `).join("");

        document.getElementById("modalDetailBTB").classList.add("show");
    } catch (err) {
        alert("Gagal memuat detail: " + err.message);
    }
}

document.getElementById("btnTutupModalDetail")
    .addEventListener("click", () => document.getElementById("modalDetailBTB").classList.remove("show"));

// =====================================
// MODAL EDIT BTB
// =====================================
async function bukaEditBTB(noBtb) {
    editNoBtbAktif = noBtb;

    try {
        const { data: header } = await supabaseClient
            .from("barang_masuk").select("*").eq("no_btb", noBtb).single();

        const { data: detail } = await supabaseClient
            .from("barang_masuk_detail").select("*").eq("no_btb", noBtb);

        document.getElementById("editTanggal").value       = header?.tanggal ?? "";
        document.getElementById("editNoBTB").value         = header?.no_btb ?? "";
        document.getElementById("editSupplierSearch").value = header?.supplier ?? "";
        document.getElementById("editSupplier").value      = header?.supplier ?? "";
        document.getElementById("editKeterangan").value    = header?.keterangan ?? "";

        // Populate detail rows
        const editContainer = document.getElementById("editDetailRows");
        editContainer.innerHTML = "";
        (detail || []).forEach(d => {
            const tmpCounter = ++rowCounter;
            const id = `row_edit_${tmpCounter}`;
            const row = document.createElement("div");
            row.className = "detail-row";
            row.id = id;
            row.innerHTML = `
                <div class="combo-wrapper">
                    <input type="text" class="combo-input barang-search"
                           value="${d.kode_barang} — ${d.nama_barang}" autocomplete="off">
                    <input type="hidden" class="barang-kode" value="${d.kode_barang}">
                    <div class="combo-dropdown barang-dropdown"></div>
                </div>
                <input type="text" class="input-readonly barang-kategori" readonly value="${d.kategori ?? ''}">
                <input type="text" class="input-readonly barang-satuan"   readonly value="${d.satuan ?? ''}">
                <div class="stok-badge barang-stok">—</div>
                <input type="number" class="input-qty barang-qty" min="1" value="${d.qty}" required>
                <button type="button" class="btn-hapus-baris" onclick="hapusBaris('${id}')">✕</button>
            `;
            editContainer.appendChild(row);
            initBarangCombo(row);
        });

        document.getElementById("modalEditBTB").classList.add("show");
    } catch (err) {
        alert("Gagal memuat data edit: " + err.message);
    }
}

document.getElementById("btnTambahBarisEdit")
    .addEventListener("click", () => tambahBaris("editDetailRows"));

document.getElementById("btnTutupModalEdit")
    .addEventListener("click", () => {
        document.getElementById("modalEditBTB").classList.remove("show");
        editNoBtbAktif = null;
    });

document.getElementById("btnSimpanEditBTB").addEventListener("click", async () => {
    if (!editNoBtbAktif) return;

    const tanggal    = document.getElementById("editTanggal").value;
    const supplier   = document.getElementById("editSupplierSearch").value.trim();
    const keterangan = document.getElementById("editKeterangan").value.trim();

    if (!tanggal || !supplier) { alert("Tanggal dan Supplier wajib diisi."); return; }

    const rows = document.querySelectorAll("#editDetailRows .detail-row");
    if (!rows.length) { alert("Tambahkan minimal 1 barang."); return; }

    const details = [];
    let valid = true;
    rows.forEach(row => {
        const kode = row.querySelector(".barang-kode").value;
        const nama = row.querySelector(".barang-search").value;
        const kat  = row.querySelector(".barang-kategori").value;
        const sat  = row.querySelector(".barang-satuan").value;
        const qty  = parseInt(row.querySelector(".barang-qty").value) || 0;
        if (!kode || qty < 1) { valid = false; return; }
        details.push({ no_btb: editNoBtbAktif, kode_barang: kode, nama_barang: nama, kategori: kat, satuan: sat, qty });
    });

    if (!valid) { alert("Pastikan semua baris barang sudah dipilih dan qty > 0."); return; }

    const btn = document.getElementById("btnSimpanEditBTB");
    btn.disabled = true;
    btn.textContent = "⏳ Menyimpan...";

    try {
        // Update header
        const { error: e1 } = await supabaseClient.from("barang_masuk")
            .update({ tanggal, supplier, keterangan: keterangan || null })
            .eq("no_btb", editNoBtbAktif);
        if (e1) throw e1;

        // Hapus detail lama, insert baru
        const { error: e2 } = await supabaseClient.from("barang_masuk_detail")
            .delete().eq("no_btb", editNoBtbAktif);
        if (e2) throw e2;

        const { error: e3 } = await supabaseClient.from("barang_masuk_detail").insert(details);
        if (e3) throw e3;

        alert("Barang Masuk berhasil diupdate.");
        document.getElementById("modalEditBTB").classList.remove("show");
        editNoBtbAktif = null;
        await loadHistori();
    } catch (err) {
        console.error(err);
        alert("Gagal update: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = "💾 Simpan Perubahan";
    }
});

// =====================================
// EXPORT EXCEL
// =====================================
async function exportExcel() {
    if (typeof XLSX === "undefined") { alert("Library SheetJS belum dimuat."); return; }
    if (!historiData.length) { alert("Tidak ada data untuk diexport."); return; }

    try {
        // Ambil semua detail sekaligus
        const noBtbList = historiData.map(h => h.no_btb);
        const { data: allDetail } = await supabaseClient
            .from("barang_masuk_detail")
            .select("*")
            .in("no_btb", noBtbList);

        const rows = [];
        historiData.forEach(h => {
            const details = (allDetail || []).filter(d => d.no_btb === h.no_btb);
            if (details.length) {
                details.forEach(d => rows.push({
                    "NO BTB"      : h.no_btb,
                    "TANGGAL"     : h.tanggal ?? "-",
                    "SUPPLIER"    : h.supplier ?? "-",
                    "KETERANGAN"  : h.keterangan ?? "-",
                    "KODE BARANG" : d.kode_barang,
                    "NAMA BARANG" : d.nama_barang,
                    "KATEGORI"    : d.kategori ?? "-",
                    "SATUAN"      : d.satuan ?? "-",
                    "QTY"         : d.qty,
                    "GUDANG"      : h.gudang ?? "-",
                    "CREATED BY"  : h.created_by ?? "-"
                }));
            } else {
                rows.push({
                    "NO BTB"     : h.no_btb,
                    "TANGGAL"    : h.tanggal ?? "-",
                    "SUPPLIER"   : h.supplier ?? "-",
                    "KETERANGAN" : h.keterangan ?? "-",
                    "KODE BARANG": "-", "NAMA BARANG": "-",
                    "KATEGORI": "-", "SATUAN": "-", "QTY": 0,
                    "GUDANG": h.gudang ?? "-", "CREATED BY": h.created_by ?? "-"
                });
            }
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Barang Masuk");
        XLSX.writeFile(wb, `Barang_Masuk_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
        alert("Gagal export: " + err.message);
    }
}

// =====================================
// IMPORT EXCEL
// =====================================
document.getElementById("fileImport").addEventListener("change", async function () {
    const file = this.files[0];
    if (!file) return;
    if (typeof XLSX === "undefined") { alert("Library SheetJS belum dimuat."); this.value=""; return; }

    try {
        const buf  = await file.arrayBuffer();
        const wb   = XLSX.read(buf, { type: "array" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (!rows.length) { alert("File kosong."); return; }

        // Group by NO BTB
        const grouped = {};
        rows.forEach(r => {
            const noBtb = String(r["NO BTB"] ?? "").trim();
            if (!noBtb) return;
            if (!grouped[noBtb]) {
                grouped[noBtb] = {
                    no_btb: noBtb,
                    tanggal: r["TANGGAL"] ?? new Date().toISOString().slice(0,10),
                    supplier: String(r["SUPPLIER"] ?? "").trim(),
                    keterangan: String(r["KETERANGAN"] ?? "").trim() || null,
                    gudang: user.gudang ?? "-",
                    created_by: user.nama,
                    created_at: new Date().toISOString(),
                    details: []
                };
            }
            if (r["KODE BARANG"] && r["KODE BARANG"] !== "-") {
                grouped[noBtb].details.push({
                    no_btb: noBtb,
                    kode_barang: String(r["KODE BARANG"]).trim().toUpperCase(),
                    nama_barang: String(r["NAMA BARANG"] ?? "").trim(),
                    kategori: String(r["KATEGORI"] ?? "").trim(),
                    satuan: String(r["SATUAN"] ?? "").trim(),
                    qty: Number(r["QTY"]) || 0
                });
            }
        });

        const headers = Object.values(grouped);
        let imported = 0;

        for (const h of headers) {
            const { details, ...headerData } = h;
            const { error: e1 } = await supabaseClient.from("barang_masuk")
                .upsert([headerData], { onConflict: "no_btb" });
            if (e1) { console.error(e1); continue; }
            if (details.length) {
                await supabaseClient.from("barang_masuk_detail").delete().eq("no_btb", h.no_btb);
                await supabaseClient.from("barang_masuk_detail").insert(details);
            }
            imported++;
        }

        alert(`${imported} BTB berhasil diimport.`);
        await loadHistori();
    } catch (err) {
        alert("Gagal import: " + err.message);
    } finally { this.value = ""; }
});

// =====================================
// INIT
// =====================================
document.addEventListener("DOMContentLoaded", async () => {
    await Promise.all([ loadMasterBarang(), loadSupplier() ]);
    initCombo("supplierSearch", "supplier", "supplierDropdown", masterSupplier);
    initCombo("editSupplierSearch", "editSupplier", "editSupplierDropdown", masterSupplier);
    tambahBaris("detailRows");   // satu baris kosong di awal
    await loadHistori();
});
